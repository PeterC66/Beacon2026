// beacon2026/backend/src/__tests__/redis.test.js
// Unit tests for the Postgres fallback in utils/redis.js — the path taken when
// Redis is disabled (no REDIS_URL in the test env, so USE_REDIS resolves false
// and the module-level client stays null). Verifies the session-invalidation
// marker is persisted to / read from the session_invalidations table instead.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock only the data layer; import the REAL redis.js so the fallback runs.
vi.mock('../utils/db.js', () => ({
  tenantQuery: vi.fn(),
}));

const { tenantQuery } = await import('../utils/db.js');
const { invalidateUserSessions, isSessionInvalidated, purgeTenantInvalidations } =
  await import('../utils/redis.js');

const SLUG = 'tenant_a';
const SUBJECT = 'user-123';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('redis.js Postgres fallback (Redis disabled)', () => {
  it('invalidateUserSessions upserts a row for the subject', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    await invalidateUserSessions(SLUG, SUBJECT);

    expect(tenantQuery).toHaveBeenCalledTimes(1);
    const [slug, sql, params] = tenantQuery.mock.calls[0];
    expect(slug).toBe(SLUG);
    expect(sql).toMatch(/INSERT INTO session_invalidations/i);
    expect(sql).toMatch(/ON CONFLICT \(subject_id\) DO UPDATE/i);
    expect(params).toEqual([SUBJECT]);
  });

  it('isSessionInvalidated returns false when no marker exists', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const result = await isSessionInvalidated(SLUG, SUBJECT, 1_000_000);
    expect(result).toBe(false);
  });

  it('isSessionInvalidated returns true when the token predates the marker', async () => {
    const tokenIssuedAt = 1_000; // seconds → 1_000_000 ms
    const invalidatedAt = new Date(2_000_000); // ms, after the token
    tenantQuery.mockResolvedValueOnce([{ invalidated_at: invalidatedAt }]);

    const result = await isSessionInvalidated(SLUG, SUBJECT, tokenIssuedAt);
    expect(result).toBe(true);
  });

  it('isSessionInvalidated returns false when the token postdates the marker', async () => {
    const tokenIssuedAt = 3_000; // seconds → 3_000_000 ms
    const invalidatedAt = new Date(2_000_000); // ms, before the token
    tenantQuery.mockResolvedValueOnce([{ invalidated_at: invalidatedAt }]);

    const result = await isSessionInvalidated(SLUG, SUBJECT, tokenIssuedAt);
    expect(result).toBe(false);
  });

  it('isSessionInvalidated returns false for a token issued in the same second as the marker', async () => {
    // Regression test: a self-service route (e.g. change-password) calls
    // invalidateUserSessions() and then immediately mints a fresh token for
    // the caller's own session. JWT `iat` is second-precision, so that fresh
    // token can land in the exact same second as the (millisecond-precision)
    // invalidation marker. It must not be treated as predating the marker,
    // or the caller is logged out by their own password change.
    const invalidatedAt = new Date(2_000_500); // second 2000, 500ms in
    const tokenIssuedAt = 2_000; // seconds — same second, issued after the marker
    tenantQuery.mockResolvedValueOnce([{ invalidated_at: invalidatedAt }]);

    const result = await isSessionInvalidated(SLUG, SUBJECT, tokenIssuedAt);
    expect(result).toBe(false);
  });

  it('purgeTenantInvalidations clears the tenant fallback rows', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    await purgeTenantInvalidations(SLUG);

    expect(tenantQuery).toHaveBeenCalledTimes(1);
    const [slug, sql] = tenantQuery.mock.calls[0];
    expect(slug).toBe(SLUG);
    expect(sql).toMatch(/DELETE FROM session_invalidations/i);
  });
});
