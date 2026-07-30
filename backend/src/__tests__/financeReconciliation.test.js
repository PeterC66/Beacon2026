// beacon2026/backend/src/__tests__/financeReconciliation.test.js
// Coverage for the reconciliation sub-router (routes/finance/reconciliation.js),
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

// ── GET /finance/reconcile ──────────────────────────────────────────────────

describe('GET /finance/reconcile', () => {
  it('returns cleared balance and the combined uncleared list', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'a1', name: 'Current', balance_brought_forward: 100 }]) // account
      .mockResolvedValueOnce([{ net: 50 }]) // cleared net
      .mockResolvedValueOnce([
        { id: 't1', transaction_number: 5, date: '2026-03-01', type: 'in', amount: 20 },
      ]) // unbatched
      .mockResolvedValueOnce([
        { id: 'b1', batch_ref: 'B1', txn_count: 3, total_amount: 30, earliest_date: '2026-02-01' },
      ]); // batches
    const res = await request(app)
      .get('/finance/reconcile?accountId=a1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.clearedBalance).toBe(150);
    // One individual txn + one batch summary row, sorted by date (batch first)
    expect(res.body.uncleared).toHaveLength(2);
    expect(res.body.uncleared[0].is_batch).toBe(true);
  });

  it('returns 400 when accountId is missing', async () => {
    const res = await request(app).get('/finance/reconcile').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the account is not found', async () => {
    tenantQuery.mockResolvedValueOnce([]); // account lookup empty
    const res = await request(app)
      .get('/finance/reconcile?accountId=missing')
      .set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });

  it('returns 403 without the privilege', async () => {
    const res = await request(app)
      .get('/finance/reconcile?accountId=a1')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── POST /finance/reconcile ─────────────────────────────────────────────────

describe('POST /finance/reconcile', () => {
  it('clears the selected transactions and batches', async () => {
    tenantQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]); // txn + batch UPDATEs
    const res = await request(app)
      .post('/finance/reconcile')
      .set('Authorization', AUTH)
      .send({
        accountId: 'a1',
        statementDate: '2026-03-31',
        transactionIds: ['t1'],
        batchIds: ['b1'],
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/saved/i);
    expect(tenantQuery).toHaveBeenCalledTimes(2);
  });

  it('skips the batch UPDATE when no batchIds are given', async () => {
    tenantQuery.mockResolvedValueOnce([]); // only the txn UPDATE
    const res = await request(app)
      .post('/finance/reconcile')
      .set('Authorization', AUTH)
      .send({ accountId: 'a1', statementDate: '2026-03-31', transactionIds: ['t1'] });
    expect(res.status).toBe(200);
    expect(tenantQuery).toHaveBeenCalledTimes(1);
  });

  it('returns 422 when statementDate is malformed', async () => {
    const res = await request(app)
      .post('/finance/reconcile')
      .set('Authorization', AUTH)
      .send({ accountId: 'a1', statementDate: '31/03/2026', transactionIds: [] });
    expect(res.status).toBe(422);
  });

  it('returns 403 without the reconcile privilege', async () => {
    const res = await request(app)
      .post('/finance/reconcile')
      .set('Authorization', makeAuthHeader({ privileges: ['finance_reconcile:view'] }))
      .send({ accountId: 'a1', statementDate: '2026-03-31', transactionIds: [] });
    expect(res.status).toBe(403);
  });
});
