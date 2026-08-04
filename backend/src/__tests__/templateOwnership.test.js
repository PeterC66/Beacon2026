// beacon2026/backend/src/__tests__/templateOwnership.test.js
// Unit tests for hasTemplateManageAccess() — the Std Email/Letter template
// ownership check (mirrors hasLedgerAccess in routes/groups/ledger.js).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/db.js', () => ({
  tenantQuery: vi.fn(),
}));

const { tenantQuery } = await import('../utils/db.js');
const { hasTemplateManageAccess } = await import('../utils/templateOwnership.js');

function req(privileges) {
  return { user: { userId: 'u1', tenantSlug: 'test-u3a', privileges } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hasTemplateManageAccess', () => {
  it('allows via the _all privilege regardless of ownership', async () => {
    const ok = await hasTemplateManageAccess(
      req(['email_standard_messages_all:create']),
      'email_standard_messages',
      'create',
      null,
    );
    expect(ok).toBe(true);
    expect(tenantQuery).not.toHaveBeenCalled();
  });

  it('denies an unowned template via the _as_leader path (nothing to lead)', async () => {
    const ok = await hasTemplateManageAccess(
      req(['email_standard_messages_as_leader:create']),
      'email_standard_messages',
      'create',
      null,
    );
    expect(ok).toBe(false);
  });

  it('denies when the user lacks both privileges', async () => {
    const ok = await hasTemplateManageAccess(
      req(['email_standard_messages:view']),
      'email_standard_messages',
      'create',
      'group-1',
    );
    expect(ok).toBe(false);
    expect(tenantQuery).not.toHaveBeenCalled();
  });

  it('allows via _as_leader when the user actually leads the owning group', async () => {
    tenantQuery.mockResolvedValueOnce([{ '?column?': 1 }]);
    const ok = await hasTemplateManageAccess(
      req(['email_standard_messages_as_leader:create']),
      'email_standard_messages',
      'create',
      'group-1',
    );
    expect(ok).toBe(true);
    expect(tenantQuery).toHaveBeenCalledOnce();
  });

  it('denies via _as_leader when the user does not lead the owning group', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const ok = await hasTemplateManageAccess(
      req(['email_standard_messages_as_leader:create']),
      'email_standard_messages',
      'create',
      'group-1',
    );
    expect(ok).toBe(false);
  });

  it('checks the action-specific privilege string, not just any as_leader grant', async () => {
    const ok = await hasTemplateManageAccess(
      req(['email_standard_messages_as_leader:view']), // has view, not delete
      'email_standard_messages',
      'delete',
      'group-1',
    );
    expect(ok).toBe(false);
    expect(tenantQuery).not.toHaveBeenCalled();
  });
});
