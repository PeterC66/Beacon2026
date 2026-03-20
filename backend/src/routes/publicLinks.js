// beacon2/backend/src/routes/publicLinks.js
// Admin page for viewing/configuring public links and online joining settings.

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

// ─── GET /public-links ────────────────────────────────────────────────────
router.get('/', requirePrivilege('public_links', 'view'), async (req, res, next) => {
  try {
    const [settings] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT online_joining_enabled, privacy_policy_url,
              paypal_email, paypal_cancel_url
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    res.json({
      onlineJoiningEnabled: settings?.online_joining_enabled ?? false,
      privacyPolicyUrl:     settings?.privacy_policy_url ?? '',
      paypalEmail:          settings?.paypal_email ?? '',
      paypalCancelUrl:      settings?.paypal_cancel_url ?? '',
      tenantSlug:           req.user.tenantSlug,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /public-links ──────────────────────────────────────────────────
const updateSchema = z.object({
  onlineJoiningEnabled: z.boolean().optional(),
  privacyPolicyUrl:     z.string().nullable().optional(),
});

router.patch('/', requirePrivilege('public_links', 'change'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;

    if (data.onlineJoiningEnabled !== undefined) { fields.push(`online_joining_enabled = $${i++}`); values.push(data.onlineJoiningEnabled); }
    if (data.privacyPolicyUrl     !== undefined) { fields.push(`privacy_policy_url = $${i++}`);     values.push(data.privacyPolicyUrl); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);

    const [updated] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE tenant_settings SET ${fields.join(', ')} WHERE id = 'singleton'
       RETURNING online_joining_enabled, privacy_policy_url`,
      values,
    );

    logAudit(req.user.tenantSlug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'update', entityType: 'setting',
      entityId: 'singleton', entityName: 'Public Links',
    });

    res.json({
      onlineJoiningEnabled: updated.online_joining_enabled,
      privacyPolicyUrl:     updated.privacy_policy_url,
      tenantSlug:           req.user.tenantSlug,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
