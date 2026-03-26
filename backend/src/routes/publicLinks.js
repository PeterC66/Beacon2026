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

// ─── Default config shapes ───────────────────────────────────────────────

const DEFAULT_PORTAL_CONFIG = {
  renewals: false, groups: false, calendar: false,
  personalDetails: false, replacementCard: false,
};

const DEFAULT_GROUP_INFO_CONFIG = {
  status:     { members: false, public: false },
  venue:      { members: false, public: false },
  contact:    { members: false, public: false },
  detail:     { members: false, public: false },
  enquiries:  { members: false, public: false },
  joinGroup:  { members: false, public: false },
};

const DEFAULT_CALENDAR_CONFIG = {
  venue:      { members: false, public: false },
  topic:      { members: false, public: false },
  enquiries:  { members: false, public: false },
  detail:     { members: false, public: false },
  download:   { members: false, public: false },
};

// ─── GET /public-links ────────────────────────────────────────────────────
router.get('/', requirePrivilege('public_links', 'view'), async (req, res, next) => {
  try {
    const [settings] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT online_joining_enabled, privacy_policy_url,
              paypal_email, paypal_cancel_url,
              portal_config, group_info_config, calendar_config
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    res.json({
      onlineJoiningEnabled: settings?.online_joining_enabled ?? false,
      privacyPolicyUrl:     settings?.privacy_policy_url ?? '',
      paypalEmail:          settings?.paypal_email ?? '',
      paypalCancelUrl:      settings?.paypal_cancel_url ?? '',
      portalConfig:         { ...DEFAULT_PORTAL_CONFIG, ...(settings?.portal_config ?? {}) },
      groupInfoConfig:      { ...DEFAULT_GROUP_INFO_CONFIG, ...(settings?.group_info_config ?? {}) },
      calendarConfig:       { ...DEFAULT_CALENDAR_CONFIG, ...(settings?.calendar_config ?? {}) },
      tenantSlug:           req.user.tenantSlug,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /public-links ──────────────────────────────────────────────────

const portalConfigSchema = z.object({
  renewals:        z.boolean().optional(),
  groups:          z.boolean().optional(),
  calendar:        z.boolean().optional(),
  personalDetails: z.boolean().optional(),
  replacementCard: z.boolean().optional(),
}).optional();

const togglePairSchema = z.object({
  members: z.boolean().optional(),
  public:  z.boolean().optional(),
});

const groupInfoConfigSchema = z.object({
  status:    togglePairSchema.optional(),
  venue:     togglePairSchema.optional(),
  contact:   togglePairSchema.optional(),
  detail:    togglePairSchema.optional(),
  enquiries: togglePairSchema.optional(),
  joinGroup: togglePairSchema.optional(),
}).optional();

const calendarConfigSchema = z.object({
  venue:      togglePairSchema.optional(),
  topic:      togglePairSchema.optional(),
  enquiries:  togglePairSchema.optional(),
  detail:     togglePairSchema.optional(),
  download:   togglePairSchema.optional(),
}).optional();

const updateSchema = z.object({
  onlineJoiningEnabled: z.boolean().optional(),
  privacyPolicyUrl:     z.string().nullable().optional(),
  portalConfig:         portalConfigSchema,
  groupInfoConfig:      groupInfoConfigSchema,
  calendarConfig:       calendarConfigSchema,
});

router.patch('/', requirePrivilege('public_links', 'change'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;

    if (data.onlineJoiningEnabled !== undefined) { fields.push(`online_joining_enabled = $${i++}`); values.push(data.onlineJoiningEnabled); }
    if (data.privacyPolicyUrl     !== undefined) { fields.push(`privacy_policy_url = $${i++}`);     values.push(data.privacyPolicyUrl); }
    if (data.portalConfig         !== undefined) { fields.push(`portal_config = $${i++}::jsonb`);   values.push(JSON.stringify(data.portalConfig)); }
    if (data.groupInfoConfig      !== undefined) { fields.push(`group_info_config = $${i++}::jsonb`); values.push(JSON.stringify(data.groupInfoConfig)); }
    if (data.calendarConfig       !== undefined) { fields.push(`calendar_config = $${i++}::jsonb`); values.push(JSON.stringify(data.calendarConfig)); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);

    const [updated] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE tenant_settings SET ${fields.join(', ')} WHERE id = 'singleton'
       RETURNING online_joining_enabled, privacy_policy_url,
                 portal_config, group_info_config, calendar_config`,
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
      portalConfig:         { ...DEFAULT_PORTAL_CONFIG, ...(updated.portal_config ?? {}) },
      groupInfoConfig:      { ...DEFAULT_GROUP_INFO_CONFIG, ...(updated.group_info_config ?? {}) },
      calendarConfig:       { ...DEFAULT_CALENDAR_CONFIG, ...(updated.calendar_config ?? {}) },
      tenantSlug:           req.user.tenantSlug,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
