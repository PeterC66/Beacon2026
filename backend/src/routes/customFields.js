// beacon2/backend/src/routes/customFields.js
// Custom field label configuration (doc 8.7).

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

// ─── GET /custom-fields ─────────────────────────────────────────────────
// Returns the 4 custom field labels (empty string or null if not configured).
router.get('/', requirePrivilege('custom_fields', 'view'), async (req, res, next) => {
  try {
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT custom_field_label_1, custom_field_label_2,
              custom_field_label_3, custom_field_label_4
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    res.json({
      label1: row?.custom_field_label_1 ?? '',
      label2: row?.custom_field_label_2 ?? '',
      label3: row?.custom_field_label_3 ?? '',
      label4: row?.custom_field_label_4 ?? '',
    });
  } catch (err) { next(err); }
});

// ─── PATCH /custom-fields ───────────────────────────────────────────────
// Update one or more custom field labels.
const updateSchema = z.object({
  label1: z.string().max(60).nullable().optional(),
  label2: z.string().max(60).nullable().optional(),
  label3: z.string().max(60).nullable().optional(),
  label4: z.string().max(60).nullable().optional(),
});

router.patch('/', requirePrivilege('custom_fields', 'change'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;

    if (data.label1 !== undefined) { fields.push(`custom_field_label_1 = $${i++}`); values.push(data.label1 || null); }
    if (data.label2 !== undefined) { fields.push(`custom_field_label_2 = $${i++}`); values.push(data.label2 || null); }
    if (data.label3 !== undefined) { fields.push(`custom_field_label_3 = $${i++}`); values.push(data.label3 || null); }
    if (data.label4 !== undefined) { fields.push(`custom_field_label_4 = $${i++}`); values.push(data.label4 || null); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push('updated_at = now()');

    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE tenant_settings SET ${fields.join(', ')} WHERE id = 'singleton'
       RETURNING custom_field_label_1, custom_field_label_2,
                 custom_field_label_3, custom_field_label_4`,
      values,
    );

    logAudit(req.user.tenantSlug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'update', entityType: 'setting', entityId: 'singleton',
      entityName: 'Custom field labels',
    });

    res.json({
      label1: row.custom_field_label_1 ?? '',
      label2: row.custom_field_label_2 ?? '',
      label3: row.custom_field_label_3 ?? '',
      label4: row.custom_field_label_4 ?? '',
    });
  } catch (err) { next(err); }
});

export default router;
