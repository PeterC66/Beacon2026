// beacon2/backend/src/routes/roles.js

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { invalidateUserSessions } from '../utils/redis.js';

const router = Router();
router.use(requireAuth);

// ─── GET /roles ───────────────────────────────────────────────────────────
router.get('/', requirePrivilege('roles_list', 'view'), async (req, res, next) => {
  try {
    const roles = await tenantQuery(
      req.user.tenantSlug,
      `SELECT r.id, r.name, r.is_committee, r.notes, r.created_at, r.updated_at,
              COUNT(ur.user_id)::int AS user_count
       FROM roles r
       LEFT JOIN user_roles ur ON ur.role_id = r.id
       GROUP BY r.id
       ORDER BY r.name`,
    );
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// ─── GET /roles/:id ───────────────────────────────────────────────────────
// Returns the role with its full privilege set (grouped by resource)
router.get('/:id', requirePrivilege('role_record', 'view'), async (req, res, next) => {
  try {
    const [role] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, is_committee, notes, created_at, updated_at FROM roles WHERE id = $1`,
      [req.params.id],
    );
    if (!role) throw AppError('Role not found.', 404);

    const privileges = await tenantQuery(
      req.user.tenantSlug,
      `SELECT pr.id AS resource_id, pr.code, pr.label, pr.actions AS possible_actions,
              COALESCE(
                array_agg(rp.action) FILTER (WHERE rp.action IS NOT NULL),
                '{}'
              ) AS granted_actions
       FROM privilege_resources pr
       LEFT JOIN role_privileges rp ON rp.resource_id = pr.id AND rp.role_id = $1
       GROUP BY pr.id
       ORDER BY pr.label`,
      [req.params.id],
    );

    res.json({ ...role, privileges });
  } catch (err) {
    next(err);
  }
});

// ─── POST /roles ──────────────────────────────────────────────────────────
const createRoleSchema = z.object({
  name:        z.string().min(1).max(100),
  isCommittee: z.boolean().default(false),
  notes:       z.string().optional(),
});

router.post('/', requirePrivilege('role_record', 'create'), async (req, res, next) => {
  try {
    const data = createRoleSchema.parse(req.body);
    const [role] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO roles (name, is_committee, notes)
       VALUES ($1, $2, $3)
       RETURNING id, name, is_committee, notes, created_at`,
      [data.name, data.isCommittee, data.notes ?? null],
    );
    res.status(201).json(role);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /roles/:id ────────────────────────────────────────────────────
const updateRoleSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  isCommittee: z.boolean().optional(),
  notes:       z.string().optional(),
});

router.patch('/:id', requirePrivilege('role_record', 'change'), async (req, res, next) => {
  try {
    const data = updateRoleSchema.parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;

    if (data.name !== undefined)        { fields.push(`name = $${i++}`);         values.push(data.name); }
    if (data.isCommittee !== undefined) { fields.push(`is_committee = $${i++}`); values.push(data.isCommittee); }
    if (data.notes !== undefined)       { fields.push(`notes = $${i++}`);        values.push(data.notes); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);
    values.push(req.params.id);

    const [role] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE roles SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, is_committee, notes`,
      values,
    );
    if (!role) throw AppError('Role not found.', 404);
    res.json(role);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /roles/:id ────────────────────────────────────────────────────
router.delete('/:id', requirePrivilege('role_record', 'delete'), async (req, res, next) => {
  try {
    const [role] = await tenantQuery(
      req.user.tenantSlug,
      `DELETE FROM roles WHERE id = $1 RETURNING id`,
      [req.params.id],
    );
    if (!role) throw AppError('Role not found.', 404);
    res.json({ message: 'Role deleted.' });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /roles/:id/privileges ────────────────────────────────────────────
// Replaces the entire privilege set for a role.
// Expects: { privileges: [{ resourceId, action }] }
// Also invalidates sessions for all users who hold this role.

const setPrivilegesSchema = z.object({
  privileges: z.array(z.object({
    resourceId: z.string(),
    action:     z.string(),
  })),
});

router.put('/:id/privileges', requirePrivilege('role_record', 'change'), async (req, res, next) => {
  try {
    const { privileges } = setPrivilegesSchema.parse(req.body);
    const roleId = req.params.id;
    const slug = req.user.tenantSlug;

    // Verify role exists
    const [role] = await tenantQuery(slug, `SELECT id FROM roles WHERE id = $1`, [roleId]);
    if (!role) throw AppError('Role not found.', 404);

    // Replace all privileges in a single transaction
    await tenantQuery(slug, `DELETE FROM role_privileges WHERE role_id = $1`, [roleId]);

    for (const { resourceId, action } of privileges) {
      await tenantQuery(
        slug,
        `INSERT INTO role_privileges (role_id, resource_id, action) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [roleId, resourceId, action],
      );
    }

    // Invalidate sessions for all users who hold this role
    const affectedUsers = await tenantQuery(
      slug,
      `SELECT user_id FROM user_roles WHERE role_id = $1`,
      [roleId],
    );
    await Promise.all(affectedUsers.map((u) => invalidateUserSessions(slug, u.user_id)));

    res.json({ message: 'Privileges updated.', count: privileges.length });
  } catch (err) {
    next(err);
  }
});

export default router;
