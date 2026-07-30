// beacon2026/backend/src/__tests__/email.test.js
// Focused regression coverage for the S1 tenant-context bug. A fuller email
// route suite is scheduled for Chunk 7 of docs/ImprovementPlan.md.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { makeAuthHeader, TEST_TENANT } from './helpers.js';

vi.mock('../utils/db.js', () => ({
  prisma: { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant: vi.fn(),
}));
vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated: vi.fn().mockResolvedValue(false),
}));

const { tenantQuery } = await import('../utils/db.js');
const { default: app } = await import('../app.js');
const request = supertest(app);
const auth = makeAuthHeader();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /email/standard-messages', () => {
  it('returns the list of standard messages', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'sm-1', name: 'Welcome', subject: 'Hi', body: 'Hello' },
    ]);
    const res = await request.get('/email/standard-messages').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Welcome');
  });

  it('returns 401 without auth', async () => {
    const res = await request.get('/email/standard-messages');
    expect(res.status).toBe(401);
  });

  // Regression for S1: email.js previously read req.tenantSlug (undefined on
  // authenticated routes), which coerced to the string "undefined" and
  // targeted a non-existent u3a_undefined schema. Assert the query is scoped
  // to the authenticated user's tenant instead.
  it('scopes the query to the authenticated user tenant', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    await request.get('/email/standard-messages').set('Authorization', auth);
    expect(tenantQuery).toHaveBeenCalled();
    expect(tenantQuery.mock.calls[0][0]).toBe(TEST_TENANT);
  });
});
