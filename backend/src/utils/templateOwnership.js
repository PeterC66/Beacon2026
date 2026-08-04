// beacon2026/backend/src/utils/templateOwnership.js
// Authorization for Std Email/Letter template ownership.
//
// Viewing/using a template (loading it into an email/letter compose screen)
// is unrestricted — the base `email_standard_messages:view` /
// `letters_standard_messages:view` privilege, unchanged, ungated by owner.
//
// Adding/editing/deleting a template is owner-scoped, mirroring the
// group_ledger_all / group_ledger_as_leader pattern (see
// routes/groups/ledger.js):
//   - `${resourcePrefix}_all:${action}`       — tenant-wide (Administration)
//   - `${resourcePrefix}_as_leader:${action}` — only if the caller leads the
//     template's owner_group_id (checked via isGroupLeader)
// An unowned template (owner_group_id IS NULL) can only be managed via the
// `_all` path — there is no group to be "leader of".

import { isGroupLeader } from './groupLeader.js';

/**
 * @param {object} req - Express request with req.user populated by requireAuth
 * @param {'email_standard_messages'|'letters_standard_messages'} resourcePrefix
 * @param {'view'|'create'|'change'|'delete'} action
 * @param {string|null} ownerGroupId
 * @returns {Promise<boolean>}
 */
export async function hasTemplateManageAccess(req, resourcePrefix, action, ownerGroupId) {
  const { userId, tenantSlug, privileges } = req.user;
  if (privileges.includes(`${resourcePrefix}_all:${action}`)) return true;
  if (!ownerGroupId) return false;
  if (!privileges.includes(`${resourcePrefix}_as_leader:${action}`)) return false;
  return isGroupLeader(tenantSlug, userId, ownerGroupId);
}
