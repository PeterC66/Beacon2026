// beacon2/backend/src/routes/users.js

import { Router } from 'express';
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

// ─── GET /users ───────────────────────────────────────────────────────────
router.get('/', requirePrivilege('users_list', 'view'), async (req, res, next) => {
  try {
    const users = await tenantQuery(
      req.user.tenantSlug,
      `SELECT u.id, u.email, u.username, u.name, u.active, u.created_at, u.last_login,
              COALESCE(
                json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id
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
      `SELECT u.id, u.email, u.username, u.name, u.active, u.created_at, u.updated_at, u.last_login,
              COALESCE(
                json_agg(json_build_object('id', r.id, 'name', r.name, 'is_committee', r.is_committee))
                  FILTER (WHERE r.id IS NOT NULL),
                '[]'
              ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id`,
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
  email:    z.string().email(),
  username: z.string().regex(/^[a-z0-9]+$/, 'Username must be lowercase letters and numbers only').optional(),
  name:     z.string().min(1),
  password: z.string().min(8).optional(),
  active:   z.boolean().default(true),
  roleIds:  z.array(z.string()).default([]),
});

router.post('/', requirePrivilege('user_record', 'create'), async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const passwordHash = data.password ? await hashPassword(data.password) : null;

    const [user] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO users (email, username, name, password_hash, active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, username, name, active, created_at`,
      [data.email.toLowerCase(), data.username ?? null, data.name, passwordHash, data.active],
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
    res.status(201).json(user);
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

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);
    values.push(req.params.id);

    const [user] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, email, username, name, active`,
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

// ─── DELETE /users/:id ────────────────────────────────────────────────────
router.delete('/:id', requirePrivilege('user_record', 'delete'), async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.userId) {
      throw AppError('You cannot delete your own account.', 400);
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

export default router;
