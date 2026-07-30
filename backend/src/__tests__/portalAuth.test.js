// beacon2026/backend/src/__tests__/portalAuth.test.js
// Tests for portal login lockout (KNOWN-ISSUES #3) and portal
// forgot-password email wiring (KNOWN-ISSUES #4).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../utils/db.js', () => ({
  prisma: { sysTenant: { findUnique: vi.fn() } },
  tenantQuery: vi.fn(),
  withTenant: vi.fn(),
}));

vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated: vi.fn().mockResolvedValue(false),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/password.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('$hashed$'),
  verifyPassword: vi.fn(),
  generateToken: vi.fn(() => 'opaque-reset-token'),
  hashOpaqueToken: vi.fn((t) => `hashed:${t}`),
}));

const sgSend = vi.fn().mockResolvedValue(undefined);
vi.mock('@sendgrid/mail', () => ({
  default: { setApiKey: vi.fn(), send: sgSend },
}));

const { default: app } = await import('../app.js');
const { tenantQuery, prisma } = await import('../utils/db.js');
const { verifyPassword } = await import('../utils/password.js');

const TENANT = 'test_u3a';

function mockTenantExists() {
  prisma.sysTenant.findUnique.mockResolvedValue({ slug: TENANT, active: true, name: 'Test u3a' });
}

// ── POST /:slug/portal/login — lockout ───────────────────────────────────

describe('POST /public/:slug/portal/login lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantExists();
  });

  it('returns 401 generic error when account is currently locked', async () => {
    const future = new Date(Date.now() + 5 * 60_000);
    tenantQuery.mockResolvedValueOnce([
      {
        id: 'm1',
        membership_number: '101',
        forenames: 'A',
        surname: 'B',
        email: 'a@b.com',
        portal_password_hash: '$hash$',
        portal_email_verified: true,
        portal_failed_login_count: 0,
        portal_locked_until: future,
      },
    ]);

    const res = await request(app)
      .post(`/public/${TENANT}/portal/login`)
      .send({ email: 'a@b.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password.');
    // Lock check must short-circuit before bcrypt
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('increments portal_failed_login_count on a bad password', async () => {
    tenantQuery.mockResolvedValueOnce([
      {
        id: 'm1',
        membership_number: '101',
        forenames: 'A',
        surname: 'B',
        email: 'a@b.com',
        portal_password_hash: '$hash$',
        portal_email_verified: true,
        portal_failed_login_count: 1,
        portal_locked_until: null,
      },
    ]);
    verifyPassword.mockResolvedValueOnce(false);
    // UPDATE for failure bookkeeping
    tenantQuery.mockResolvedValueOnce([]);
    // audit insert
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`/public/${TENANT}/portal/login`)
      .send({ email: 'a@b.com', password: 'wrong' });

    expect(res.status).toBe(401);
    const update = tenantQuery.mock.calls.find((c) =>
      /UPDATE members SET portal_failed_login_count/.test(c[1]),
    );
    expect(update).toBeDefined();
    // count of 1 → 2, not locked
    expect(update[2]).toEqual([2, null, 'm1']);
  });

  it('locks the account on the Nth failed attempt', async () => {
    tenantQuery.mockResolvedValueOnce([
      {
        id: 'm1',
        membership_number: '101',
        forenames: 'A',
        surname: 'B',
        email: 'a@b.com',
        portal_password_hash: '$hash$',
        portal_email_verified: true,
        portal_failed_login_count: 4,
        portal_locked_until: null,
      },
    ]);
    verifyPassword.mockResolvedValueOnce(false);
    tenantQuery.mockResolvedValueOnce([]);
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`/public/${TENANT}/portal/login`)
      .send({ email: 'a@b.com', password: 'wrong' });

    expect(res.status).toBe(401);
    const update = tenantQuery.mock.calls.find((c) =>
      /UPDATE members SET portal_failed_login_count/.test(c[1]),
    );
    expect(update[2][0]).toBe(0); // count reset on lock
    expect(update[2][1]).toBeInstanceOf(Date); // locked_until set
    expect(update[2][1].getTime()).toBeGreaterThan(Date.now());
  });

  it('runs a dummy comparison and returns generic 401 for an unknown email', async () => {
    // No matching member rows
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`/public/${TENANT}/portal/login`)
      .send({ email: 'nobody@b.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password.');
    // The throwaway bcrypt comparison runs so timing matches a wrong-password hit
    expect(verifyPassword).toHaveBeenCalled();
  });

  it('rejects a slug containing a hyphen with 400 (matches db.js guard)', async () => {
    const res = await request(app)
      .post('/public/bad-slug/portal/login')
      .send({ email: 'a@b.com', password: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid tenant slug/i);
  });

  it('resets counter on successful login', async () => {
    tenantQuery.mockResolvedValueOnce([
      {
        id: 'm1',
        membership_number: '101',
        forenames: 'A',
        surname: 'B',
        email: 'a@b.com',
        portal_password_hash: '$hash$',
        portal_email_verified: true,
        portal_failed_login_count: 3,
        portal_locked_until: null,
      },
    ]);
    verifyPassword.mockResolvedValueOnce(true);
    // UPDATE counter reset
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`/public/${TENANT}/portal/login`)
      .send({ email: 'a@b.com', password: 'right' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    const reset = tenantQuery.mock.calls.find((c) =>
      /portal_failed_login_count = 0, portal_locked_until = NULL/.test(c[1]),
    );
    expect(reset).toBeDefined();
    expect(reset[2]).toEqual(['m1']);
  });
});

// ── POST /:slug/portal/forgot-password — email wiring ───────────────────

describe('POST /public/:slug/portal/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantExists();
    delete process.env.SENDGRID_API_KEY;
  });

  it('no longer leaks the reset link to console.log', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'm1', forenames: 'A', surname: 'B' }]);
    tenantQuery.mockResolvedValueOnce([]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).post(`/public/${TENANT}/portal/forgot-password`).send({ email: 'a@b.com' });

    for (const call of logSpy.mock.calls) {
      const line = call.join(' ');
      expect(line).not.toContain('opaque-reset-token');
      expect(line).not.toContain('reset-password');
    }
    logSpy.mockRestore();
  });

  it('warns when SENDGRID_API_KEY is unset but still returns the generic success', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'm1', forenames: 'A', surname: 'B' }]);
    tenantQuery.mockResolvedValueOnce([]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await request(app)
      .post(`/public/${TENANT}/portal/forgot-password`)
      .send({ email: 'a@b.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(warnSpy).toHaveBeenCalled();
    expect(sgSend).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns the generic success when no member matches (no enumeration)', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`/public/${TENANT}/portal/forgot-password`)
      .send({ email: 'nobody@b.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(sgSend).not.toHaveBeenCalled();
  });
});
