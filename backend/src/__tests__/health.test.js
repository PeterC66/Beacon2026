// beacon2/backend/src/__tests__/health.test.js
// Sanity-check: the app wires up and the /health endpoint responds.

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Prevent the Prisma client from trying to connect during tests
vi.mock('../utils/db.js', () => ({
  prisma:      { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant:  vi.fn(),
}));

vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated: vi.fn().mockResolvedValue(false),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

const { default: app } = await import('../app.js');

describe('GET /health', () => {
  it('returns 200 { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
