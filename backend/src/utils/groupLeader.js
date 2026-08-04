// beacon2026/backend/src/utils/groupLeader.js
// Shared "does this admin-app user lead this specific group/team" check.
// Same query as hasLedgerAccess() in routes/groups/ledger.js and
// routes/teams/ledger.js — factored out here so new _as_leader-scoped
// features (Std Emails/Letters ownership) don't re-derive it.

import { tenantQuery } from './db.js';

/**
 * @param {string} tenantSlug
 * @param {string} userId - the admin-app user's id (req.user.userId)
 * @param {string} groupId - a groups.id (group or team — same table)
 * @returns {Promise<boolean>}
 */
export async function isGroupLeader(tenantSlug, userId, groupId) {
  if (!groupId) return false;
  const rows = await tenantQuery(
    tenantSlug,
    `SELECT 1 FROM users u
     JOIN members m ON m.id = u.member_id
     JOIN group_members gm ON gm.member_id = m.id
     WHERE u.id = $1 AND gm.group_id = $2 AND gm.is_leader = true`,
    [userId, groupId],
  );
  return rows.length > 0;
}
