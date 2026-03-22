// beacon2/backend/src/__tests__/finance.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader } from './helpers.js';

vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated:   vi.fn().mockResolvedValue(false),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/db.js', () => ({
  prisma:      { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant:  vi.fn(),
}));

const { default: app } = await import('../app.js');
const { tenantQuery } = await import('../utils/db.js');

const AUTH = makeAuthHeader();

const SAMPLE_ACCOUNT  = { id: 'a1', name: 'Current Account', active: true, locked: false, sort_order: 0 };
const SAMPLE_CATEGORY = { id: 'c1', name: 'Subscriptions',   active: true, locked: false, sort_order: 0 };
const SAMPLE_TXN = {
  id: 't1', transaction_number: 1, account_id: 'a1', date: '2026-03-01',
  type: 'in', from_to: 'Member', amount: 10, payment_method: 'Cash',
  payment_ref: null, detail: 'Test', remarks: null,
  cleared_at: null, member_id_1: null, member_id_2: null, group_id: null,
  categories: [{ category_id: 'c1', name: 'Subscriptions', amount: 10 }],
};

// ── GET /finance/accounts ──────────────────────────────────────────────────

describe('GET /finance/accounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with account list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_ACCOUNT]);
    const res = await request(app).get('/finance/accounts').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Current Account');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/finance/accounts');
    expect(res.status).toBe(401);
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app).get('/finance/accounts').set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── POST /finance/accounts ─────────────────────────────────────────────────

describe('POST /finance/accounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates account and returns 201', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_ACCOUNT]);
    const res = await request(app).post('/finance/accounts').set('Authorization', AUTH).send({ name: 'Current Account' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Current Account');
  });

  it('returns 422 when name missing', async () => {
    const res = await request(app).post('/finance/accounts').set('Authorization', AUTH).send({});
    expect(res.status).toBe(422);
  });
});

// ── PATCH /finance/accounts/:id ────────────────────────────────────────────

describe('PATCH /finance/accounts/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates account', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ locked: false }])
      .mockResolvedValueOnce([{ ...SAMPLE_ACCOUNT, name: 'Savings' }]);
    const res = await request(app).patch('/finance/accounts/a1').set('Authorization', AUTH).send({ name: 'Savings' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Savings');
  });

  it('returns 400 when account is locked', async () => {
    tenantQuery.mockResolvedValueOnce([{ locked: true }]);
    const res = await request(app).patch('/finance/accounts/a1').set('Authorization', AUTH).send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).patch('/finance/accounts/unknown').set('Authorization', AUTH).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /finance/accounts/:id ───────────────────────────────────────────

describe('DELETE /finance/accounts/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes account', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ locked: false }])  // not locked
      .mockResolvedValueOnce([])                    // no transactions
      .mockResolvedValueOnce([]);                   // delete
    const res = await request(app).delete('/finance/accounts/a1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 400 when account has transactions', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ locked: false }])
      .mockResolvedValueOnce([{ id: 't1' }]);
    const res = await request(app).delete('/finance/accounts/a1').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 400 when locked', async () => {
    tenantQuery.mockResolvedValueOnce([{ locked: true }]);
    const res = await request(app).delete('/finance/accounts/a1').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });
});

// ── GET /finance/categories ────────────────────────────────────────────────

describe('GET /finance/categories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with category list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_CATEGORY]);
    const res = await request(app).get('/finance/categories').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Subscriptions');
  });
});

// ── POST /finance/categories ───────────────────────────────────────────────

describe('POST /finance/categories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates category and returns 201', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_CATEGORY]);
    const res = await request(app).post('/finance/categories').set('Authorization', AUTH).send({ name: 'Subscriptions' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Subscriptions');
  });
});

// ── GET /finance/transactions ──────────────────────────────────────────────

