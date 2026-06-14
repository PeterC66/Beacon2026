// beacon2/backend/src/routes/backup/export.js
// Data export (doc 9.5) — 8 Excel options, tenant-scoped.

import { Router } from 'express';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery, prisma } from '../../utils/db.js';
import ExcelJS from 'exceljs';
import { sanitizeCell } from '../../utils/spreadsheet.js';
import { str } from './helpers.js';

const router = Router();

// ── Export: cell formatters ────────────────────────────────────────────────────

export function dateToStr(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10) || null;
}

export function boolInt(v) {
  return v ? 1 : 0;
}

/** Add a styled worksheet with given column keys and data rows */
export function addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({
    header: c,
    key: c,
    width: Math.max(14, c.length + 2),
  }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' },
  };
  rows.forEach((r) => {
    const rowData = {};
    columns.forEach((c) => {
      rowData[c] = sanitizeCell(r[c] ?? null);
    });
    ws.addRow(rowData);
  });
  return ws;
}

// ── Export: sheet builders ─────────────────────────────────────────────────────

export async function buildMembersSheet(wb, slug) {
  const rows = await tenantQuery(
    slug,
    `
    SELECT m.id, m.membership_number, m.title, m.forenames, m.surname, m.suffix,
           m.known_as, m.initials, m.mobile, m.email, m.home_u3a,
           m.joined_on, m.next_renewal, m.gift_aid_from, m.notes, m.hide_contact,
           m.emergency_contact,
           m.custom_field_1, m.custom_field_2, m.custom_field_3, m.custom_field_4,
           m.status_id, s.name AS status_name,
           m.class_id, c.name AS class_name,
           m.partner_id,
           m.address_id, a.house_no, a.street, a.add_line1, a.add_line2,
           a.town, a.county, a.postcode, a.telephone
    FROM members m
    LEFT JOIN member_statuses s ON m.status_id = s.id
    LEFT JOIN member_classes  c ON m.class_id  = c.id
    LEFT JOIN addresses       a ON m.address_id = a.id
    ORDER BY m.surname, m.forenames
  `,
  );

  addSheet(
    wb,
    'Members',
    [
      'id',
      'membership_number',
      'title',
      'forenames',
      'surname',
      'suffix',
      'known_as',
      'initials',
      'mobile',
      'email',
      'home_u3a',
      'joined_on',
      'next_renewal',
      'gift_aid_from',
      'notes',
      'hide_contact',
      'emergency_contact',
      'custom_field_1',
      'custom_field_2',
      'custom_field_3',
      'custom_field_4',
      'status_id',
      'status_name',
      'class_id',
      'class_name',
      'partner_id',
      'address_id',
      'house_no',
      'street',
      'add_line1',
      'add_line2',
      'town',
      'county',
      'postcode',
      'telephone',
    ],
    rows.map((r) => ({
      ...r,
      joined_on: dateToStr(r.joined_on),
      next_renewal: dateToStr(r.next_renewal),
      gift_aid_from: dateToStr(r.gift_aid_from),
      hide_contact: boolInt(r.hide_contact),
    })),
  );
}

