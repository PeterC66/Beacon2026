// beacon2/backend/src/__tests__/auth.test.js
// Tests for POST /auth/login, /auth/logout, /auth/refresh, /auth/system/login

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader, TEST_TENANT, TEST_USER_ID } from './helpers.js';

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

vi.mock('../utils/password.js', () => ({
  hashPassword:   vi.fn().mockResolvedValue('$hashed$'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateToken:  vi.fn(() => 'opaque-token'),
  hashOpaqueToken: vi.fn((t) => `hashed:${t}`),
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
const { tenantQuery } = await import('../utils/db.js');
const { invalidateUserSessions } = await import('../utils/redis.js');

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
      .send({ tenantSlug: 'test-u3a', username: 'alice', password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('acc.tok.en');
    expect(res.body.user.name).toBe('Alice');
    expect(loginUser).toHaveBeenCalledWith('test-u3a', 'alice', 'secret');
  });

  it('returns 401 when authService throws an auth error', async () => {
    const err = new Error('Invalid credentials.'); err.status = 401;
    loginUser.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/auth/login')
      .send({ tenantSlug: 'test-u3a', username: 'baduser', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials.');
  });

  it('returns 422 on invalid body (missing username)', async () => {
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

  it('returns 403 when Origin header does not match CORS_ORIGIN (CSRF)', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'beacon2_refresh=valid-token')
      .set('x-tenant-slug', TEST_TENANT)
      .set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Origin not allowed.');
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('accepts a refresh whose Origin matches CORS_ORIGIN', async () => {
    refreshTokens.mockResolvedValueOnce({
      accessToken:  'new.acc.tok',
      refreshToken: 'new.ref.tok',
    });

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'beacon2_refresh=valid-token')
      .set('x-tenant-slug', TEST_TENANT)
      .set('Origin', 'http://localhost:5173');

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

// ── POST /auth/change-password ────────────────────────────────────────────

describe('POST /auth/change-password', () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = { currentPassword: 'oldpass', newPassword: 'NewPass99X!' };

  it('revokes refresh tokens and invalidates sessions on success', async () => {
    // 1: SELECT user → returns the user row
    tenantQuery.mockResolvedValueOnce([{ id: TEST_USER_ID, password_hash: '$old$' }]);
    // 2: UPDATE password — no rows needed
    tenantQuery.mockResolvedValueOnce([]);
    // 3: UPDATE refresh_tokens
    tenantQuery.mockResolvedValueOnce([]);
    // 4: audit log INSERT (best-effort)
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', makeAuthHeader())
      .send(validBody);

    expect(res.status).toBe(200);

    const sqlCalls = tenantQuery.mock.calls.map((c) => c[1]);
    expect(sqlCalls.some((s) => /UPDATE refresh_tokens SET revoked = true/.test(s))).toBe(true);
    expect(invalidateUserSessions).toHaveBeenCalledWith(TEST_TENANT, TEST_USER_ID);
  });

  it('returns 400 when the current password is wrong', async () => {
    const { verifyPassword } = await import('../utils/password.js');
    verifyPassword.mockResolvedValueOnce(false);
    tenantQuery.mockResolvedValueOnce([{ id: TEST_USER_ID, password_hash: '$old$' }]);

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', makeAuthHeader())
      .send(validBody);

    expect(res.status).toBe(400);
    expect(invalidateUserSessions).not.toHaveBeenCalled();
  });
});

// ── POST /auth/force-change-password ──────────────────────────────────────

describe('POST /auth/force-change-password', () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = {
    newPassword: 'NewPass99X!',
    question:    'Favourite colour?',
    answer:      'Blue',
  };

  it('returns 403 when must_change_password is false', async () => {
    tenantQuery.mockResolvedValueOnce([{ must_change_password: false }]);

    const res = await request(app)
      .post('/auth/force-change-password')
      .set('Authorization', makeAuthHeader())
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Password change not required.');
    expect(invalidateUserSessions).not.toHaveBeenCalled();
  });

  it('returns 403 when the user row is missing', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/auth/force-change-password')
      .set('Authorization', makeAuthHeader())
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('updates password and revokes sessions when must_change_password is true', async () => {
    // 1: SELECT must_change_password
    tenantQuery.mockResolvedValueOnce([{ must_change_password: true }]);
    // 2: UPDATE users
    tenantQuery.mockResolvedValueOnce([]);
    // 3: UPDATE refresh_tokens
    tenantQuery.mockResolvedValueOnce([]);
    // 4: audit
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/auth/force-change-password')
      .set('Authorization', makeAuthHeader())
      .send(validBody);

    expect(res.status).toBe(200);
    const sqlCalls = tenantQuery.mock.calls.map((c) => c[1]);
    expect(sqlCalls.some((s) => /UPDATE users SET password_hash = \$1, must_change_password = false/.test(s))).toBe(true);
    expect(sqlCalls.some((s) => /UPDATE refresh_tokens SET revoked = true/.test(s))).toBe(true);
    expect(invalidateUserSessions).toHaveBeenCalledWith(TEST_TENANT, TEST_USER_ID);
  });
});