describe('GET /finance/transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when accountId provided', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_TXN]);                      // transactions query
    tenantQuery.mockResolvedValueOnce([{ balance_brought_forward: 0 }]);  // account BF query
    tenantQuery.mockResolvedValueOnce([{ net: 0 }]);                      // prior-year net query
    const res = await request(app).get('/finance/transactions?accountId=a1&year=2026').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.transactions[0].transaction_number).toBe(1);
    expect(res.body.openingBalance).toBe(0);
  });

  it('returns empty array when no filter provided', async () => {
    const res = await request(app).get('/finance/transactions').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── GET /finance/transactions/:id ──────────────────────────────────────────

describe('GET /finance/transactions/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns transaction', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_TXN]);
    const res = await request(app).get('/finance/transactions/t1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('t1');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).get('/finance/transactions/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── POST /finance/transactions ─────────────────────────────────────────────

describe('POST /finance/transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates transaction and returns 201', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ pending_config: 'disabled', pending_types: [] }])  // account lookup
      .mockResolvedValueOnce([{ id: 't1', transaction_number: 1 }])  // INSERT
      .mockResolvedValueOnce([]);                                       // INSERT category
    const payload = {
      account_id: 'a1', date: '2026-03-01', type: 'in',
      amount: 10, categories: [{ category_id: 'c1', amount: 10 }],
    };
    const res = await request(app).post('/finance/transactions').set('Authorization', AUTH).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.transaction_number).toBe(1);
  });

  it('auto-sets pending for by_type config', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ pending_config: 'by_type', pending_types: ['BACS'] }])
      .mockResolvedValueOnce([{ id: 't2', transaction_number: 2 }])
      .mockResolvedValueOnce([]);
    const payload = {
      account_id: 'a1', date: '2026-03-01', type: 'in',
      amount: 15, payment_method: 'BACS',
      categories: [{ category_id: 'c1', amount: 15 }],
    };
    const res = await request(app).post('/finance/transactions').set('Authorization', AUTH).send(payload);
    expect(res.status).toBe(201);
    // The INSERT call should include pending=true as the last param
    const insertCall = tenantQuery.mock.calls[1];
    expect(insertCall[2][12]).toBe(true); // pending param
  });

  it('returns 400 when category amounts do not sum to total', async () => {
    const payload = {
      account_id: 'a1', date: '2026-03-01', type: 'in',
      amount: 10, categories: [{ category_id: 'c1', amount: 5 }],
    };
    const res = await request(app).post('/finance/transactions').set('Authorization', AUTH).send(payload);
    expect(res.status).toBe(400);
  });

  it('returns 422 when required fields missing', async () => {
    const res = await request(app).post('/finance/transactions').set('Authorization', AUTH).send({});
    expect(res.status).toBe(422);
  });
});

// ── DELETE /finance/transactions/:id ───────────────────────────────────────

describe('DELETE /finance/transactions/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes uncleared transaction', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ cleared_at: null }])
      .mockResolvedValueOnce([]);
    const res = await request(app).delete('/finance/transactions/t1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 400 when transaction is cleared', async () => {
    tenantQuery.mockResolvedValueOnce([{ cleared_at: '2026-02-01' }]);
    const res = await request(app).delete('/finance/transactions/t1').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).delete('/finance/transactions/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── PATCH /finance/transactions/bulk-pending ─────────────────────────────

describe('PATCH /finance/transactions/bulk-pending', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirms pending transactions', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 't1', cleared_at: null, transfer_id: null, batch_id: null }])
      .mockResolvedValueOnce([]);
    const res = await request(app)
      .patch('/finance/transactions/bulk-pending')
      .set('Authorization', AUTH)
      .send({ ids: ['t1'], pending: false });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  it('rejects cleared transactions', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 't1', cleared_at: '2026-01-01', transfer_id: null, batch_id: null }]);
    const res = await request(app)
      .patch('/finance/transactions/bulk-pending')
      .set('Authorization', AUTH)
      .send({ ids: ['t1'], pending: true });
    expect(res.status).toBe(400);
  });

  it('rejects transfer transactions', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 't1', cleared_at: null, transfer_id: 'tf1', batch_id: null }]);
    const res = await request(app)
      .patch('/finance/transactions/bulk-pending')
      .set('Authorization', AUTH)
      .send({ ids: ['t1'], pending: true });
    expect(res.status).toBe(400);
  });

  it('rejects batched transactions', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 't1', cleared_at: null, transfer_id: null, batch_id: 'b1' }]);
    const res = await request(app)
      .patch('/finance/transactions/bulk-pending')
      .set('Authorization', AUTH)
      .send({ ids: ['t1'], pending: false });
    expect(res.status).toBe(400);
  });

  it('returns 422 when ids array is empty', async () => {
    const res = await request(app)
      .patch('/finance/transactions/bulk-pending')
      .set('Authorization', AUTH)
      .send({ ids: [], pending: true });
    expect(res.status).toBe(422);
  });
});