export async function buildFinanceSheets(wb, slug) {
  const [txns, cats, batches] = await Promise.all([
    tenantQuery(
      slug,
      `
      SELECT t.id, t.transaction_number, t.date, t.type, t.from_to, t.amount,
             t.payment_method, t.payment_ref, t.detail, t.remarks, t.cleared_at,
             t.account_id, a.name AS account_name,
             t.member_id_1, t.member_id_2, t.group_id, t.event_id,
             t.transfer_id, t.pending, t.batch_id,
             t.gift_aid_amount, t.gift_aid_claimed_at,
             t.gift_aid_amount_2, t.gift_aid_claimed_at_2,
             t.refund_of_id, t.refunded_by_id
      FROM transactions t
      LEFT JOIN finance_accounts a ON t.account_id = a.id
      ORDER BY t.date, t.transaction_number
    `,
    ),
    tenantQuery(
      slug,
      `
      SELECT tc.transaction_id, tc.category_id, c.name AS category_name, tc.amount
      FROM transaction_categories tc
      LEFT JOIN finance_categories c ON tc.category_id = c.id
      ORDER BY tc.transaction_id
    `,
    ),
    tenantQuery(
      slug,
      `
      SELECT cb.id, cb.batch_ref, cb.account_id, a.name AS account_name,
             cb.description, cb.batch_date
      FROM credit_batches cb
      LEFT JOIN finance_accounts a ON cb.account_id = a.id
      ORDER BY cb.batch_ref
    `,
    ),
  ]);

  addSheet(
    wb,
    'Ledger',
    [
      'id',
      'transaction_number',
      'date',
      'type',
      'from_to',
      'amount',
      'payment_method',
      'payment_ref',
      'detail',
      'remarks',
      'cleared_at',
      'account_id',
      'account_name',
      'member_id_1',
      'member_id_2',
      'group_id',
      'event_id',
      'transfer_id',
      'pending',
      'batch_id',
      'gift_aid_amount',
      'gift_aid_claimed_at',
      'gift_aid_amount_2',
      'gift_aid_claimed_at_2',
      'refund_of_id',
      'refunded_by_id',
    ],
    txns.map((r) => ({
      ...r,
      date: dateToStr(r.date),
      cleared_at: dateToStr(r.cleared_at),
      amount: r.amount != null ? Number(r.amount) : null,
      pending: boolInt(r.pending),
      gift_aid_amount: r.gift_aid_amount != null ? Number(r.gift_aid_amount) : null,
      gift_aid_claimed_at: dateToStr(r.gift_aid_claimed_at),
      gift_aid_amount_2: r.gift_aid_amount_2 != null ? Number(r.gift_aid_amount_2) : null,
      gift_aid_claimed_at_2: dateToStr(r.gift_aid_claimed_at_2),
    })),
  );

  addSheet(
    wb,
    'Detail',
    ['transaction_id', 'category_id', 'category_name', 'amount'],
    cats.map((r) => ({ ...r, amount: r.amount != null ? Number(r.amount) : null })),
  );

  addSheet(
    wb,
    'Credit Batches',
    ['id', 'batch_ref', 'account_id', 'account_name', 'description', 'batch_date'],
    batches.map((r) => ({ ...r, batch_date: dateToStr(r.batch_date) })),
  );
}

