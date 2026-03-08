// beacon2/backend/src/routes/memberStatuses.js

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// ─── GET /member-statuses ─────────────────────────────────────────────────
router.get('/', requirePrivilege('member_statuses', 'view'), async (req, res, next) => {
  try {
    const statuses = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, locked, created_at, updated_at
       FROM member_statuses
       ORDER BY locked DESC, name`,  // locked (system) ones first
    );
    res.json(statuses);
  } catch (err) {
    next(err);
  }
});

// ─── POST /member-statuses ────────────────────────────────────────────────
const createSchema = z.object({
  name: z.string().min(1).max(100),
});

router.post('/', requirePrivilege('member_statuses', 'create'), async (req, res, next) => {
  try {
    const { name } = createSchema.parse(req.body);
    const [status] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO member_statuses (name) VALUES ($1)
       RETURNING id, name, locked, created_at`,
      [name],
    );
    res.status(201).json(status);
  } catch (err) {
    if (err.code === '23505') {
      return next(AppError('A status with that name already exists.', 409));
    }
    next(err);
  }
});

// ─── PATCH /member-statuses/:id ───────────────────────────────────────────
const updateSchema = z.object({
  name: z.string().min(1).max(100),
});

router.patch('/:id', requirePrivilege('member_statuses', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(
      slug,
      `SELECT id, locked FROM member_statuses WHERE id = $1`,
      [req.params.id],
    );
    if (!existing) throw AppError('Member status not found.', 404);
    if (existing.locked) throw AppError('This status is locked and cannot be edited.', 409);

    const { name } = updateSchema.parse(req.body);
    const [status] = await tenantQuery(
      slug,
      `UPDATE member_statuses SET name = $1, updated_at = now() WHERE id = $2
       RETURNING id, name, locked`,
      [name, req.params.id],
    );
    res.json(status);
  } catch (err) {
    if (err.code === '23505') {
      return next(AppError('A status with that name already exists.', 409));
    }
    next(err);
  }
});

// ─── DELETE /member-statuses/:id ──────────────────────────────────────────
router.delete('/:id', requirePrivilege('member_statuses', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(
      slug,
      `SELECT id, locked FROM member_statuses WHERE id = $1`,
      [req.params.id],
    );
    if (!existing) throw AppError('Member status not found.', 404);
    if (existing.locked) throw AppError('This status is locked and cannot be deleted.', 409);

    await tenantQuery(slug, `DELETE FROM member_statuses WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Member status deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
