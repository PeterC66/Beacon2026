// beacon2/backend/src/routes/faculties.js

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);
router.use(requireFeature('faculties'));

// ─── GET /faculties ───────────────────────────────────────────────────────
router.get('/', requirePrivilege('group_faculties', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, created_at, updated_at FROM faculties ORDER BY name`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── POST /faculties ──────────────────────────────────────────────────────
const createSchema = z.object({ name: z.string().min(1).max(100) });

router.post('/', requirePrivilege('group_faculties', 'create'), async (req, res, next) => {
  try {
    const { name } = createSchema.parse(req.body);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO faculties (name) VALUES ($1) RETURNING id, name, created_at`,
      [name],
    );
    res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') {
      return next(AppError('A faculty with that name already exists.', 409));
    }
    next(err);
  }
});

// ─── PATCH /faculties/:id ─────────────────────────────────────────────────
const updateSchema = z.object({ name: z.string().min(1).max(100) });

router.patch('/:id', requirePrivilege('group_faculties', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id FROM faculties WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Faculty not found.', 404);

    const { name } = updateSchema.parse(req.body);
    const [row] = await tenantQuery(
      slug,
      `UPDATE faculties SET name = $1, updated_at = now() WHERE id = $2 RETURNING id, name`,
      [name, req.params.id],
    );
    res.json(row);
  } catch (err) {
    if (err.code === '23505') {
      return next(AppError('A faculty with that name already exists.', 409));
    }
    next(err);
  }
});

// ─── DELETE /faculties/:id ────────────────────────────────────────────────
router.delete('/:id', requirePrivilege('group_faculties', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id FROM faculties WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Faculty not found.', 404);

    await tenantQuery(slug, `DELETE FROM faculties WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Faculty deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
