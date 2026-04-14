// beacon2/backend/src/routes/finance/categories.js
// Finance category CRUD.

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

// ─── FINANCE CATEGORIES ───────────────────────────────────────────────────

router.get('/categories', requirePrivilege('finance_categories', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, active, locked, sort_order, created_at
       FROM finance_categories ORDER BY sort_order, name`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

const categorySchema = z.object({
  name:       z.string().min(1).max(100),
  active:     z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

router.post('/categories', requirePrivilege('finance_categories', 'create'), async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO finance_categories (name, active, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, name, active, locked, sort_order`,
      [data.name, data.active ?? true, data.sort_order ?? 0],
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.patch('/categories/:id', requirePrivilege('finance_categories', 'change'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT locked FROM finance_categories WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Category not found.', 404);
    if (current.locked) throw AppError('This category is locked and cannot be changed.', 400);

    const data = categorySchema.partial().parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;
    if (data.name       !== undefined) { fields.push(`name = $${i++}`);       values.push(data.name); }
    if (data.active     !== undefined) { fields.push(`active = $${i++}`);     values.push(data.active); }
    if (data.sort_order !== undefined) { fields.push(`sort_order = $${i++}`); values.push(data.sort_order); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    fields.push(`updated_at = now()`);
    values.push(req.params.id);

    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE finance_categories SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, active, locked, sort_order`,
      values,
    );
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/categories/:id', requirePrivilege('finance_categories', 'delete'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT locked FROM finance_categories WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Category not found.', 404);
    if (current.locked) throw AppError('This category is locked and cannot be deleted.', 400);

    const [used] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT transaction_id FROM transaction_categories WHERE category_id = $1 LIMIT 1`,
      [req.params.id],
    );
    if (used) throw AppError('Cannot delete a category that has transactions. Make it inactive instead.', 400);

    await tenantQuery(req.user.tenantSlug, `DELETE FROM finance_categories WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Category deleted.' });
  } catch (err) { next(err); }
});

export default router;
