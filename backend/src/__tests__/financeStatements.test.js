// beacon2026/backend/src/__tests__/financeStatements.test.js
// Coverage for the statements sub-router (routes/finance/statements.js),
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
const SETTINGS = { year_start_month: 1, year_start_day: 1 };

beforeEach(() => vi.clearAllMocks());

/** Queue the seven queries getStatementData() runs for a single-account view. */
function mockStatementData({ accounts, priorNet = 0, categoryRows = [], totals, pending = 0 }) {
  tenantQuery
    .mockResolvedValueOnce([SETTINGS]) // settings
    .mockResolvedValueOnce(accounts) // accounts
    .mockResolvedValueOnce([{ net: priorNet }]) // prior-year net
    .mockResolvedValueOnce(categoryRows) // category breakdown
    .mockResolvedValueOnce([totals]) // year totals
    .mockResolvedValueOnce([{ count: pending }]) // pending count
    .mockResolvedValueOnce([{ count: 3 }]); // active-account count (label) — >1 so a single account isn't "All Accounts"
}

// ── GET /finance/statement ──────────────────────────────────────────────────

describe('GET /finance/statement', () => {
  it('returns computed opening/closing balances for an account', async () => {
    mockStatementData({
      accounts: [{ id: 'a1', name: 'Current', balance_brought_forward: 100 }],
      priorNet: 20,
      categoryRows: [{ category: 'Subs', type: 'in', total: 60 }],
      totals: { total_in: 60, total_out: 10 },
    });
    const res = await request(app)
      .get('/finance/statement?accountId=a1&year=2026')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.openingBalance).toBe(120); // 100 BF + 20 prior net
    expect(res.body.closingBalance).toBe(170); // 120 + 60 in - 10 out
    expect(res.body.accountLabel).toBe('Current');
  });

  it('returns 400 when accountId is missing', async () => {
    const res = await request(app).get('/finance/statement').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 404 when no matching account exists', async () => {
    tenantQuery
      .mockResolvedValueOnce([SETTINGS]) // settings
      .mockResolvedValueOnce([]); // accounts empty → 404
    const res = await request(app)
      .get('/finance/statement?accountId=missing')
      .set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });

  it('returns 403 without the privilege', async () => {
    const res = await request(app)
      .get('/finance/statement?accountId=a1')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /finance/statement/download ─────────────────────────────────────────

describe('GET /finance/statement/download', () => {
  it('streams an xlsx workbook', async () => {
    mockStatementData({
      accounts: [{ id: 'a1', name: 'Current', balance_brought_forward: 0 }],
      categoryRows: [
        { category: 'Subs', type: 'in', total: 60 },
        { category: 'Hall', type: 'out', total: 10 },
      ],
      totals: { total_in: 60, total_out: 10 },
    });
    const res = await request(app)
      .get('/finance/statement/download?accountId=a1&year=2026')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.headers['content-disposition']).toMatch(/statement_Current_2026\.xlsx/);
  });
});

// ── GET /finance/groups-statement ───────────────────────────────────────────

describe('GET /finance/groups-statement', () => {
  it('returns group summaries with computed balances', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'g1', name: 'Art', bf: 10, total_in: 30, total_out: 5, status: 'Active' },
    ]);
    const res = await request(app)
      .get('/finance/groups-statement?from=2026-01-01&to=2026-12-31')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.groups[0].balance).toBe(35); // 10 + 30 - 5
    expect(res.body.entries).toBeNull();
  });

  it('includes individual entries when showTransactions=1', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'g1', name: 'Art', bf: 0, total_in: 30, total_out: 5 }])
      .mockResolvedValueOnce([{ group_id: 'g1', entry_date: '2026-02-01', money_in: 30 }]);
    const res = await request(app)
      .get('/finance/groups-statement?from=2026-01-01&to=2026-12-31&showTransactions=1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
  });

  it('returns 400 when from/to are missing', async () => {
    const res = await request(app).get('/finance/groups-statement').set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });
});
