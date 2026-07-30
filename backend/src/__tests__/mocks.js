// beacon2026/backend/src/__tests__/mocks.js
// Shared vi.mock factory helpers, introduced in Chunk 7 of docs/ImprovementPlan.md
// to remove the near-identical db/redis/audit mock boilerplate that was copy-pasted
// into every backend test file (M4, backend half).
//
// vitest statically hoists `vi.mock(...)` calls to the top of the module, *and*
// hoists the imports they reference, so these factories are safe to call inside a
// `vi.mock('../utils/db.js', () => dbMock())` factory. Each factory returns a fresh
// object with fresh vi.fn() spies per call.

import { vi } from 'vitest';

/**
 * Mock for `../utils/db.js`.
 *
 * @param {object} [extra] extra top-level exports to merge in. A nested `prisma`
 *   key is merged into the default prisma stub (so you can add `sysTenant`,
 *   `sysAdmin`, `$queryRawUnsafe`, `$transaction`, etc.).
 */
export function dbMock(extra = {}) {
  const { prisma: prismaExtra, ...rest } = extra;
  return {
    prisma: { $disconnect: vi.fn(), ...prismaExtra },
    tenantQuery: vi.fn(),
    withTenant: vi.fn(),
    // Harmless for modules that don't import it; required by members/calendar/etc.
    escapeLike: (s) => String(s).replace(/[\\%_]/g, (ch) => `\\${ch}`),
    ...rest,
  };
}

/** Mock for `../utils/redis.js`. */
export function redisMock(extra = {}) {
  return {
    isSessionInvalidated: vi.fn().mockResolvedValue(false),
    invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
    purgeTenantInvalidations: vi.fn().mockResolvedValue(undefined),
    ...extra,
  };
}

/** Mock for `../utils/audit.js`. */
export function auditMock(extra = {}) {
  return { logAudit: vi.fn().mockResolvedValue(undefined), ...extra };
}

/** Mock for `../utils/password.js`. */
export function passwordMock(extra = {}) {
  return {
    hashPassword: vi.fn().mockResolvedValue('$hashed$'),
    verifyPassword: vi.fn().mockResolvedValue(true),
    generateToken: vi.fn(() => 'opaque-token'),
    hashOpaqueToken: vi.fn((t) => `hashed:${t}`),
    ...extra,
  };
}
