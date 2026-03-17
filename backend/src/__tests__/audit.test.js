// beacon2/backend/src/__tests__/audit.test.js
// Tests for /audit endpoints.

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

const SAMPLE_ENTRY = {
  id: 'a1', user_id: 'u1', user_name: 'Alice', action: 'create',
  entity_type: 'member', entity_id: 'm1', entity_name: 'Smith, John',
  detail: null, created_at: '2026-03-01T10:00:00Z',
};

// ── GET /audit ─────────────────────────────────────────────────────────────

describe('GET /audit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with audit entries', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_ENTRY]);

    const res = await request(app).get('/audit').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].user_name).toBe('Alice');
  });

  it('returns 200 with explicit date range', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_ENTRY]);

    const res = await request(app)
      .get('/audit?from=2026-01-01&to=2026-03-01')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
  });

  it('returns 400 for range exceeding 3 months', async () => {
    const res = await request(app)
      .get('/audit?from=2025-01-01&to=2026-03-01')
      .set('Authorization', AUTH);

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/audit');
    expect(res.status).toBe(401);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .get('/audit')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── DELETE /audit ──────────────────────────────────────────────────────────

describe('DELETE /audit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with deleted count', async () => {
    tenantQuery.mockResolvedValueOnce([{ count: '5' }]);

    const res = await request(app)
      .delete('/audit')
      .set('Authorization', AUTH)
      .send({ before: '2026-01-01' });

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(5);
  });

  it('returns 422 for invalid date format', async () => {
    const res = await request(app)
      .delete('/audit')
      .set('Authorization', AUTH)
      .send({ before: 'not-a-date' });

    expect(res.status).toBe(422);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .delete('/audit')
      .set('Authorization', makeAuthHeader({ privileges: [] }))
      .send({ before: '2026-01-01' });

    expect(res.status).toBe(403);
  });
});
