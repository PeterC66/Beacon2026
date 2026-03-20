// beacon2/backend/src/routes/systemMessages.js
// CRUD for system message templates (pre-defined auto-sent emails).
// System messages have well-known IDs and are seeded on tenant creation.
// Admins can edit subject/body but not create/delete them.

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

// ─── GET /system-messages ──────────────────────────────────────────────────
router.get('/', requirePrivilege('system_messages', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, subject, body, updated_at FROM system_messages ORDER BY name`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /system-messages/:id ────────────────────────────────────────────
const updateSchema = z.object({
  subject: z.string().optional(),
  body:    z.string().optional(),
});

router.patch('/:id', requirePrivilege('system_messages', 'change'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;

    if (data.subject !== undefined) { fields.push(`subject = $${i++}`); values.push(data.subject); }
    if (data.body    !== undefined) { fields.push(`body = $${i++}`);    values.push(data.body); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);
    values.push(req.params.id);

    const [updated] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE system_messages SET ${fields.join(', ')} WHERE id = $${i++}
       RETURNING id, name, subject, body, updated_at`,
      values,
    );

    if (!updated) return res.status(404).json({ error: 'System message not found.' });

    logAudit(req.user.tenantSlug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'update', entityType: 'system_message',
      entityId: updated.id, entityName: updated.name,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
