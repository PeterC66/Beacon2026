// beacon2/backend/src/utils/audit.js
// Best-effort audit logging helper. Never throws — a logging failure must not
// break the operation that triggered it.

import { tenantQuery } from './db.js';

/**
 * Write one audit entry to the tenant's audit_log table.
 *
 * @param {string} slug       - Tenant slug
 * @param {object} opts
 * @param {string|null} opts.userId     - ID of the user who performed the action
 * @param {string}      opts.userName   - Display name of that user
 * @param {string}      opts.action     - e.g. 'create', 'update', 'delete'
 * @param {string}      opts.entityType - e.g. 'member', 'user', 'role', 'setting'
 * @param {string|null} opts.entityId   - PK of the affected record
 * @param {string|null} opts.entityName - Human-readable name of the record
 * @param {string|null} opts.detail     - Extra context (stringified JSON or plain text)
 */
export async function logAudit(slug, { userId = null, userName, action, entityType, entityId = null, entityName = null, detail = null }) {
  try {
    await tenantQuery(
      slug,
      `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, entity_name, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, userName, action, entityType, entityId, entityName, detail],
    );
  } catch {
    // Intentionally swallow — audit failure must not break the caller
  }
}
