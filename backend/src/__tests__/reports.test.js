// beacon2/backend/src/__tests__/reports.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader } from './helpers.js';

vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated:   vi.fn().mockResolvedValue(false),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/db.js', () => ({
  prisma:      { $disconnect: vi.fn(), $transaction: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant:  vi.fn(),
}));

const { default: app } = await import('../app.js');
const { tenantQuery, prisma } = await import('../utils/db.js');

// Note: the shared TEST_TENANT slug has a hyphen (`test-u3a`) which would be
// rejected by our own slug regex in sqlSafety.js (`^[a-z0-9_]+$` — matches
// db.js). We override it here with a valid production-style slug. Other test
// files bypass this because they mock tenantQuery fully, but sqlSafety.js runs
// its own check before calling prisma.$transaction.
const AUTH       = makeAuthHeader({ tenantSlug: 'test_u3a' });
const AUTH_ADMIN = makeAuthHeader({ tenantSlug: 'test_u3a', isSiteAdmin: true });

const SAMPLE_REPORT = {
  id: 1,
  name: 'Member count by class',
  description: 'Counts',
  sql_text: 'SELECT class_id, count(*) AS n FROM members GROUP BY class_id',
  parameters: [],
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

// Runs the callback the same way prisma.$transaction does for our reports
// code: we pass a fake tx stub that supports the SET LOCAL statements and
// returns `txResult` from $queryRawUnsafe.
function mockTransaction(txResult) {
  prisma.$transaction.mockImplementationOnce(async (cb) => {
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRawUnsafe:   vi.fn().mockResolvedValue(txResult),
    };
    return cb(tx);
  });
}

// ── GET /reports ─────────────────────────────────────────────────────────

describe('GET /reports', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with list', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 1, name: 'r', description: null, parameters: [], updated_at: new Date() }]);
    const res = await request(app).get('/reports').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/reports');
    expect(res.status).toBe(401);
  });

  it('returns 403 without reports:view', async () => {
    const res = await request(app)
      .get('/reports')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /reports/:id ─────────────────────────────────────────────────────

describe('GET /reports/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with the saved report', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_REPORT]);
    const res = await request(app).get('/reports/1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Member count by class');
  });

  it('returns 404 when missing', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).get('/reports/999').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── POST /reports — create (site admin) ─────────────────────────────────

describe('POST /reports', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a saved report (site admin)', async () => {
    tenantQuery.mockResolvedValueOnce([{ ...SAMPLE_REPORT, id: 2 }]);  // INSERT ... RETURNING
    tenantQuery.mockResolvedValueOnce([]);  // audit
    const res = await request(app)
      .post('/reports').set('Authorization', AUTH_ADMIN)
      .send({ name: 'r', sqlText: 'SELECT 1', parameters: [] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(2);
  });

  it('rejects when not site admin', async () => {
    const res = await request(app)
      .post('/reports').set('Authorization', AUTH)
      .send({ name: 'r', sqlText: 'SELECT 1' });
    expect(res.status).toBe(403);
  });

  it('rejects non-SELECT SQL', async () => {
    const res = await request(app)
      .post('/reports').set('Authorization', AUTH_ADMIN)
      .send({ name: 'r', sqlText: 'DROP TABLE members' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/SELECT or WITH/);
  });

  it('rejects multi-statement SQL', async () => {
    const res = await request(app)
      .post('/reports').set('Authorization', AUTH_ADMIN)
      .send({ name: 'r', sqlText: 'SELECT 1; DELETE FROM members' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Multiple statements/);
  });
});

// ── POST /reports/:id/run ───────────────────────────────────────────────

describe('POST /reports/:id/run', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs a saved report and returns columns + rows', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_REPORT]);        // fetchReport
    mockTransaction([{ class_id: 'c1', n: 3n }]);              // BigInt handled
    tenantQuery.mockResolvedValueOnce([]);                     // audit
    const res = await request(app)
      .post('/reports/1/run').set('Authorization', AUTH)
      .send({ params: {} });
    expect(res.status).toBe(200);
    expect(res.body.columns).toEqual(['class_id', 'n']);
    expect(res.body.rows[0].n).toBe('3');  // BigInt → string
    expect(res.body.truncated).toBe(false);
  });

  it('substitutes named parameters positionally', async () => {
    const paramReport = {
      ...SAMPLE_REPORT,
      sql_text: 'SELECT * FROM members WHERE class_id = :cls AND created_at > :since',
      parameters: [
        { name: 'cls', label: 'Class', type: 'text', required: true },
        { name: 'since', label: 'Since', type: 'date', required: false },
      ],
    };
    tenantQuery.mockResolvedValueOnce([paramReport]);

    // Capture the exact SQL + values passed to $queryRawUnsafe
    let seenSql, seenValues;
    prisma.$transaction.mockImplementationOnce(async (cb) => {
      const tx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        $queryRawUnsafe:   vi.fn().mockImplementation((sql, ...values) => {
          seenSql = sql;
          seenValues = values;
          return Promise.resolve([]);
        }),
      };
      return cb(tx);
    });

    tenantQuery.mockResolvedValueOnce([]);  // audit

    const res = await request(app)
      .post('/reports/1/run').set('Authorization', AUTH)
      .send({ params: { cls: 'c1', since: '2026-01-01' } });

    expect(res.status).toBe(200);
    expect(seenSql).toBe('SELECT * FROM members WHERE class_id = $1 AND created_at > $2');
    expect(seenValues).toEqual(['c1', '2026-01-01']);
  });

  it('returns 404 for unknown report', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .post('/reports/999/run').set('Authorization', AUTH)
      .send({ params: {} });
    expect(res.status).toBe(404);
  });
});

