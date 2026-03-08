// beacon2/backend/src/__tests__/auth.test.js
// Tests for POST /auth/login, /auth/logout, /auth/refresh, /auth/system/login

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader, TEST_TENANT } from './helpers.js';

// ── Module mocks (hoisted before imports by vitest) ───────────────────────

vi.mock('../utils/db.js', () => ({
  prisma:      { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant:  vi.fn(),
}));

vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated:   vi.fn().mockResolvedValue(false),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/authService.js', () => ({
  loginUser:     vi.fn(),
  logoutUser:    vi.fn().mockResolvedValue(undefined),
  refreshTokens: vi.fn(),
  loginSysAdmin: vi.fn(),
}));

const { default: app } = await import('../app.js');
const { loginUser, logoutUser, refreshTokens, loginSysAdmin } =
  await import('../services/authService.js');

// ── POST /auth/login ──────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with accessToken on valid credentials', async () => {
    loginUser.mockResolvedValueOnce({
      accessToken:  'acc.tok.en',
      refreshToken: 'ref.tok.en',
      user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ tenantSlug: 'test-u3a', email: 'alice@example.com', password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('acc.tok.en');
    expect(res.body.user.name).toBe('Alice');
    expect(loginUser).toHaveBeenCalledWith('test-u3a', 'alice@example.com', 'secret');
  });

  it('returns 401 when authService throws an auth error', async () => {
    const err = new Error('Invalid credentials.'); err.status = 401;
    loginUser.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/auth/login')
      .send({ tenantSlug: 'test-u3a', email: 'x@y.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials.');
  });

  it('returns 422 on invalid body (missing email)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ tenantSlug: 'test-u3a', password: 'pw' });

    expect(res.status).toBe(422);
  });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with message on valid token', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', makeAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully.');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no refresh cookie is present', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .set('x-tenant-slug', TEST_TENANT);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No refresh token.');
  });

  it('returns 400 when x-tenant-slug header is missing', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'beacon2_refresh=sometoken');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Tenant not specified.');
  });

  it('returns 200 with new accessToken on valid refresh', async () => {
    refreshTokens.mockResolvedValueOnce({
      accessToken:  'new.acc.tok',
      refreshToken: 'new.ref.tok',
    });

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'beacon2_refresh=valid-token')
      .set('x-tenant-slug', TEST_TENANT);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new.acc.tok');
  });
});

// ── POST /auth/system/login ───────────────────────────────────────────────

describe('POST /auth/system/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with accessToken on valid sysAdmin credentials', async () => {
    loginSysAdmin.mockResolvedValueOnce({
      accessToken: 'sys.acc.tok',
      admin: { id: 'a1', name: 'Admin', email: 'admin@beacon2.local' },
    });

    const res = await request(app)
      .post('/auth/system/login')
      .send({ email: 'admin@beacon2.local', password: 'supersecret' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('sys.acc.tok');
    expect(res.body.admin.name).toBe('Admin');
  });

  it('returns 422 on missing password', async () => {
    const res = await request(app)
      .post('/auth/system/login')
      .send({ email: 'admin@beacon2.local' });

    expect(res.status).toBe(422);
  });
});