export async function buildGroupsSheets(wb, slug) {
  const [groups, gm, faculties, venues, gle, events, eventTypes, eventMembers] = await Promise.all([
    tenantQuery(
      slug,
      `
      SELECT g.id, g.name, g.short_name, g.type, g.faculty_id, f.name AS faculty_name, g.status,
             g.when_text,
             g.start_time::text AS start_time, g.end_time::text AS end_time,
             g.venue, g.venue_id, g.enquiries, g.max_members,
             g.allow_online_join, g.enable_waiting_list, g.notify_leader,
             g.display_waiting_list, g.information, g.notes, g.show_addresses
      FROM groups g
      LEFT JOIN faculties f ON g.faculty_id = f.id
      ORDER BY g.name
    `,
    ),
    tenantQuery(
      slug,
      `
      SELECT gm.id, gm.group_id, g.name AS group_name,
             gm.member_id, m.membership_number, m.forenames, m.surname,
             gm.is_leader, gm.waiting_since
      FROM group_members gm
      JOIN groups  g ON gm.group_id  = g.id
      JOIN members m ON gm.member_id = m.id
      ORDER BY g.name, m.surname, m.forenames
    `,
    ),
    tenantQuery(slug, `SELECT id, name FROM faculties ORDER BY name`),
    tenantQuery(
      slug,
      `
      SELECT id, name, address, postcode, telephone, contact, email, website,
             notes, private_address, accessible
      FROM venues ORDER BY name
    `,
    ),
    tenantQuery(
      slug,
      `
      SELECT gle.id, gle.group_id, g.name AS group_name,
             gle.entry_date, gle.payee, gle.detail, gle.money_in, gle.money_out
      FROM group_ledger_entries gle
      JOIN groups g ON gle.group_id = g.id
      ORDER BY g.name, gle.entry_date
    `,
    ),
    tenantQuery(
      slug,
      `
      SELECT ge.id, ge.group_id, g.name AS group_name,
             ge.event_date, ge.start_time::text AS start_time,
             ge.end_time::text AS end_time,
             ge.venue_id, v.name AS venue_name,
             ge.event_type_id, et.name AS event_type_name,
             ge.contact, ge.details, ge.topic, ge.is_private
      FROM group_events ge
      LEFT JOIN groups g ON ge.group_id = g.id
      LEFT JOIN venues v ON ge.venue_id = v.id
      LEFT JOIN event_types et ON ge.event_type_id = et.id
      ORDER BY ge.event_date, ge.start_time
    `,
    ),
    tenantQuery(
      slug,
      `
      SELECT id, name, description, is_default FROM event_types ORDER BY is_default DESC, name
    `,
    ),
    tenantQuery(
      slug,
      `
      SELECT em.id, em.event_id, em.member_id,
             m.membership_number, m.forenames, m.surname,
             em.is_organiser, em.notes
      FROM event_members em
      JOIN members m ON em.member_id = m.id
      ORDER BY em.event_id, m.surname, m.forenames
    `,
    ),
  ]);

  addSheet(
    wb,
    'Groups',
    [
      'id',
      'name',
      'short_name',
      'type',
      'faculty_id',
      'faculty_name',
      'status',
      'when_text',
      'start_time',
      'end_time',
      'venue',
      'venue_id',
      'enquiries',
      'max_members',
      'allow_online_join',
      'enable_waiting_list',
      'notify_leader',
      'display_waiting_list',
      'information',
      'notes',
      'show_addresses',
    ],
    groups.map((r) => ({
      ...r,
      allow_online_join: boolInt(r.allow_online_join),
      enable_waiting_list: boolInt(r.enable_waiting_list),
      notify_leader: boolInt(r.notify_leader),
      display_waiting_list: boolInt(r.display_waiting_list),
      show_addresses: boolInt(r.show_addresses),
    })),
  );

  addSheet(
    wb,
    'Group members',
    [
      'id',
      'group_id',
      'group_name',
      'member_id',
      'membership_number',
      'forenames',
      'surname',
      'is_leader',
      'waiting_since',
    ],
    gm.map((r) => ({
      ...r,
      is_leader: boolInt(r.is_leader),
      waiting_since: dateToStr(r.waiting_since),
    })),
  );

  addSheet(
    wb,
    'Venues',
    [
      'id',
      'name',
      'address',
      'postcode',
      'telephone',
      'contact',
      'email',
      'website',
      'notes',
      'private_address',
      'accessible',
    ],
    venues.map((r) => ({
      ...r,
      private_address: boolInt(r.private_address),
      accessible: boolInt(r.accessible),
    })),
  );

  addSheet(
    wb,
    'Group Ledgers',
    ['id', 'group_id', 'group_name', 'entry_date', 'payee', 'detail', 'money_in', 'money_out'],
    gle.map((r) => ({
      ...r,
      entry_date: dateToStr(r.entry_date),
      money_in: r.money_in != null ? Number(r.money_in) : null,
      money_out: r.money_out != null ? Number(r.money_out) : null,
    })),
  );

  addSheet(wb, 'Faculties', ['id', 'name'], faculties);

  addSheet(
    wb,
    'Event Types',
    ['id', 'name', 'description', 'is_default'],
    eventTypes.map((r) => ({
      ...r,
      is_default: boolInt(r.is_default),
    })),
  );

  addSheet(
    wb,
    'Group Events',
    [
      'id',
      'group_id',
      'group_name',
      'event_date',
      'start_time',
      'end_time',
      'venue_id',
      'venue_name',
      'event_type_id',
      'event_type_name',
      'contact',
      'details',
      'topic',
      'is_private',
    ],
    events.map((r) => ({
      ...r,
      event_date: dateToStr(r.event_date),
      is_private: boolInt(r.is_private),
    })),
  );

  addSheet(
    wb,
    'Event Members',
    [
      'id',
      'event_id',
      'member_id',
      'membership_number',
      'forenames',
      'surname',
      'is_organiser',
      'notes',
    ],
    eventMembers.map((r) => ({
      ...r,
      is_organiser: boolInt(r.is_organiser),
    })),
  );
}

export async function buildCalendarSheet(wb) {
  const ws = wb.addWorksheet('Calendar');
  ws.addRow(['note']);
  ws.addRow([
    'Calendar events are exported with the Groups export (Group Events sheet), ' +
      'not as a separate Calendar sheet.',
  ]);
}

