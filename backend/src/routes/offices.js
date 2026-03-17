// beacon2/backend/src/routes/offices.js
// u3a Officers (offices and post holders) — doc 9.3

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// ─── GET /offices ─────────────────────────────────────────────────────────
// Returns all offices with post-holder name and member status (for red/strikethrough).

router.get('/', requirePrivilege('offices', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT o.id, o.name, o.member_id, o.office_email, o.notify_online_join,
              m.forenames AS member_forenames, m.surname AS member_surname,
              ms.name AS member_status
       FROM offices o
       LEFT JOIN members          m  ON m.id  = o.member_id
       LEFT JOIN member_statuses  ms ON ms.id = m.status_id
       ORDER BY o.name`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── GET /offices/members ─────────────────────────────────────────────────
// Returns a lightweight member list (id, forenames, surname) for the post-holder
// drop-down. Only current members are shown by default.

router.get('/members', requirePrivilege('offices', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT m.id, m.forenames, m.surname, ms.name AS status
       FROM members m
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       ORDER BY m.surname, m.forenames`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── POST /offices ────────────────────────────────────────────────────────

const officeSchema = z.object({
  name:             z.string().min(1).max(100),
  memberId:         z.string().min(1).nullable().optional(),
  officeEmail:      z.string().email().nullable().optional().or(z.literal('')),
  notifyOnlineJoin: z.boolean().default(false),
});

router.post('/', requirePrivilege('offices', 'create'), async (req, res, next) => {
  try {
    const data = officeSchema.parse(req.body);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO offices (name, member_id, office_email, notify_online_join)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, member_id, office_email, notify_online_join`,
      [data.name, data.memberId ?? null, data.officeEmail || null, data.notifyOnlineJoin],
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ─── PATCH /offices/:id ───────────────────────────────────────────────────

router.patch('/:id', requirePrivilege('offices', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id FROM offices WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Office not found.', 404);

    const data = officeSchema.parse(req.body);
    const [row] = await tenantQuery(
      slug,
      `UPDATE offices SET name = $1, member_id = $2, office_email = $3,
              notify_online_join = $4, updated_at = now()
       WHERE id = $5
       RETURNING id, name, member_id, office_email, notify_online_join`,
      [data.name, data.memberId ?? null, data.officeEmail || null, data.notifyOnlineJoin, req.params.id],
    );
    res.json(row);
  } catch (err) { next(err); }
});

// ─── DELETE /offices/:id ──────────────────────────────────────────────────

router.delete('/:id', requirePrivilege('offices', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id FROM offices WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Office not found.', 404);
    await tenantQuery(slug, `DELETE FROM offices WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Office deleted.' });
  } catch (err) { next(err); }
});

export default router;
