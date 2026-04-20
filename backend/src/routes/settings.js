// beacon2/backend/src/routes/settings.js

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { prisma, tenantQuery } from '../utils/db.js';
import { logAudit } from '../utils/audit.js';
import { ALL_FEATURE_KEYS } from '../../../shared/constants.js';

const router = Router();
router.use(requireAuth);

const COLS = `
  card_colour, email_cards, public_phone, public_email, home_page,
  online_join_email, online_renew_email, fee_variation,
  extended_membership_month, advance_renewals_weeks, grace_lapse_weeks,
  deletion_years, default_payment_method,
  gift_aid_online_renewals, default_town, default_county, default_std_code,
  paypal_email, paypal_cancel_url, shared_address_warning,
  year_start_month, year_start_day,
  privacy_policy_url, group_bf_enabled, updated_at
`;

// ─── GET /settings/year-config ────────────────────────────────────────────
// Returns only the year-start fields needed to compute next-renewal dates.
// No privilege required — any authenticated user creating a member needs this.
router.get('/year-config', async (req, res, next) => {
  try {
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT year_start_month, year_start_day, extended_membership_month
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    res.json({
      yearStartMonth:          row?.year_start_month          ?? 1,
      yearStartDay:            row?.year_start_day            ?? 1,
      extendedMembershipMonth: row?.extended_membership_month ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /settings/new-member-defaults ────────────────────────────────────
// Returns default town, county, and STD code for pre-filling the Add New Member form.
// No privilege required — any authenticated user creating a member needs this.
router.get('/new-member-defaults', async (req, res, next) => {
  try {
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT default_town, default_county, default_std_code
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    res.json({
      defaultTown:    row?.default_town    ?? '',
      defaultCounty:  row?.default_county  ?? '',
      defaultStdCode: row?.default_std_code ?? '',
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /settings/custom-field-labels ───────────────────────────────────
// Returns the custom field labels. No special privilege — any authenticated
// user viewing a member record needs these.
router.get('/custom-field-labels', async (req, res, next) => {
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

// ─── GET /settings/home-info ──────────────────────────────────────────────
// Returns data for the Home page bottom panel: tenant name, home page notice,
// and system-wide message. No specific privilege needed — any authenticated user.
router.get('/home-info', async (req, res, next) => {
  try {
    // Tenant display name from sys_tenants
    const tenant = await prisma.sysTenant.findUnique({
      where: { slug: req.user.tenantSlug },
      select: { name: true },
    });
    const tenantName = tenant?.name ?? '';

    // Home page notice from tenant's system_messages
    const [notice] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT body FROM system_messages WHERE id = 'home_page_notice'`,
    );
    const noticeBody = (notice?.body ?? '').replace(/#U3ANAME/g, tenantName);

    // System-wide message from sys_settings (public schema) — use raw SQL
    // because the Prisma client may not have SysSettings generated yet
    let systemMessage = '<<System Message here>>';
    try {
      const sysRows = await prisma.$queryRawUnsafe(
        `SELECT system_message FROM sys_settings WHERE id = 'singleton'`
      );
      if (sysRows[0]) systemMessage = sysRows[0].system_message ?? '';
    } catch {
      // Table may not exist yet on first deploy — use default
    }

    res.json({ tenantName, homeNotice: noticeBody, systemMessage });
  } catch (err) {
    next(err);
  }
});

// ─── GET /settings ────────────────────────────────────────────────────────
router.get('/', requirePrivilege('settings', 'view'), async (req, res, next) => {
  try {
    const [settings] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT ${COLS} FROM tenant_settings WHERE id = 'singleton'`,
    );
    res.json(settings ?? {});
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /settings ──────────────────────────────────────────────────────
const updateSchema = z.object({
  cardColour:               z.string().min(1).optional(),
  emailCards:               z.boolean().optional(),
  publicPhone:              z.string().nullable().optional(),
  publicEmail:              z.string().nullable().optional(),
  homePage:                 z.string().nullable().optional(),
  onlineJoinEmail:          z.string().nullable().optional(),
  onlineRenewEmail:         z.string().nullable().optional(),
  feeVariation:             z.enum(['same_all_year', 'varies_by_month']).optional(),
  extendedMembershipMonth:  z.number().int().min(1).max(12).nullable().optional(),
  advanceRenewalsWeeks:     z.number().int().min(0).max(52).optional(),
  graceLapseWeeks:          z.number().int().min(0).max(52).optional(),
  deletionYears:            z.number().int().min(2).max(7).optional(),
  defaultPaymentMethod:     z.string().min(1).optional(),
  giftAidOnlineRenewals:    z.boolean().optional(),
  defaultTown:              z.string().nullable().optional(),
  defaultCounty:            z.string().nullable().optional(),
  defaultStdCode:           z.string().nullable().optional(),
  paypalEmail:              z.string().nullable().optional(),
  paypalCancelUrl:          z.string().nullable().optional(),
  sharedAddressWarning:     z.boolean().optional(),
  yearStartMonth:           z.number().int().min(1).max(12).optional(),
  yearStartDay:             z.number().int().min(1).max(31).optional(),
  privacyPolicyUrl:         z.string().nullable().optional(),
  groupBfEnabled:           z.boolean().optional(),
});

router.patch('/', requirePrivilege('settings', 'change'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;

    if (data.cardColour              !== undefined) { fields.push(`card_colour = $${i++}`);               values.push(data.cardColour); }
    if (data.emailCards              !== undefined) { fields.push(`email_cards = $${i++}`);               values.push(data.emailCards); }
    if (data.publicPhone             !== undefined) { fields.push(`public_phone = $${i++}`);              values.push(data.publicPhone); }
    if (data.publicEmail             !== undefined) { fields.push(`public_email = $${i++}`);              values.push(data.publicEmail); }
    if (data.homePage                !== undefined) { fields.push(`home_page = $${i++}`);                 values.push(data.homePage); }
    if (data.onlineJoinEmail         !== undefined) { fields.push(`online_join_email = $${i++}`);         values.push(data.onlineJoinEmail); }
    if (data.onlineRenewEmail        !== undefined) { fields.push(`online_renew_email = $${i++}`);        values.push(data.onlineRenewEmail); }
    if (data.feeVariation            !== undefined) { fields.push(`fee_variation = $${i++}`);             values.push(data.feeVariation); }
    if (data.extendedMembershipMonth !== undefined) { fields.push(`extended_membership_month = $${i++}`); values.push(data.extendedMembershipMonth); }
    if (data.advanceRenewalsWeeks    !== undefined) { fields.push(`advance_renewals_weeks = $${i++}`);    values.push(data.advanceRenewalsWeeks); }
    if (data.graceLapseWeeks         !== undefined) { fields.push(`grace_lapse_weeks = $${i++}`);         values.push(data.graceLapseWeeks); }
    if (data.deletionYears           !== undefined) { fields.push(`deletion_years = $${i++}`);            values.push(data.deletionYears); }
    if (data.defaultPaymentMethod    !== undefined) { fields.push(`default_payment_method = $${i++}`);    values.push(data.defaultPaymentMethod); }
    if (data.giftAidOnlineRenewals   !== undefined) { fields.push(`gift_aid_online_renewals = $${i++}`);  values.push(data.giftAidOnlineRenewals); }
    if (data.defaultTown             !== undefined) { fields.push(`default_town = $${i++}`);              values.push(data.defaultTown); }
    if (data.defaultCounty           !== undefined) { fields.push(`default_county = $${i++}`);            values.push(data.defaultCounty); }
    if (data.defaultStdCode          !== undefined) { fields.push(`default_std_code = $${i++}`);          values.push(data.defaultStdCode); }
    if (data.paypalEmail             !== undefined) { fields.push(`paypal_email = $${i++}`);              values.push(data.paypalEmail); }
    if (data.paypalCancelUrl         !== undefined) { fields.push(`paypal_cancel_url = $${i++}`);         values.push(data.paypalCancelUrl); }
    if (data.sharedAddressWarning    !== undefined) { fields.push(`shared_address_warning = $${i++}`);    values.push(data.sharedAddressWarning); }
    if (data.yearStartMonth          !== undefined) { fields.push(`year_start_month = $${i++}`);           values.push(data.yearStartMonth); }
    if (data.yearStartDay            !== undefined) { fields.push(`year_start_day = $${i++}`);             values.push(data.yearStartDay); }
    if (data.privacyPolicyUrl        !== undefined) { fields.push(`privacy_policy_url = $${i++}`);         values.push(data.privacyPolicyUrl); }
    if (data.groupBfEnabled          !== undefined) { fields.push(`group_bf_enabled = $${i++}`);           values.push(data.groupBfEnabled); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);

    const [settings] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE tenant_settings SET ${fields.join(', ')} WHERE id = 'singleton'
       RETURNING ${COLS}`,
      values,
    );
    logAudit(req.user.tenantSlug, { userId: req.user.userId, userName: req.user.name, action: 'update', entityType: 'setting', entityId: 'singleton', entityName: 'System Settings' });
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// ─── Feature configuration ───────────────────────────────────────────

// Keys that only a system admin may change (require external service setup)
const SYS_ADMIN_ONLY_KEYS = ['finance', 'email', 'portal', 'onlineJoining'];

// GET /settings/feature-config — returns current feature toggles.
// No special privilege — any authenticated user needs this to render nav.
router.get('/feature-config', async (req, res, next) => {
  try {
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT feature_config FROM tenant_settings WHERE id = 'singleton'`,
    );
    res.json(row?.feature_config ?? {});
  } catch (err) {
    next(err);
  }
});

// PATCH /settings/feature-config — update feature toggles.
const featureConfigSchema = z.record(z.string(), z.boolean());

router.patch('/feature-config', requirePrivilege('feature_config', 'change'), async (req, res, next) => {
  try {
    const incoming = featureConfigSchema.parse(req.body);
    const isSysAdmin = req.user.isSysAdmin || false;

    // Validate keys and strip sys-admin-only keys for non-sys-admins
    const updates = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (!ALL_FEATURE_KEYS.includes(key)) continue;
      if (SYS_ADMIN_ONLY_KEYS.includes(key) && !isSysAdmin) continue;
      updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    // Merge with existing config (shallow merge — new values override)
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE tenant_settings
       SET feature_config = feature_config || $1::jsonb,
           updated_at = now()
       WHERE id = 'singleton'
       RETURNING feature_config`,
      [JSON.stringify(updates)],
    );

    logAudit(req.user.tenantSlug, {
      userId: req.user.userId,
      userName: req.user.name,
      action: 'update',
      entityType: 'setting',
      entityId: 'singleton',
      entityName: 'Feature Configuration',
      detail: JSON.stringify(updates),
    });

    res.json(row?.feature_config ?? {});
  } catch (err) {
    next(err);
  }
});

export default router;