export async function buildSystemSheets(wb, slug) {
  const [users, userRoles, roles, privs] = await Promise.all([
    // Include password_hash so it can be fully restored
    tenantQuery(
      slug,
      `
      SELECT id, username, name, email, password_hash, active, member_id
      FROM users ORDER BY name
    `,
    ),
    tenantQuery(
      slug,
      `
      SELECT ur.user_id, u.name AS user_name, ur.role_id, r.name AS role_name
      FROM user_roles ur
      JOIN users u ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      ORDER BY u.name, r.name
    `,
    ),
    tenantQuery(slug, `SELECT id, name, is_committee, notes FROM roles ORDER BY name`),
    // Join privilege_resources to get resource code (resource_id is the FK)
    tenantQuery(
      slug,
      `
      SELECT rp.role_id, r.name AS role_name, pr.code AS resource_code, rp.action
      FROM role_privileges rp
      JOIN roles r ON rp.role_id = r.id
      JOIN privilege_resources pr ON rp.resource_id = pr.id
      ORDER BY r.name, pr.code, rp.action
    `,
    ),
  ]);

  addSheet(
    wb,
    'System Users',
    ['id', 'username', 'name', 'email', 'password_hash', 'active', 'member_id'],
    users.map((r) => ({ ...r, active: boolInt(r.active) })),
  );

  addSheet(wb, 'User roles', ['user_id', 'user_name', 'role_id', 'role_name'], userRoles);

  addSheet(
    wb,
    'Roles',
    ['id', 'name', 'is_committee', 'notes'],
    roles.map((r) => ({ ...r, is_committee: boolInt(r.is_committee) })),
  );

  addSheet(wb, 'Privileges', ['role_id', 'role_name', 'resource_code', 'action'], privs);
}

export async function buildOfficersSheet(wb, slug) {
  const rows = await tenantQuery(
    slug,
    `
    SELECT o.id, o.name, o.member_id, m.forenames AS member_forenames,
           m.surname AS member_surname, o.office_email, o.notify_online_join
    FROM offices o
    LEFT JOIN members m ON o.member_id = m.id
    ORDER BY o.name
  `,
  );

  addSheet(
    wb,
    'u3a Officers',
    [
      'id',
      'name',
      'member_id',
      'member_forenames',
      'member_surname',
      'office_email',
      'notify_online_join',
    ],
    rows.map((r) => ({ ...r, notify_online_join: boolInt(r.notify_online_join) })),
  );
}

