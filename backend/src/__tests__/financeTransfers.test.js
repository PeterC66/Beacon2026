// beacon2/backend/src/__tests__/financeTransfers.test.js
// Coverage for the transfer-money sub-router (routes/finance/transfers.js),
// added in Chunk 7 of docs/ImprovementPlan.md.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader } from './helpers.js';
import { dbMock, redisMock } from './mocks.js';

vi.mock('../utils/redis.js', () => redisMock());
vi.mock('../utils/db.js', () => dbMock());

const { default: app } = await import('../app.js');
const { tenantQuery } = await import('../utils/db.js');

const AUTH = makeAuthHeader();

beforeEach(() => vi.clearAllMocks());

// ── GET /finance/transfers ──────────────────────────────────────────────────

describe('GET /finance/transfers', () => {
  it('returns 200 with the transfer list', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'tf1', amount: 50, from_account: 'A', to_account: 'B' },
    ]);
    const res = await request(app).get('/finance/transfers').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('tf1');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/finance/transfers');
    expect(res.status).toBe(401);
  });

  it('returns 403 without the privilege', async () => {
    const res = await request(app)
      .get('/finance/transfers')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /finance/transfers/:transferId ──────────────────────────────────────

describe('GET /finance/transfers/:transferId', () => {
  it('returns the two legs split into out/in', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'o1', type: 'out', account_name: 'A' },
      { id: 'i1', type: 'in', account_name: 'B' },
    ]);
    const res = await request(app).get('/finance/transfers/tf1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.out.id).toBe('o1');
    expect(res.body.in.id).toBe('i1');
  });

  it('returns 404 when fewer than two legs exist', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'o1', type: 'out' }]);
    const res = await request(app).get('/finance/transfers/tf1').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── POST /finance/transfers ─────────────────────────────────────────────────

describe('POST /finance/transfers', () => {
  const payload = {
    date: '2026-03-01',
    amount: 50,
    from_account_id: 'a1',
    to_account_id: 'a2',
  };

  it('creates two linked transactions and returns 201', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'o1', transaction_number: 10 }]) // out leg
      .mockResolvedValueOnce([{ id: 'i1', transaction_number: 11 }]); // in leg
    const res = await request(app)
      .post('/finance/transfers')
      .set('Authorization', AUTH)
      .send(payload);
    expect(res.status).toBe(201);
    expect(res.body.out.id).toBe('o1');
    expect(res.body.in.id).toBe('i1');
    // Both legs share the same generated transfer_id (last INSERT param)
    const outId = tenantQuery.mock.calls[0][2].at(-1);
    const inId = tenantQuery.mock.calls[1][2].at(-1);
    expect(outId).toBe(inId);
  });

  it('returns 400 when from and to accounts match', async () => {
    const res = await request(app)
      .post('/finance/transfers')
      .set('Authorization', AUTH)
      .send({ ...payload, to_account_id: 'a1' });
    expect(res.status).toBe(400);
  });

  it('returns 422 when amount is not positive', async () => {
    const res = await request(app)
      .post('/finance/transfers')
      .set('Authorization', AUTH)
      .send({ ...payload, amount: -5 });
    expect(res.status).toBe(422);
  });
});

// ── PATCH /finance/transfers/:transferId ────────────────────────────────────

describe('PATCH /finance/transfers/:transferId', () => {
  it('updates both legs and returns a message', async () => {
    tenantQuery
      .mockResolvedValueOnce([
        { id: 'o1', type: 'out', cleared_at: null },
        { id: 'i1', type: 'in', cleared_at: null },
      ])
      .mockResolvedValueOnce([]) // out UPDATE
      .mockResolvedValueOnce([]); // in UPDATE
    const res = await request(app)
      .patch('/finance/transfers/tf1')
      .set('Authorization', AUTH)
      .send({ amount: 75 });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });

  it('returns 400 when a leg is already cleared', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'o1', type: 'out', cleared_at: '2026-02-01' },
      { id: 'i1', type: 'in', cleared_at: null },
    ]);
    const res = await request(app)
      .patch('/finance/transfers/tf1')
      .set('Authorization', AUTH)
      .send({ amount: 75 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the transfer does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .patch('/finance/transfers/unknown')
      .set('Authorization', AUTH)
      .send({ amount: 1 });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /finance/transfers/:transferId ───────────────────────────────────

describe('DELETE /finance/transfers/:transferId', () => {
  it('deletes both legs of an uncleared transfer', async () => {
    tenantQuery
      .mockResolvedValueOnce([
        { id: 'o1', cleared_at: null },
        { id: 'i1', cleared_at: null },
      ])
      .mockResolvedValueOnce([]); // DELETE
    const res = await request(app).delete('/finance/transfers/tf1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 400 when a leg is cleared', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'o1', cleared_at: '2026-02-01' },
      { id: 'i1', cleared_at: null },
    ]);
    const res = await request(app).delete('/finance/transfers/tf1').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the transfer does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).delete('/finance/transfers/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});
