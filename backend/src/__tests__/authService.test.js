// beacon2/backend/src/__tests__/authService.test.js
// Unit tests for the security-critical paths in authService.js:
//   H1 — refresh token must reject a tenant slug mismatch
//   H2 — failed-login counter increments and locks the account

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the data layer and Redis before importing the service.
vi.mock('../utils/db.js', () => ({
  prisma:      { sysTenant: { findUnique: vi.fn() } },
  tenantQuery: vi.fn(),
}));
vi.mock('../utils/redis.js', () => ({
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/password.js', () => ({
  hashPassword:   vi.fn().mockResolvedValue('hashed'),
  verifyPassword: vi.fn(),
}));

const { prisma, tenantQuery } = await import('../utils/db.js');
const { logAudit } = await import('../utils/audit.js');
const { verifyPassword } = await import('../utils/password.js');
const { signRefreshToken } = await import('../utils/jwt.js');
const { loginUser, refreshTokens } = await import('../services/authService.js');

const TENANT = 'tenant_a';

beforeEach(() => {
  vi.clearAllMocks();
  prisma.sysTenant.findUnique.mockResolvedValue({ slug: TENANT, active: true });
});

// ── H1 — refresh token tenant slug must match payload ─────────────────────

describe('refreshTokens — tenant slug validation (H1)', () => {
  it('rejects a token issued for a different tenant', async () => {
    const otherTenantToken = signRefreshToken({ userId: 'u1', tenantSlug: 'tenant_b' });

    await expect(refreshTokens(TENANT, otherTenantToken))
      .rejects.toMatchObject({ status: 401, message: 'Invalid refresh token.' });

    // The DB lookup must NOT happen — we should reject before touching the schema.
    expect(tenantQuery).not.toHaveBeenCalled();
  });

  it('proceeds past slug check when the slugs match', async () => {
    const token = signRefreshToken({ userId: 'u1', tenantSlug: TENANT });

    // First tenantQuery is the refresh_tokens lookup — return "not found"
    // so refreshTokens throws "Invalid refresh token." for a different reason.
    tenantQuery.mockResolvedValueOnce([]);

    await expect(refreshTokens(TENANT, token))
      .rejects.toMatchObject({ status: 401 });

    expect(tenantQuery).toHaveBeenCalledTimes(1);
  });
});

// ── H2 — account lockout after consecutive failures ──────────────────────

describe('loginUser — failed-login lockout (H2)', () => {
  function userRow(overrides = {}) {
    return {
      id: 'u1',
      email: 'alice@example.com',
      name: 'Alice',
      password_hash: 'real-hash',
      active: true,
      is_site_admin: false,
      must_change_password: false,
      failed_login_count: 0,
      locked_until: null,
      ...overrides,
    };
  }

  it('rejects login while locked_until is in the future', async () => {
    const future = new Date(Date.now() + 5 * 60_000);
    tenantQuery.mockResolvedValueOnce([userRow({ locked_until: future })]);
    verifyPassword.mockResolvedValueOnce(true);   // even a correct password is rejected

    await expect(loginUser(TENANT, 'alice', 'correct'))
      .rejects.toMatchObject({ status: 401, message: 'Invalid credentials.' });

    // No counter update or audit log when the account is already locked
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('increments the failure counter on a wrong password', async () => {
    tenantQuery.mockResolvedValueOnce([userRow({ failed_login_count: 1 })]);
    verifyPassword.mockResolvedValueOnce(false);
    tenantQuery.mockResolvedValueOnce([]);   // UPDATE users SET failed_login_count = ...

    await expect(loginUser(TENANT, 'alice', 'wrong'))
      .rejects.toMatchObject({ status: 401 });

    // Second tenantQuery call is the UPDATE — count = 2, locked_until = null
    expect(tenantQuery.mock.calls[1][1]).toMatch(/UPDATE users SET failed_login_count/);
    expect(tenantQuery.mock.calls[1][2]).toEqual([2, null, 'u1']);

    expect(logAudit).toHaveBeenCalledWith(TENANT, expect.objectContaining({
      action: 'login_failed',
      userId: 'u1',
      detail: 'Failed attempt 2/5',
    }));
  });

  it('locks the account on the 5th consecutive failure', async () => {
    tenantQuery.mockResolvedValueOnce([userRow({ failed_login_count: 4 })]);
    verifyPassword.mockResolvedValueOnce(false);
    tenantQuery.mockResolvedValueOnce([]);

    await expect(loginUser(TENANT, 'alice', 'wrong'))
      .rejects.toMatchObject({ status: 401 });

    // count is reset to 0 and locked_until is a Date in the future
    const [, , params] = tenantQuery.mock.calls[1];
    expect(params[0]).toBe(0);
    expect(params[1]).toBeInstanceOf(Date);
    expect(params[1].getTime()).toBeGreaterThan(Date.now());

    expect(logAudit).toHaveBeenCalledWith(TENANT, expect.objectContaining({
      action: 'login_locked',
    }));
  });

  it('does not touch the counter when the user does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]);   // username lookup
    tenantQuery.mockResolvedValueOnce([]);   // email-fallback lookup
    verifyPassword.mockResolvedValueOnce(false);

    await expect(loginUser(TENANT, 'ghost', 'whatever'))
      .rejects.toMatchObject({ status: 401 });

    // Only the two SELECTs, no UPDATE, no audit entry
    expect(tenantQuery).toHaveBeenCalledTimes(2);
    expect(logAudit).not.toHaveBeenCalled();
  });
});