export async function buildSettingsSheets(wb, slug) {
  const [settings, accounts, categories, classes, fees, statuses, polls, pollMembers] =
    await Promise.all([
      tenantQuery(
        slug,
        `
      SELECT card_colour, email_cards, public_phone, public_email, home_page,
             online_join_email, online_renew_email, fee_variation,
             extended_membership_month, advance_renewals_weeks, grace_lapse_weeks,
             deletion_years, default_payment_method, gift_aid_enabled, gift_aid_online_renewals,
             default_town, default_county, default_std_code,
             paypal_email, paypal_cancel_url, shared_address_warning,
             year_start_month, year_start_day,
             online_joining_enabled, privacy_policy_url,
             group_bf_enabled, siteworks_activated,
             custom_field_label_1, custom_field_label_2,
             custom_field_label_3, custom_field_label_4,
             portal_config, group_info_config, calendar_config,
             feature_config
      FROM tenant_settings
    `,
      ),
      tenantQuery(
        slug,
        `
      SELECT id, name, active, locked, sort_order, pending_config, pending_types,
             enable_refunds, balance_brought_forward
      FROM finance_accounts ORDER BY sort_order, name
    `,
      ),
      tenantQuery(
        slug,
        `
      SELECT id, name, active, locked, sort_order
      FROM finance_categories ORDER BY sort_order, name
    `,
      ),
      tenantQuery(
        slug,
        `
      SELECT id, name, current, explanation, is_joint, is_associate, show_online,
             fee, gift_aid_fee, locked
      FROM member_classes ORDER BY name
    `,
      ),
      tenantQuery(
        slug,
        `
      SELECT cmf.class_id, mc.name AS class_name, cmf.month_index, cmf.fee, cmf.gift_aid_fee
      FROM class_monthly_fees cmf
      JOIN member_classes mc ON cmf.class_id = mc.id
      ORDER BY mc.name, cmf.month_index
    `,
      ),
      tenantQuery(slug, `SELECT id, name, locked FROM member_statuses ORDER BY name`),
      tenantQuery(slug, `SELECT id, name, description, member_can_set FROM polls ORDER BY name`),
      tenantQuery(
        slug,
        `
      SELECT pm.poll_id, p.name AS poll_name, pm.member_id, m.membership_number
      FROM poll_members pm
      JOIN polls   p ON pm.poll_id   = p.id
      JOIN members m ON pm.member_id = m.id
      ORDER BY p.name
    `,
      ),
    ]);

  const s = settings[0] || {};
  const settingsRows = [
    { setting: 'card_colour', value: str(s.card_colour) },
    { setting: 'email_cards', value: boolInt(s.email_cards) },
    { setting: 'public_phone', value: str(s.public_phone) },
    { setting: 'public_email', value: str(s.public_email) },
    { setting: 'home_page', value: str(s.home_page) },
    { setting: 'online_join_email', value: str(s.online_join_email) },
    { setting: 'online_renew_email', value: str(s.online_renew_email) },
    { setting: 'fee_variation', value: str(s.fee_variation) },
    { setting: 'extended_membership_month', value: s.extended_membership_month ?? '' },
    { setting: 'advance_renewals_weeks', value: s.advance_renewals_weeks ?? '' },
    { setting: 'grace_lapse_weeks', value: s.grace_lapse_weeks ?? '' },
    { setting: 'deletion_years', value: s.deletion_years ?? '' },
    { setting: 'default_payment_method', value: str(s.default_payment_method) },
    { setting: 'gift_aid_enabled', value: boolInt(s.gift_aid_enabled) },
    { setting: 'gift_aid_online_renewals', value: boolInt(s.gift_aid_online_renewals) },
    { setting: 'default_town', value: str(s.default_town) },
    { setting: 'default_county', value: str(s.default_county) },
    { setting: 'default_std_code', value: str(s.default_std_code) },
    { setting: 'paypal_email', value: str(s.paypal_email) },
    { setting: 'paypal_cancel_url', value: str(s.paypal_cancel_url) },
    { setting: 'shared_address_warning', value: boolInt(s.shared_address_warning) },
    { setting: 'year_start_month', value: s.year_start_month ?? 1 },
    { setting: 'year_start_day', value: s.year_start_day ?? 1 },
    { setting: 'online_joining_enabled', value: boolInt(s.online_joining_enabled) },
    { setting: 'privacy_policy_url', value: str(s.privacy_policy_url) },
    { setting: 'group_bf_enabled', value: boolInt(s.group_bf_enabled) },
    { setting: 'siteworks_activated', value: boolInt(s.siteworks_activated) },
    { setting: 'custom_field_label_1', value: str(s.custom_field_label_1) },
    { setting: 'custom_field_label_2', value: str(s.custom_field_label_2) },
    { setting: 'custom_field_label_3', value: str(s.custom_field_label_3) },
    { setting: 'custom_field_label_4', value: str(s.custom_field_label_4) },
    { setting: 'portal_config', value: JSON.stringify(s.portal_config || {}) },
    { setting: 'group_info_config', value: JSON.stringify(s.group_info_config || {}) },
    { setting: 'calendar_config', value: JSON.stringify(s.calendar_config || {}) },
    { setting: 'feature_config', value: JSON.stringify(s.feature_config || {}) },
  ];
  addSheet(wb, 'Site Settings 1', ['setting', 'value'], settingsRows);

  const ws2 = wb.addWorksheet('Site Settings 2');
  ws2.addRow(['note']);
  ws2.addRow(['Beacon2 stores all settings in Site Settings 1.']);

  addSheet(
    wb,
    'Finance Accounts',
    [
      'id',
      'name',
      'active',
      'locked',
      'sort_order',
      'pending_config',
      'pending_types',
      'enable_refunds',
      'balance_brought_forward',
    ],
    accounts.map((r) => ({
      ...r,
      active: boolInt(r.active),
      locked: boolInt(r.locked),
      enable_refunds: boolInt(r.enable_refunds),
      pending_types: JSON.stringify(r.pending_types || []),
      balance_brought_forward:
        r.balance_brought_forward != null ? Number(r.balance_brought_forward) : 0,
    })),
  );

  addSheet(
    wb,
    'Finance Categories',
    ['id', 'name', 'active', 'locked', 'sort_order'],
    categories.map((r) => ({ ...r, active: boolInt(r.active), locked: boolInt(r.locked) })),
  );

  addSheet(
    wb,
    'Membership Classes',
    [
      'id',
      'name',
      'current',
      'explanation',
      'is_joint',
      'is_associate',
      'show_online',
      'fee',
      'gift_aid_fee',
      'locked',
    ],
    classes.map((r) => ({
      ...r,
      current: boolInt(r.current),
      is_joint: boolInt(r.is_joint),
      is_associate: boolInt(r.is_associate),
      show_online: boolInt(r.show_online),
      locked: boolInt(r.locked),
      fee: r.fee != null ? Number(r.fee) : null,
      gift_aid_fee: r.gift_aid_fee != null ? Number(r.gift_aid_fee) : null,
    })),
  );

  addSheet(
    wb,
    'Membership Fees',
    ['class_id', 'class_name', 'month_index', 'fee', 'gift_aid_fee'],
    fees.map((r) => ({
      ...r,
      fee: r.fee != null ? Number(r.fee) : null,
      gift_aid_fee: r.gift_aid_fee != null ? Number(r.gift_aid_fee) : null,
    })),
  );

  addSheet(
    wb,
    'Member Statuses',
    ['id', 'name', 'locked'],
    statuses.map((r) => ({ ...r, locked: boolInt(r.locked) })),
  );

  addSheet(
    wb,
    'Polls',
    ['id', 'name', 'description', 'member_can_set'],
    polls.map((r) => ({ ...r, member_can_set: boolInt(r.member_can_set) })),
  );

  addSheet(
    wb,
    'Poll assignments',
    ['poll_id', 'poll_name', 'member_id', 'membership_number'],
    pollMembers,
  );

  const [sysMsgs, stdMsgs, stdLetters, pmDefaults] = await Promise.all([
    tenantQuery(slug, `SELECT id, name, subject, body FROM system_messages ORDER BY name`),
    tenantQuery(slug, `SELECT id, name, subject, body FROM standard_messages ORDER BY name`),
    tenantQuery(slug, `SELECT id, name, body FROM standard_letters ORDER BY name`),
    tenantQuery(
      slug,
      `
      SELECT pmd.payment_method, pmd.account_id, fa.name AS account_name
      FROM payment_method_defaults pmd
      LEFT JOIN finance_accounts fa ON pmd.account_id = fa.id
      ORDER BY pmd.payment_method
    `,
    ),
  ]);

  addSheet(wb, 'System Messages', ['id', 'name', 'subject', 'body'], sysMsgs);
  addSheet(wb, 'Standard Messages', ['id', 'name', 'subject', 'body'], stdMsgs);
  addSheet(wb, 'Standard Letters', ['id', 'name', 'body'], stdLetters);
  addSheet(
    wb,
    'Payment Method Defaults',
    ['payment_method', 'account_id', 'account_name'],
    pmDefaults,
  );
}

