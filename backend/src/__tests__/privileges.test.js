// beacon2/backend/src/__tests__/privileges.test.js

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

const SAMPLE_RESOURCE = {
  id: 'res-1',
  code: 'members_list',
  label: 'Members List',
  actions: ['view'],
};

// ── GET /privileges/resources ─────────────────────────────────────────────

describe('GET /privileges/resources', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with privilege resources', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_RESOURCE]);
    const res = await request(app).get('/privileges/resources').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].code).toBe('members_list');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/privileges/resources');
    expect(res.status).toBe(401);
  });

  it('returns 403 without role_record:view privilege', async () => {
    const res = await request(app)
      .get('/privileges/resources')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});
