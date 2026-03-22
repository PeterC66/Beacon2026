// beacon2/backend/src/routes/users.js

import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { hashPassword } from '../utils/password.js';
import { AppError } from '../middleware/errorHandler.js';
import { invalidateUserSessions } from '../utils/redis.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// All user routes require authentication
router.use(requireAuth);

// ─── GET /users/available-members ──────────────────────────────────────
// Returns current members available to be linked as system users.
router.get('/available-members', requirePrivilege('user_record', 'create'), async (req, res, next) => {
  try {
    const members = await tenantQuery(
      req.user.tenantSlug,
      `SELECT m.id, m.forenames, m.surname, m.email, ms.name AS status_name
       FROM members m
       JOIN member_statuses ms ON ms.id = m.status_id
       WHERE ms.name = 'Current'
       ORDER BY m.surname, m.forenames`,
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─── GET /users ───────────────────────────────────────────────────────────
router.get('/', requirePrivilege('users_list', 'view'), async (req, res, next) => {
  try {
    const users = await tenantQuery(
      req.user.tenantSlug,
      `SELECT u.id, u.email, u.username, u.name, u.active,
              u.is_site_admin, u.created_at, u.last_login,
              u.member_id,
              m.forenames || ' ' || m.surname AS member_name,
              ms.name AS member_status,
              COALESCE(
                json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) AS roles
       FROM users u
       LEFT JOIN members m ON m.id = u.member_id
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id, m.forenames, m.surname, ms.name
       ORDER BY u.name`,
    );
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ─── GET /users/:id ───────────────────────────────────────────────────────
router.get('/:id', requirePrivilege('user_record', 'view'), async (req, res, next) => {
  try {
    const [user] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT u.id, u.email, u.username, u.name, u.active,
              u.is_site_admin, u.created_at, u.updated_at, u.last_login,
              u.member_id,
              m.forenames || ' ' || m.surname AS member_name,
              COALESCE(
                json_agg(json_build_object('id', r.id, 'name', r.name, 'is_committee', r.is_committee))
                  FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) AS roles
       FROM users u
       LEFT JOIN members m ON m.id = u.member_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id, m.forenames, m.surname`,
      [req.params.id],
    );
    if (!user) throw AppError('User not found.', 404);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ─── POST /users ──────────────────────────────────────────────────────────
const createUserSchema = z.object({
  memberId: z.string().min(1, 'Member selection is required'),
  username: z.string().regex(/^[a-z0-9]+$/, 'Username must be lowercase letters and numbers only'),
  email:    z.string().email().optional(),
  active:   z.boolean().default(true),
  roleIds:  z.array(z.string()).default([]),
});

router.post('/', requirePrivilege('user_record', 'create'), async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Verify the member exists and is current
    const [member] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT m.id, m.forenames, m.surname, m.email,
              ms.name AS status_name
       FROM members m
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       WHERE m.id = $1`,
      [data.memberId],
    );
    if (!member) throw AppError('Selected member not found.', 404);

    // Verify member is not already a system user
    const [existing] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id FROM users WHERE member_id = $1`,
      [data.memberId],
    );
    if (existing) throw AppError('This member is already a system user.', 400);

    // Use member's email if not provided
    const email = data.email || member.email;
    if (!email) throw AppError('Member has no email address. Please provide one.', 400);

    // Generate a random temporary password
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const name = `${member.forenames} ${member.surname}`;

    const [user] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO users (email, username, name, password_hash, active, member_id, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, email, username, name, active, created_at, member_id`,
      [email.toLowerCase(), data.username, name, passwordHash, data.active, data.memberId],
    );

    // Assign roles if provided
    for (const roleId of data.roleIds) {
      await tenantQuery(
        req.user.tenantSlug,
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user.id, roleId],
      );
    }

    logAudit(req.user.tenantSlug, { userId: req.user.userId, userName: req.user.name, action: 'create', entityType: 'user', entityId: user.id, entityName: user.name });
    res.status(201).json({ ...user, tempPassword });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /users/:id ────────────────────────────────────────────────────
const updateUserSchema = z.object({
  email:    z.string().email().optional(),
  username: z.string().regex(/^[a-z0-9]+$/, 'Username must be lowercase letters and numbers only').nullable().optional(),
  name:     z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  active:   z.boolean().optional(),
  memberId: z.string().nullable().optional(),
});

router.patch('/:id', requirePrivilege('user_record', 'change'), async (req, res, next) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;

    if (data.email)    { fields.push(`email = $${i++}`);         values.push(data.email.toLowerCase()); }
    if (data.username !== undefined) { fields.push(`username = $${i++}`); values.push(data.username); }
    if (data.name)     { fields.push(`name = $${i++}`);          values.push(data.name); }
    if (data.password) { fields.push(`password_hash = $${i++}`); values.push(await hashPassword(data.password)); }
    if (data.active !== undefined) { fields.push(`active = $${i++}`); values.push(data.active); }
    if (data.memberId !== undefined) { fields.push(`member_id = $${i++}`); values.push(data.memberId); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);
    values.push(req.params.id);

    const [user] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, email, username, name, active, member_id`,
      values,
    );
    if (!user) throw AppError('User not found.', 404);

    // If password changed, invalidate existing sessions
    if (data.password) {
      await invalidateUserSessions(req.user.tenantSlug, req.params.id);
    }

    logAudit(req.user.tenantSlug, { userId: req.user.userId, userName: req.user.name, action: 'update', entityType: 'user', entityId: user.id, entityName: user.name });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ─── POST /users/:id/set-temp-password ──────────────────────────────────
router.post('/:id/set-temp-password', requirePrivilege('user_record', 'change'), async (req, res, next) => {
  try {
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);

    const [user] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = now() WHERE id = $2 RETURNING id, name`,
      [hash, req.params.id],
    );
    if (!user) throw AppError('User not found.', 404);

    await invalidateUserSessions(req.user.tenantSlug, req.params.id);
    logAudit(req.user.tenantSlug, { userId: req.user.userId, userName: req.user.name, action: 'set_temp_password', entityType: 'user', entityId: user.id, entityName: user.name });

    res.json({ tempPassword });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /users/:id ────────────────────────────────────────────────────
router.delete('/:id', requirePrivilege('user_record', 'delete'), async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.userId) {
      throw AppError('You cannot delete your own account.', 400);
    }

    // Prevent deleting the site administrator
    const [target] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT is_site_admin FROM users WHERE id = $1`,
      [req.params.id],
    );
    if (target?.is_site_admin) {
      throw AppError('The Site Administrator cannot be deleted.', 400);
    }

    // Prevent deleting the last user who has the Administration role
    const [adminInfo] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT
        (SELECT COUNT(*) FROM user_roles ur JOIN roles r ON ur.role_id = r.id
         WHERE r.name = 'Administration') AS total_admins,
        (SELECT COUNT(*) FROM user_roles ur JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND r.name = 'Administration') AS is_admin`,
      [req.params.id],
    );
    if (parseInt(adminInfo?.is_admin || 0) > 0 && parseInt(adminInfo?.total_admins || 0) <= 1) {
      throw AppError('Cannot delete the last user with the Administration role. Assign the role to another user first.', 400);
    }

    await invalidateUserSessions(req.user.tenantSlug, req.params.id);

    const [user] = await tenantQuery(
      req.user.tenantSlug,
      `DELETE FROM users WHERE id = $1 RETURNING id, name`,
      [req.params.id],
    );
    if (!user) throw AppError('User not found.', 404);

    logAudit(req.user.tenantSlug, { userId: req.user.userId, userName: req.user.name, action: 'delete', entityType: 'user', entityId: user.id, entityName: user.name });
    res.json({ message: 'User deleted.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /users/:id/roles ────────────────────────────────────────────────
router.post('/:id/roles', requirePrivilege('user_record', 'change'), async (req, res, next) => {
  try {
    const { roleId } = z.object({ roleId: z.string() }).parse(req.body);
    await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, roleId],
    );
    await invalidateUserSessions(req.user.tenantSlug, req.params.id);
    res.json({ message: 'Role assigned.' });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /users/:id/roles/:roleId ─────────────────────────────────────
router.delete('/:id/roles/:roleId', requirePrivilege('user_record', 'change'), async (req, res, next) => {
  try {
    await tenantQuery(
      req.user.tenantSlug,
      `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
      [req.params.id, req.params.roleId],
    );
    await invalidateUserSessions(req.user.tenantSlug, req.params.id);
    res.json({ message: 'Role removed.' });
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Generate a random temporary password like "!xZ#8kP2" */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

export default router;
