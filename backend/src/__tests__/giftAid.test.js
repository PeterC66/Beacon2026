// beacon2/backend/src/__tests__/giftAid.test.js

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

const SETTINGS = {
  year_start_month: 1,
  year_start_day: 1,
};

const SAMPLE_ROW = {
  id: 't1', transaction_number: 1, date: '2026-03-01',
  gift_aid_amount: 25.00, gift_aid_claimed_at: null,
  member_id: 'm1', title: 'Mr', forenames: 'John', surname: 'Smith',
  membership_number: 101, gift_aid_from: '2025-01-01', email: 'john@test.com',
  house_no: '42', postcode: 'CB1 1AA',
};

// ── GET /gift-aid ─────────────────────────────────────────────────────────

describe('GET /gift-aid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with eligible rows', async () => {
    tenantQuery.mockResolvedValueOnce([SETTINGS]);   // settings
    tenantQuery.mockResolvedValueOnce([SAMPLE_ROW]); // fetchDeclarationRows
    const res = await request(app).get('/gift-aid').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].surname).toBe('Smith');
    expect(res.body.yearNum).toBe(2026);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/gift-aid');
    expect(res.status).toBe(401);
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app).get('/gift-aid').set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── POST /gift-aid/download ───────────────────────────────────────────────

describe('POST /gift-aid/download', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with Excel file', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_ROW]); // fetchDeclarationRows
    const res = await request(app)
      .post('/gift-aid/download')
      .set('Authorization', AUTH)
      .send({ ids: ['t1'], from: '2026-01-01', to: '2026-12-31' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.headers['content-disposition']).toMatch(/gift_aid_declaration_\d{4}-\d{2}-\d{2}\.xlsx/);
  });

  it('returns 400 when no matching transactions', async () => {
    tenantQuery.mockResolvedValueOnce([]); // no rows
    const res = await request(app)
      .post('/gift-aid/download')
      .set('Authorization', AUTH)
      .send({ ids: ['t1'], from: '2026-01-01', to: '2026-12-31' });
    expect(res.status).toBe(400);
  });

  it('returns 422 with invalid body', async () => {
    const res = await request(app)
      .post('/gift-aid/download')
      .set('Authorization', AUTH)
      .send({ ids: [], from: '2026-01-01', to: '2026-12-31' });
    expect(res.status).toBe(422);
  });
});

// ── POST /gift-aid/mark ───────────────────────────────────────────────────

describe('POST /gift-aid/mark', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with count of marked transactions', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 't1' }]); // UPDATE RETURNING
    const res = await request(app)
      .post('/gift-aid/mark')
      .set('Authorization', AUTH)
      .send({ ids: ['t1'] });
    expect(res.status).toBe(200);
    expect(res.body.marked).toBe(1);
  });

  it('returns 422 with empty ids', async () => {
    const res = await request(app)
      .post('/gift-aid/mark')
      .set('Authorization', AUTH)
      .send({ ids: [] });
    expect(res.status).toBe(422);
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app)
      .post('/gift-aid/mark')
      .set('Authorization', makeAuthHeader({ privileges: ['gift_aid_declaration:view'] }))
      .send({ ids: ['t1'] });
    expect(res.status).toBe(403);
  });
});