// ── Export route ───────────────────────────────────────────────────────────────

export const EXPORT_TYPES = {
  members: 'members_and_addresses',
  finance: 'finance_ledger_with_detail',
  groups: 'groups_members_venues_faculties',
  calendar: 'calendar',
  system: 'system_users_roles_privileges',
  officers: 'u3a_officers',
  settings: 'site_settings_and_setup',
  all: 'backup_all_data',
};

router.get(
  '/export',
  requirePrivilege('data_export_backup', 'download'),
  async (req, res, next) => {
    const { type = 'all' } = req.query;
    if (!EXPORT_TYPES[type]) return res.status(400).json({ error: 'Invalid export type' });

    const slug = req.user.tenantSlug;

    try {
      // Look up tenant display name for filename
      const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
      const tenantName = tenant?.name
        ? tenant.name
            .replace(/[^a-z0-9_]/gi, '_')
            .replace(/__+/g, '_')
            .toLowerCase()
        : slug;

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Beacon2';
      wb.created = new Date();

      const builders = {
        members: () => buildMembersSheet(wb, slug),
        finance: () => buildFinanceSheets(wb, slug),
        groups: () => buildGroupsSheets(wb, slug),
        calendar: () => buildCalendarSheet(wb),
        system: () => buildSystemSheets(wb, slug),
        officers: () => buildOfficersSheet(wb, slug),
        settings: () => buildSettingsSheets(wb, slug),
      };

      if (type === 'all') {
        for (const fn of Object.values(builders)) await fn();
      } else {
        await builders[type]();
      }

      // Filename: {tenantname}_{type}_{YYYY-MM-DD_HH-MM}.xlsx
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10);
      const timePart = now.toISOString().slice(11, 16).replace(':', '-');
      const filename = `${tenantName}_${EXPORT_TYPES[type]}_${datePart}_${timePart}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
