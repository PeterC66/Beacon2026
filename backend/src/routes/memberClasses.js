// beacon2/backend/src/routes/memberClasses.js

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// ─── GET /member-classes ──────────────────────────────────────────────────
router.get('/', requirePrivilege('member_classes', 'view'), async (req, res, next) => {
  try {
    const classes = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, current, explanation, is_joint, is_associate, show_online,
              fee, gift_aid_fee, locked, created_at, updated_at
       FROM member_classes
       ORDER BY name`,
    );
    res.json(classes);
  } catch (err) {
    next(err);
  }
});

// ─── GET /member-classes/:id ──────────────────────────────────────────────
router.get('/:id', requirePrivilege('member_classes', 'view'), async (req, res, next) => {
  try {
    const [mc] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, current, explanation, is_joint, is_associate, show_online,
              fee, gift_aid_fee, locked, created_at, updated_at
       FROM member_classes WHERE id = $1`,
      [req.params.id],
    );
    if (!mc) throw AppError('Membership class not found.', 404);
    res.json(mc);
  } catch (err) {
    next(err);
  }
});

// ─── POST /member-classes ─────────────────────────────────────────────────
const createSchema = z.object({
  name:        z.string().min(1).max(100),
  current:     z.boolean().default(true),
  explanation: z.string().optional(),
  isJoint:     z.boolean().default(false),
  isAssociate: z.boolean().default(false),
  showOnline:  z.boolean().default(false),
  fee:         z.number().nonnegative().optional(),
  giftAidFee:  z.number().nonnegative().optional(),
});

router.post('/', requirePrivilege('member_classes', 'create'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const [mc] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO member_classes
         (name, current, explanation, is_joint, is_associate, show_online, fee, gift_aid_fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, current, explanation, is_joint, is_associate, show_online,
                 fee, gift_aid_fee, locked, created_at`,
      [
        data.name,
        data.current,
        data.explanation ?? null,
        data.isJoint,
        data.isAssociate,
        data.showOnline,
        data.fee ?? null,
        data.giftAidFee ?? null,
      ],
    );
    res.status(201).json(mc);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /member-classes/:id ────────────────────────────────────────────
const updateSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  current:     z.boolean().optional(),
  explanation: z.string().optional(),
  isJoint:     z.boolean().optional(),
  isAssociate: z.boolean().optional(),
  showOnline:  z.boolean().optional(),
  fee:         z.number().nonnegative().nullable().optional(),
  giftAidFee:  z.number().nonnegative().nullable().optional(),
});

router.patch('/:id', requirePrivilege('member_classes', 'change'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;

    if (data.name        !== undefined) { fields.push(`name = $${i++}`);         values.push(data.name); }
    if (data.current     !== undefined) { fields.push(`current = $${i++}`);      values.push(data.current); }
    if (data.explanation !== undefined) { fields.push(`explanation = $${i++}`);  values.push(data.explanation); }
    if (data.isJoint     !== undefined) { fields.push(`is_joint = $${i++}`);     values.push(data.isJoint); }
    if (data.isAssociate !== undefined) { fields.push(`is_associate = $${i++}`); values.push(data.isAssociate); }
    if (data.showOnline  !== undefined) { fields.push(`show_online = $${i++}`);  values.push(data.showOnline); }
    if (data.fee         !== undefined) { fields.push(`fee = $${i++}`);          values.push(data.fee); }
    if (data.giftAidFee  !== undefined) { fields.push(`gift_aid_fee = $${i++}`); values.push(data.giftAidFee); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);
    values.push(req.params.id);

    const [mc] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE member_classes SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, name, current, explanation, is_joint, is_associate, show_online,
                 fee, gift_aid_fee, locked`,
      values,
    );
    if (!mc) throw AppError('Membership class not found.', 404);
    res.json(mc);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /member-classes/:id ───────────────────────────────────────────
router.delete('/:id', requirePrivilege('member_classes', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [mc] = await tenantQuery(
      slug,
      `SELECT id, locked FROM member_classes WHERE id = $1`,
      [req.params.id],
    );
    if (!mc) throw AppError('Membership class not found.', 404);
    if (mc.locked) throw AppError('This membership class is locked and cannot be deleted.', 409);

    const [usage] = await tenantQuery(slug, `SELECT COUNT(*)::int AS n FROM members WHERE class_id = $1`, [req.params.id]);
    if (usage.n > 0) throw AppError(
      `Cannot delete — ${usage.n} member${usage.n === 1 ? ' is' : 's are'} assigned to this class. Make it non-current instead.`,
      409,
    );

    await tenantQuery(slug, `DELETE FROM member_classes WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Membership class deleted.' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /member-classes/:id/monthly-fees ─────────────────────────────────
router.get('/:id/monthly-fees', requirePrivilege('member_classes', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT month_index, fee::float AS fee, gift_aid_fee::float AS gift_aid_fee
       FROM class_monthly_fees WHERE class_id = $1
       ORDER BY month_index`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /member-classes/:id/monthly-fees ─────────────────────────────────
const monthlyFeesSchema = z.object({
  fees: z.array(z.object({
    monthIndex:  z.number().int().min(1).max(13),
    fee:         z.number().nonnegative().nullable(),
    giftAidFee:  z.number().nonnegative().nullable(),
  })).length(13),
});

router.put('/:id/monthly-fees', requirePrivilege('member_classes', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = monthlyFeesSchema.parse(req.body);
    // Upsert all 13 rows
    for (const row of data.fees) {
      await tenantQuery(
        slug,
        `INSERT INTO class_monthly_fees (class_id, month_index, fee, gift_aid_fee)
         VALUES ($1, $2, $3::numeric, $4::numeric)
         ON CONFLICT (class_id, month_index) DO UPDATE
           SET fee = EXCLUDED.fee, gift_aid_fee = EXCLUDED.gift_aid_fee`,
        [req.params.id, row.monthIndex, row.fee, row.giftAidFee],
      );
    }
    res.json({ message: 'Monthly fees saved.' });
  } catch (err) {
    next(err);
  }
});

export default router;