// ── POST /reports/sql/run — ad-hoc (site admin) ─────────────────────────

describe('POST /reports/sql/run', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs ad-hoc SQL as site admin', async () => {
    mockTransaction([{ one: 1 }]);
    tenantQuery.mockResolvedValueOnce([]);  // audit
    const res = await request(app)
      .post('/reports/sql/run').set('Authorization', AUTH_ADMIN)
      .send({ sql: 'SELECT 1 AS one' });
    expect(res.status).toBe(200);
    expect(res.body.rows).toEqual([{ one: 1 }]);
  });

  it('rejects non-admin user', async () => {
    const res = await request(app)
      .post('/reports/sql/run').set('Authorization', AUTH)
      .send({ sql: 'SELECT 1' });
    expect(res.status).toBe(403);
  });

  it('rejects UPDATE statements', async () => {
    const res = await request(app)
      .post('/reports/sql/run').set('Authorization', AUTH_ADMIN)
      .send({ sql: 'UPDATE members SET name = 1' });
    expect(res.status).toBe(400);
  });

  it('accepts WITH (CTE) queries', async () => {
    mockTransaction([{ total: 5 }]);
    tenantQuery.mockResolvedValueOnce([]);  // audit
    const res = await request(app)
      .post('/reports/sql/run').set('Authorization', AUTH_ADMIN)
      .send({ sql: 'WITH t AS (SELECT 5 AS total) SELECT * FROM t' });
    expect(res.status).toBe(200);
    expect(res.body.rows[0].total).toBe(5);
  });

  it('accepts SQL with leading comments before SELECT', async () => {
    mockTransaction([{ one: 1 }]);
    tenantQuery.mockResolvedValueOnce([]);  // audit
    const res = await request(app)
      .post('/reports/sql/run').set('Authorization', AUTH_ADMIN)
      .send({ sql: '-- count rows\nSELECT 1 AS one' });
    expect(res.status).toBe(200);
  });
});

// ── POST /reports/:id/download ──────────────────────────────────────────

describe('POST /reports/:id/download', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns xlsx content-type', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_REPORT]);
    mockTransaction([{ class_id: 'c1', n: 3 }]);
    tenantQuery.mockResolvedValueOnce([]);  // audit
    const res = await request(app)
      .post('/reports/1/download').set('Authorization', AUTH)
      .send({ params: {} });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });
});
