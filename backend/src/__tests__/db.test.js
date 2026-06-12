// beacon2/backend/src/__tests__/db.test.js
// Unit tests for the tenant-slug guards in utils/db.js. These run against the
// real module (no Prisma mock) — the guards throw before any DB call, so no
// database connection is needed.

import { describe, it, expect } from 'vitest';
import { tenantQuery, withTenant, escapeLike } from '../utils/db.js';

describe('tenantQuery slug guard', () => {
  it('rejects a non-string (undefined) slug before querying', async () => {
    await expect(tenantQuery(undefined, 'SELECT 1')).rejects.toThrow(/expected string/i);
  });

  it('rejects a null slug', async () => {
    await expect(tenantQuery(null, 'SELECT 1')).rejects.toThrow(/expected string/i);
  });

  it('rejects a slug with invalid characters', async () => {
    await expect(tenantQuery('bad-slug!', 'SELECT 1')).rejects.toThrow(/Invalid tenant slug/);
  });
});

describe('withTenant slug guard', () => {
  it('rejects a non-string (undefined) slug before querying', async () => {
    await expect(withTenant(undefined, async () => 1)).rejects.toThrow(/expected string/i);
  });

  it('rejects a slug with invalid characters', async () => {
    await expect(withTenant('bad slug', async () => 1)).rejects.toThrow(/Invalid tenant slug/);
  });
});

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('a_b%c\\d')).toBe('a\\_b\\%c\\\\d');
  });
});
