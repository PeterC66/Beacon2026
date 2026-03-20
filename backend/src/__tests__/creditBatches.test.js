// beacon2/backend/src/__tests__/creditBatches.test.js

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
const NO_PRIV = makeAuthHeader({ privileges: [] });

const SAMPLE_BATCH = {
  id: 'b1', batch_ref: 'Batch-001', account_id: 'a1',
  created_at: '2026-03-15T10:00:00Z', txn_count: 2,
  total_amount: 50.0, cleared_count: 0,
  earliest_date: '2026-03-01', latest_date: '2026-03-10',
};

// ── GET /finance/batches ───────────────────────────────────────────────────

describe('GET /finance/batches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with batch list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_BATCH]);
    const res = await request(app).get('/finance/batches?accountId=a1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].batch_ref).toBe('Batch-001');
  });

  it('returns 400 when accountId missing', async () => {
    const res = await request(app).get('/finance/batches').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app).get('/finance/batches?accountId=a1').set('Authorization', NO_PRIV);
    expect(res.status).toBe(403);
  });

  it('supports since mode with date', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_BATCH]);
    const res = await request(app).get('/finance/batches?accountId=a1&mode=since&date=2026-01-01').set('Authorization', AUTH);
    expect(res.status).toBe(200);
  });
});

// ── GET /finance/batches/unbatched ─────────────────────────────────────────

describe('GET /finance/batches/unbatched', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with unbatched transactions', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 't1', transaction_number: 1, date: '2026-03-01', type: 'in', amount: 25, is_transfer: false },
    ]);
    const res = await request(app).get('/finance/batches/unbatched?accountId=a1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns 400 when accountId missing', async () => {
    const res = await request(app).get('/finance/batches/unbatched').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });
});

// ── GET /finance/batches/:id ───────────────────────────────────────────────

describe('GET /finance/batches/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns batch detail with transactions', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'b1', batch_ref: 'Batch-001', account_id: 'a1', created_at: '2026-03-15T10:00:00Z' }]);
    tenantQuery.mockResolvedValueOnce([
      { id: 't1', transaction_number: 1, date: '2026-03-01', type: 'in', amount: 25, cleared_at: null },
    ]);
    const res = await request(app).get('/finance/batches/b1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.batch_ref).toBe('Batch-001');
    expect(res.body.transactions).toHaveLength(1);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).get('/finance/batches/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── POST /finance/batches ──────────────────────────────────────────────────

describe('POST /finance/batches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates batch and returns 201', async () => {
    tenantQuery
      .mockResolvedValueOnce([])           // no existing batch with same ref
      .mockResolvedValueOnce([{ id: 'b2', batch_ref: 'Batch-002', account_id: 'a1', created_at: '2026-03-15T10:00:00Z' }])
      .mockResolvedValueOnce([{ id: 't1' }])  // UPDATE transactions
      .mockResolvedValueOnce([]);              // logAudit INSERT
    const res = await request(app).post('/finance/batches').set('Authorization', AUTH)
      .send({ account_id: 'a1', batch_ref: 'Batch-002', transactionIds: ['t1', 't2'] });
    expect(res.status).toBe(201);
    expect(res.body.batch_ref).toBe('Batch-002');
  });

  it('returns 409 when duplicate batch_ref for same account', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'b1' }]);  // existing batch with same ref
    const res = await request(app).post('/finance/batches').set('Authorization', AUTH)
      .send({ account_id: 'a1', batch_ref: 'Batch-001', transactionIds: ['t1'] });
    expect(res.status).toBe(409);
  });

  it('returns 422 when required fields missing', async () => {
    const res = await request(app).post('/finance/batches').set('Authorization', AUTH).send({});
    expect(res.status).toBe(422);
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app).post('/finance/batches').set('Authorization', NO_PRIV)
      .send({ account_id: 'a1', batch_ref: 'B', transactionIds: ['t1'] });
    expect(res.status).toBe(403);
  });
});

// ── POST /finance/batches/:id/transactions ─────────────────────────────────

describe('POST /finance/batches/:id/transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds transactions to batch', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'b1', account_id: 'a1' }]);
    tenantQuery.mockResolvedValueOnce([{ id: 't3' }, { id: 't4' }]);
    const res = await request(app).post('/finance/batches/b1/transactions').set('Authorization', AUTH)
      .send({ transactionIds: ['t3', 't4'] });
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(2);
  });

  it('returns 404 when batch not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).post('/finance/batches/unknown/transactions').set('Authorization', AUTH)
      .send({ transactionIds: ['t1'] });
    expect(res.status).toBe(404);
  });

  it('returns 422 when transactionIds missing', async () => {
    const res = await request(app).post('/finance/batches/b1/transactions').set('Authorization', AUTH).send({});
    expect(res.status).toBe(422);
  });
});

// ── DELETE /finance/batches/:id/transactions ───────────────────────────────

describe('DELETE /finance/batches/:id/transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes transactions from batch', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 't1' }]);
    const res = await request(app).delete('/finance/batches/b1/transactions').set('Authorization', AUTH)
      .send({ transactionIds: ['t1'] });
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(1);
  });

  it('returns 422 when transactionIds missing', async () => {
    const res = await request(app).delete('/finance/batches/b1/transactions').set('Authorization', AUTH).send({});
    expect(res.status).toBe(422);
  });
});

// ── DELETE /finance/batches/:id ────────────────────────────────────────────

describe('DELETE /finance/batches/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes empty batch', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'b1', txn_count: 0, cleared_count: 0 }]);
    tenantQuery.mockResolvedValueOnce([]);  // DELETE
    tenantQuery.mockResolvedValueOnce([]);  // logAudit INSERT
    const res = await request(app).delete('/finance/batches/b1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 400 when batch has transactions', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'b1', txn_count: 3, cleared_count: 0 }]);
    const res = await request(app).delete('/finance/batches/b1').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).delete('/finance/batches/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app).delete('/finance/batches/b1').set('Authorization', NO_PRIV);
    expect(res.status).toBe(403);
  });
});
