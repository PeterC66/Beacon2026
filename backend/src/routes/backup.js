// beacon2/backend/src/routes/backup.js
// Data export (doc 9.5) — 8 Excel options, tenant-scoped.
// Restore lives in system.js (system-admin only).

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery, prisma } from '../utils/db.js';
import { hashPassword } from '../utils/password.js';
import ExcelJS from 'exceljs';
import { v4 as uuid } from 'uuid';
import { STANDARD_IMPLEMENTATIONS } from '../../../shared/constants.js';

const router = Router();
router.use(requireAuth);

// ── Utilities (exported for system.js to use in restore) ──────────────────────

/** Parse all rows from a worksheet into plain objects (row 1 = headers) */
export function sheetRows(ws) {
  if (!ws) return [];
  const rows = [];
  let headers = null;
  ws.eachRow((row, rowNum) => {
    const vals = row.values.slice(1);
    if (rowNum === 1) {
      headers = vals.map((v) => String(v ?? '').trim());
    } else {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? null; });
      rows.push(obj);
    }
  });
  return rows;
}

export function parseDate(val) {
  if (val == null) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString().slice(0, 10);
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function parseBool(val) {
  return val === true || val === 1 || val === '1' || val === 'true';
}

export function parseDec(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

export function str(v) {
  if (v == null) return null;
  const s = String(v);
  return s === '' ? null : s;
}

export function dateToStr(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10) || null;
}

export function boolInt(v) { return v ? 1 : 0; }

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
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' },
  };
  rows.forEach((r) => {
    const rowData = {};
    columns.forEach((c) => { rowData[c] = r[c] ?? null; });
    ws.addRow(rowData);
  });
  return ws;
}

// ── Export: sheet builders ─────────────────────────────────────────────────────

export async function buildMembersSheet(wb, slug) {
  const rows = await tenantQuery(slug, `
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
  `);

  addSheet(wb, 'Members', [
    'id', 'membership_number', 'title', 'forenames', 'surname', 'suffix',
    'known_as', 'initials', 'mobile', 'email', 'home_u3a',
    'joined_on', 'next_renewal', 'gift_aid_from', 'notes', 'hide_contact',
    'emergency_contact',
    'custom_field_1', 'custom_field_2', 'custom_field_3', 'custom_field_4',
    'status_id', 'status_name', 'class_id', 'class_name', 'partner_id',
    'address_id', 'house_no', 'street', 'add_line1', 'add_line2',
    'town', 'county', 'postcode', 'telephone',
  ], rows.map((r) => ({
    ...r,
    joined_on:    dateToStr(r.joined_on),
    next_renewal: dateToStr(r.next_renewal),
    gift_aid_from: dateToStr(r.gift_aid_from),
    hide_contact: boolInt(r.hide_contact),
  })));
}

export async function buildFinanceSheets(wb, slug) {
  const [txns, cats, batches] = await Promise.all([
    tenantQuery(slug, `
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
    `),
    tenantQuery(slug, `
      SELECT tc.transaction_id, tc.category_id, c.name AS category_name, tc.amount
      FROM transaction_categories tc
      LEFT JOIN finance_categories c ON tc.category_id = c.id
      ORDER BY tc.transaction_id
    `),
    tenantQuery(slug, `
      SELECT cb.id, cb.batch_ref, cb.account_id, a.name AS account_name,
             cb.description, cb.batch_date
      FROM credit_batches cb
      LEFT JOIN finance_accounts a ON cb.account_id = a.id
      ORDER BY cb.batch_ref
    `),
  ]);

  addSheet(wb, 'Ledger', [
    'id', 'transaction_number', 'date', 'type', 'from_to', 'amount',
    'payment_method', 'payment_ref', 'detail', 'remarks', 'cleared_at',
    'account_id', 'account_name', 'member_id_1', 'member_id_2', 'group_id', 'event_id',
    'transfer_id', 'pending', 'batch_id',
    'gift_aid_amount', 'gift_aid_claimed_at',
    'gift_aid_amount_2', 'gift_aid_claimed_at_2',
    'refund_of_id', 'refunded_by_id',
  ], txns.map((r) => ({
    ...r,
    date:                dateToStr(r.date),
    cleared_at:          dateToStr(r.cleared_at),
    amount:              r.amount != null ? Number(r.amount) : null,
    pending:             boolInt(r.pending),
    gift_aid_amount:     r.gift_aid_amount != null ? Number(r.gift_aid_amount) : null,
    gift_aid_claimed_at: dateToStr(r.gift_aid_claimed_at),
    gift_aid_amount_2:   r.gift_aid_amount_2 != null ? Number(r.gift_aid_amount_2) : null,
    gift_aid_claimed_at_2: dateToStr(r.gift_aid_claimed_at_2),
  })));

  addSheet(wb, 'Detail', [
    'transaction_id', 'category_id', 'category_name', 'amount',
  ], cats.map((r) => ({ ...r, amount: r.amount != null ? Number(r.amount) : null })));

  addSheet(wb, 'Credit Batches', [
    'id', 'batch_ref', 'account_id', 'account_name', 'description', 'batch_date',
  ], batches.map((r) => ({ ...r, batch_date: dateToStr(r.batch_date) })));
}

export async function buildGroupsSheets(wb, slug) {
  const [groups, gm, faculties, venues, gle, events, eventTypes, eventMembers] = await Promise.all([
    tenantQuery(slug, `
      SELECT g.id, g.name, g.short_name, g.type, g.faculty_id, f.name AS faculty_name, g.status,
             g.when_text,
             g.start_time::text AS start_time, g.end_time::text AS end_time,
             g.venue, g.venue_id, g.enquiries, g.max_members,
             g.allow_online_join, g.enable_waiting_list, g.notify_leader,
             g.display_waiting_list, g.information, g.notes, g.show_addresses
      FROM groups g
      LEFT JOIN faculties f ON g.faculty_id = f.id
      ORDER BY g.name
    `),
    tenantQuery(slug, `
      SELECT gm.id, gm.group_id, g.name AS group_name,
             gm.member_id, m.membership_number, m.forenames, m.surname,
             gm.is_leader, gm.waiting_since
      FROM group_members gm
      JOIN groups  g ON gm.group_id  = g.id
      JOIN members m ON gm.member_id = m.id
      ORDER BY g.name, m.surname, m.forenames
    `),
    tenantQuery(slug, `SELECT id, name FROM faculties ORDER BY name`),
    tenantQuery(slug, `
      SELECT id, name, address, postcode, telephone, contact, email, website,
             notes, private_address, accessible
      FROM venues ORDER BY name
    `),
    tenantQuery(slug, `
      SELECT gle.id, gle.group_id, g.name AS group_name,
             gle.entry_date, gle.payee, gle.detail, gle.money_in, gle.money_out
      FROM group_ledger_entries gle
      JOIN groups g ON gle.group_id = g.id
      ORDER BY g.name, gle.entry_date
    `),
    tenantQuery(slug, `
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
    `),
    tenantQuery(slug, `
      SELECT id, name, description, is_default FROM event_types ORDER BY is_default DESC, name
    `),
    tenantQuery(slug, `
      SELECT em.id, em.event_id, em.member_id,
             m.membership_number, m.forenames, m.surname,
             em.is_organiser, em.notes
      FROM event_members em
      JOIN members m ON em.member_id = m.id
      ORDER BY em.event_id, m.surname, m.forenames
    `),
  ]);

  addSheet(wb, 'Groups', [
    'id', 'name', 'short_name', 'type', 'faculty_id', 'faculty_name', 'status',
    'when_text', 'start_time', 'end_time', 'venue', 'venue_id', 'enquiries', 'max_members',
    'allow_online_join', 'enable_waiting_list', 'notify_leader',
    'display_waiting_list', 'information', 'notes', 'show_addresses',
  ], groups.map((r) => ({
    ...r,
    allow_online_join:    boolInt(r.allow_online_join),
    enable_waiting_list:  boolInt(r.enable_waiting_list),
    notify_leader:        boolInt(r.notify_leader),
    display_waiting_list: boolInt(r.display_waiting_list),
    show_addresses:       boolInt(r.show_addresses),
  })));

  addSheet(wb, 'Group members', [
    'id', 'group_id', 'group_name', 'member_id', 'membership_number',
    'forenames', 'surname', 'is_leader', 'waiting_since',
  ], gm.map((r) => ({
    ...r,
    is_leader:     boolInt(r.is_leader),
    waiting_since: dateToStr(r.waiting_since),
  })));

  addSheet(wb, 'Venues', [
    'id', 'name', 'address', 'postcode', 'telephone', 'contact',
    'email', 'website', 'notes', 'private_address', 'accessible',
  ], venues.map((r) => ({
    ...r,
    private_address: boolInt(r.private_address),
    accessible:      boolInt(r.accessible),
  })));

  addSheet(wb, 'Group Ledgers', [
    'id', 'group_id', 'group_name', 'entry_date', 'payee', 'detail', 'money_in', 'money_out',
  ], gle.map((r) => ({
    ...r,
    entry_date: dateToStr(r.entry_date),
    money_in:   r.money_in != null ? Number(r.money_in) : null,
    money_out:  r.money_out != null ? Number(r.money_out) : null,
  })));

  addSheet(wb, 'Faculties', ['id', 'name'], faculties);

  addSheet(wb, 'Event Types', [
    'id', 'name', 'description', 'is_default',
  ], eventTypes.map((r) => ({
    ...r,
    is_default: boolInt(r.is_default),
  })));

  addSheet(wb, 'Group Events', [
    'id', 'group_id', 'group_name', 'event_date', 'start_time', 'end_time',
    'venue_id', 'venue_name', 'event_type_id', 'event_type_name',
    'contact', 'details', 'topic', 'is_private',
  ], events.map((r) => ({
    ...r,
    event_date: dateToStr(r.event_date),
    is_private: boolInt(r.is_private),
  })));

  addSheet(wb, 'Event Members', [
    'id', 'event_id', 'member_id', 'membership_number',
    'forenames', 'surname', 'is_organiser', 'notes',
  ], eventMembers.map((r) => ({
    ...r,
    is_organiser: boolInt(r.is_organiser),
  })));
}

export async function buildCalendarSheet(wb) {
  const ws = wb.addWorksheet('Calendar');
  ws.addRow(['note']);
  ws.addRow(['Calendar is not yet implemented in Beacon2.']);
}

export async function buildSystemSheets(wb, slug) {
  const [users, userRoles, roles, privs] = await Promise.all([
    // Include password_hash so it can be fully restored
    tenantQuery(slug, `
      SELECT id, username, name, email, password_hash, active, member_id
      FROM users ORDER BY name
    `),
    tenantQuery(slug, `
      SELECT ur.user_id, u.name AS user_name, ur.role_id, r.name AS role_name
      FROM user_roles ur
      JOIN users u ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id
      ORDER BY u.name, r.name
    `),
    tenantQuery(slug, `SELECT id, name, is_committee, notes FROM roles ORDER BY name`),
    // Join privilege_resources to get resource code (resource_id is the FK)
    tenantQuery(slug, `
      SELECT rp.role_id, r.name AS role_name, pr.code AS resource_code, rp.action
      FROM role_privileges rp
      JOIN roles r ON rp.role_id = r.id
      JOIN privilege_resources pr ON rp.resource_id = pr.id
      ORDER BY r.name, pr.code, rp.action
    `),
  ]);

  addSheet(wb, 'System Users', [
    'id', 'username', 'name', 'email', 'password_hash', 'active', 'member_id',
  ], users.map((r) => ({ ...r, active: boolInt(r.active) })));

  addSheet(wb, 'User roles', [
    'user_id', 'user_name', 'role_id', 'role_name',
  ], userRoles);

  addSheet(wb, 'Roles', ['id', 'name', 'is_committee', 'notes'],
    roles.map((r) => ({ ...r, is_committee: boolInt(r.is_committee) })));

  addSheet(wb, 'Privileges', ['role_id', 'role_name', 'resource_code', 'action'], privs);
}

export async function buildOfficersSheet(wb, slug) {
  const rows = await tenantQuery(slug, `
    SELECT o.id, o.name, o.member_id, m.forenames AS member_forenames,
           m.surname AS member_surname, o.office_email, o.notify_online_join
    FROM offices o
    LEFT JOIN members m ON o.member_id = m.id
    ORDER BY o.name
  `);

  addSheet(wb, 'u3a Officers', [
    'id', 'name', 'member_id', 'member_forenames', 'member_surname',
    'office_email', 'notify_online_join',
  ], rows.map((r) => ({ ...r, notify_online_join: boolInt(r.notify_online_join) })));
}

export async function buildSettingsSheets(wb, slug) {
  const [
    settings, accounts, categories, classes, fees,
    statuses, polls, pollMembers,
  ] = await Promise.all([
    tenantQuery(slug, `
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
    `),
    tenantQuery(slug, `
      SELECT id, name, active, locked, sort_order, pending_config, pending_types,
             enable_refunds, balance_brought_forward
      FROM finance_accounts ORDER BY sort_order, name
    `),
    tenantQuery(slug, `
      SELECT id, name, active, locked, sort_order
      FROM finance_categories ORDER BY sort_order, name
    `),
    tenantQuery(slug, `
      SELECT id, name, current, explanation, is_joint, is_associate, show_online,
             fee, gift_aid_fee, locked
      FROM member_classes ORDER BY name
    `),
    tenantQuery(slug, `
      SELECT cmf.class_id, mc.name AS class_name, cmf.month_index, cmf.fee, cmf.gift_aid_fee
      FROM class_monthly_fees cmf
      JOIN member_classes mc ON cmf.class_id = mc.id
      ORDER BY mc.name, cmf.month_index
    `),
    tenantQuery(slug, `SELECT id, name, locked FROM member_statuses ORDER BY name`),
    tenantQuery(slug, `SELECT id, name, description, member_can_set FROM polls ORDER BY name`),
    tenantQuery(slug, `
      SELECT pm.poll_id, p.name AS poll_name, pm.member_id, m.membership_number
      FROM poll_members pm
      JOIN polls   p ON pm.poll_id   = p.id
      JOIN members m ON pm.member_id = m.id
      ORDER BY p.name
    `),
  ]);

  const s = settings[0] || {};
  const settingsRows = [
    { setting: 'card_colour',               value: str(s.card_colour) },
    { setting: 'email_cards',               value: boolInt(s.email_cards) },
    { setting: 'public_phone',              value: str(s.public_phone) },
    { setting: 'public_email',              value: str(s.public_email) },
    { setting: 'home_page',                 value: str(s.home_page) },
    { setting: 'online_join_email',         value: str(s.online_join_email) },
    { setting: 'online_renew_email',        value: str(s.online_renew_email) },
    { setting: 'fee_variation',             value: str(s.fee_variation) },
    { setting: 'extended_membership_month', value: s.extended_membership_month ?? '' },
    { setting: 'advance_renewals_weeks',    value: s.advance_renewals_weeks ?? '' },
    { setting: 'grace_lapse_weeks',         value: s.grace_lapse_weeks ?? '' },
    { setting: 'deletion_years',            value: s.deletion_years ?? '' },
    { setting: 'default_payment_method',    value: str(s.default_payment_method) },
    { setting: 'gift_aid_enabled',          value: boolInt(s.gift_aid_enabled) },
    { setting: 'gift_aid_online_renewals',  value: boolInt(s.gift_aid_online_renewals) },
    { setting: 'default_town',              value: str(s.default_town) },
    { setting: 'default_county',            value: str(s.default_county) },
    { setting: 'default_std_code',          value: str(s.default_std_code) },
    { setting: 'paypal_email',              value: str(s.paypal_email) },
    { setting: 'paypal_cancel_url',         value: str(s.paypal_cancel_url) },
    { setting: 'shared_address_warning',    value: boolInt(s.shared_address_warning) },
    { setting: 'year_start_month',          value: s.year_start_month ?? 1 },
    { setting: 'year_start_day',            value: s.year_start_day ?? 1 },
    { setting: 'online_joining_enabled',    value: boolInt(s.online_joining_enabled) },
    { setting: 'privacy_policy_url',        value: str(s.privacy_policy_url) },
    { setting: 'group_bf_enabled',          value: boolInt(s.group_bf_enabled) },
    { setting: 'siteworks_activated',       value: boolInt(s.siteworks_activated) },
    { setting: 'custom_field_label_1',      value: str(s.custom_field_label_1) },
    { setting: 'custom_field_label_2',      value: str(s.custom_field_label_2) },
    { setting: 'custom_field_label_3',      value: str(s.custom_field_label_3) },
    { setting: 'custom_field_label_4',      value: str(s.custom_field_label_4) },
    { setting: 'portal_config',             value: JSON.stringify(s.portal_config || {}) },
    { setting: 'group_info_config',         value: JSON.stringify(s.group_info_config || {}) },
    { setting: 'calendar_config',           value: JSON.stringify(s.calendar_config || {}) },
    { setting: 'feature_config',            value: JSON.stringify(s.feature_config || {}) },
  ];
  addSheet(wb, 'Site Settings 1', ['setting', 'value'], settingsRows);

  const ws2 = wb.addWorksheet('Site Settings 2');
  ws2.addRow(['note']);
  ws2.addRow(['Beacon2 stores all settings in Site Settings 1.']);

  addSheet(wb, 'Finance Accounts', [
    'id', 'name', 'active', 'locked', 'sort_order',
    'pending_config', 'pending_types', 'enable_refunds', 'balance_brought_forward',
  ], accounts.map((r) => ({
    ...r,
    active: boolInt(r.active),
    locked: boolInt(r.locked),
    enable_refunds: boolInt(r.enable_refunds),
    pending_types: JSON.stringify(r.pending_types || []),
    balance_brought_forward: r.balance_brought_forward != null ? Number(r.balance_brought_forward) : 0,
  })));

  addSheet(wb, 'Finance Categories', [
    'id', 'name', 'active', 'locked', 'sort_order',
  ], categories.map((r) => ({ ...r, active: boolInt(r.active), locked: boolInt(r.locked) })));

  addSheet(wb, 'Membership Classes', [
    'id', 'name', 'current', 'explanation', 'is_joint', 'is_associate', 'show_online',
    'fee', 'gift_aid_fee', 'locked',
  ], classes.map((r) => ({
    ...r,
    current:      boolInt(r.current),
    is_joint:     boolInt(r.is_joint),
    is_associate: boolInt(r.is_associate),
    show_online:  boolInt(r.show_online),
    locked:       boolInt(r.locked),
    fee:          r.fee != null ? Number(r.fee) : null,
    gift_aid_fee: r.gift_aid_fee != null ? Number(r.gift_aid_fee) : null,
  })));

  addSheet(wb, 'Membership Fees', [
    'class_id', 'class_name', 'month_index', 'fee', 'gift_aid_fee',
  ], fees.map((r) => ({
    ...r,
    fee:          r.fee != null ? Number(r.fee) : null,
    gift_aid_fee: r.gift_aid_fee != null ? Number(r.gift_aid_fee) : null,
  })));

  addSheet(wb, 'Member Statuses', ['id', 'name', 'locked'],
    statuses.map((r) => ({ ...r, locked: boolInt(r.locked) })));

  addSheet(wb, 'Polls', ['id', 'name', 'description', 'member_can_set'],
    polls.map((r) => ({ ...r, member_can_set: boolInt(r.member_can_set) })));

  addSheet(wb, 'Poll assignments', [
    'poll_id', 'poll_name', 'member_id', 'membership_number',
  ], pollMembers);

  const [sysMsgs, stdMsgs, stdLetters, pmDefaults] = await Promise.all([
    tenantQuery(slug, `SELECT id, name, subject, body FROM system_messages ORDER BY name`),
    tenantQuery(slug, `SELECT id, name, subject, body FROM standard_messages ORDER BY name`),
    tenantQuery(slug, `SELECT id, name, body FROM standard_letters ORDER BY name`),
    tenantQuery(slug, `
      SELECT pmd.payment_method, pmd.account_id, fa.name AS account_name
      FROM payment_method_defaults pmd
      LEFT JOIN finance_accounts fa ON pmd.account_id = fa.id
      ORDER BY pmd.payment_method
    `),
  ]);

  addSheet(wb, 'System Messages', ['id', 'name', 'subject', 'body'], sysMsgs);
  addSheet(wb, 'Standard Messages', ['id', 'name', 'subject', 'body'], stdMsgs);
  addSheet(wb, 'Standard Letters', ['id', 'name', 'body'], stdLetters);
  addSheet(wb, 'Payment Method Defaults', [
    'payment_method', 'account_id', 'account_name',
  ], pmDefaults);
}

// ── Export route ───────────────────────────────────────────────────────────────

export const EXPORT_TYPES = {
  members:  'members_and_addresses',
  finance:  'finance_ledger_with_detail',
  groups:   'groups_members_venues_faculties',
  calendar: 'calendar',
  system:   'system_users_roles_privileges',
  officers: 'u3a_officers',
  settings: 'site_settings_and_setup',
  all:      'backup_all_data',
};

router.get('/export', requirePrivilege('data_export_backup', 'download'), async (req, res, next) => {
  const { type = 'all' } = req.query;
  if (!EXPORT_TYPES[type]) return res.status(400).json({ error: 'Invalid export type' });

  const slug = req.user.tenantSlug;

  try {
    // Look up tenant display name for filename
    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const tenantName = tenant?.name
      ? tenant.name.replace(/[^a-z0-9_]/gi, '_').replace(/__+/g, '_').toLowerCase()
      : slug;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Beacon2';
    wb.created = new Date();

    const builders = {
      members:  () => buildMembersSheet(wb, slug),
      finance:  () => buildFinanceSheets(wb, slug),
      groups:   () => buildGroupsSheets(wb, slug),
      calendar: () => buildCalendarSheet(wb),
      system:   () => buildSystemSheets(wb, slug),
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

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// ── Restore helpers (exported for system.js) ───────────────────────────────────

export async function clearTenantData(tx) {
  const statements = [
    'DELETE FROM poll_members',
    'DELETE FROM polls',
    'DELETE FROM transaction_categories',
    'DELETE FROM transactions',
    'DELETE FROM credit_batches',
    'DELETE FROM offices',
    'DELETE FROM event_members',
    'DELETE FROM group_events',
    'DELETE FROM event_types',
    'DELETE FROM group_members',
    'DELETE FROM groups',
    'DELETE FROM faculties',
    'DELETE FROM standard_messages',
    'DELETE FROM standard_letters',
    'DELETE FROM payment_method_defaults',
    'DELETE FROM finance_accounts',
    'DELETE FROM finance_categories',
    'UPDATE members SET partner_id = NULL',
    'DELETE FROM members',
    'DELETE FROM addresses',
    'DELETE FROM class_monthly_fees',
    'DELETE FROM member_classes',
    'DELETE FROM member_statuses',
    'DELETE FROM user_roles',
    'DELETE FROM role_privileges',
    'DELETE FROM roles',
    'DELETE FROM users',
    'DELETE FROM audit_log',
    'DELETE FROM refresh_tokens',
  ];
  for (const sql of statements) {
    await tx.$executeRawUnsafe(sql);
  }
}

export async function resetSequences(tx) {
  await tx.$executeRawUnsafe(`
    SELECT setval('membership_number_seq',
      COALESCE((SELECT MAX(membership_number) FROM members), 0) + 1, false)
  `);
  await tx.$executeRawUnsafe(`
    SELECT setval('transaction_number_seq',
      COALESCE((SELECT MAX(transaction_number) FROM transactions), 0) + 1, false)
  `);
}

// ── Restore: Beacon2 format ────────────────────────────────────────────────────

export async function restoreBeacon2(tx, wb) {
  const get = (name) => sheetRows(wb.getWorksheet(name));

  // 1. Member statuses
  for (const r of get('Member Statuses')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO member_statuses (id, name, locked) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), parseBool(r.locked),
    );
  }

  // 2. Member classes
  for (const r of get('Membership Classes')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO member_classes
         (id, name, current, explanation, is_joint, is_associate, show_online, fee, gift_aid_fee, locked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::numeric,$9::numeric,$10) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), parseBool(r.current), str(r.explanation),
      parseBool(r.is_joint), parseBool(r.is_associate), parseBool(r.show_online),
      parseDec(r.fee), parseDec(r.gift_aid_fee), parseBool(r.locked),
    );
  }

  // 3. Class monthly fees
  for (const r of get('Membership Fees')) {
    if (!r.class_id || r.month_index == null) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO class_monthly_fees (id, class_id, month_index, fee, gift_aid_fee)
       VALUES (gen_random_uuid()::text,$1,$2,$3::numeric,$4::numeric)
       ON CONFLICT (class_id, month_index) DO NOTHING`,
      r.class_id, parseInt(r.month_index), parseDec(r.fee), parseDec(r.gift_aid_fee),
    );
  }

  // 4. Addresses (unique address_id values from Members sheet)
  const membersData = get('Members');
  const seenAddresses = new Set();
  for (const r of membersData) {
    if (!r.address_id || seenAddresses.has(r.address_id)) continue;
    seenAddresses.add(r.address_id);
    await tx.$executeRawUnsafe(
      `INSERT INTO addresses (id, house_no, street, add_line1, add_line2, town, county, postcode, telephone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      r.address_id, str(r.house_no), str(r.street), str(r.add_line1), str(r.add_line2),
      str(r.town), str(r.county), str(r.postcode), str(r.telephone),
    );
  }

  // 5. Members (without partner_id first)
  for (const r of membersData) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO members
         (id, membership_number, title, forenames, surname, suffix, known_as, initials,
          mobile, email, home_u3a, joined_on, next_renewal, gift_aid_from, notes, hide_contact,
          emergency_contact, custom_field_1, custom_field_2, custom_field_3, custom_field_4,
          status_id, class_id, address_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14::date,$15,$16,
               $17,$18,$19,$20,$21,$22,$23,$24)
       ON CONFLICT (id) DO NOTHING`,
      r.id, parseInt(r.membership_number), str(r.title),
      String(r.forenames || ''), String(r.surname || ''),
      str(r.suffix), str(r.known_as), str(r.initials),
      str(r.mobile), str(r.email), str(r.home_u3a),
      parseDate(r.joined_on), parseDate(r.next_renewal), parseDate(r.gift_aid_from),
      str(r.notes), parseBool(r.hide_contact),
      str(r.emergency_contact), str(r.custom_field_1), str(r.custom_field_2),
      str(r.custom_field_3), str(r.custom_field_4),
      str(r.status_id), str(r.class_id), str(r.address_id),
    );
  }

  // 6. Restore partner links
  for (const r of membersData) {
    if (!r.id || !r.partner_id) continue;
    await tx.$executeRawUnsafe(
      `UPDATE members SET partner_id = $1 WHERE id = $2`, r.partner_id, r.id,
    );
  }

  // 7. Faculties
  for (const r of get('Faculties')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO faculties (id, name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''),
    );
  }

  // 7b. Venues (must come before Groups so venue_id FK is valid)
  for (const r of get('Venues')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO venues
         (id, name, address, postcode, telephone, contact, email, website, notes, private_address, accessible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), str(r.address), str(r.postcode),
      str(r.telephone), str(r.contact), str(r.email), str(r.website),
      str(r.notes), parseBool(r.private_address), parseBool(r.accessible),
    );
  }

  // 8. Groups
  for (const r of get('Groups')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO groups
         (id, name, short_name, type, faculty_id, status, when_text, start_time, end_time, venue, venue_id,
          enquiries, max_members, allow_online_join, enable_waiting_list, notify_leader,
          display_waiting_list, information, notes, show_addresses)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::time,$9::time,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), str(r.short_name) || null,
      String(r.type || 'group'), str(r.faculty_id),
      String(r.status || 'active'), str(r.when_text),
      str(r.start_time) || null, str(r.end_time) || null,
      str(r.venue), str(r.venue_id),
      str(r.enquiries),
      r.max_members ? parseInt(r.max_members) : null,
      parseBool(r.allow_online_join), parseBool(r.enable_waiting_list),
      parseBool(r.notify_leader), parseBool(r.display_waiting_list),
      str(r.information), str(r.notes), parseBool(r.show_addresses),
    );
  }

  // 9. Group members
  for (const r of get('Group members')) {
    if (!r.id || !r.group_id || !r.member_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO group_members (id, group_id, member_id, is_leader, waiting_since)
       VALUES ($1,$2,$3,$4,$5::date) ON CONFLICT (id) DO NOTHING`,
      r.id, r.group_id, r.member_id, parseBool(r.is_leader), parseDate(r.waiting_since),
    );
  }

  // 9b. Group ledger entries
  for (const r of get('Group Ledgers')) {
    if (!r.id || !r.group_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO group_ledger_entries (id, group_id, entry_date, payee, detail, money_in, money_out)
       VALUES ($1,$2,$3::date,$4,$5,$6::numeric,$7::numeric) ON CONFLICT (id) DO NOTHING`,
      r.id, r.group_id, parseDate(r.entry_date), str(r.payee), str(r.detail),
      parseDec(r.money_in), parseDec(r.money_out),
    );
  }

  // 9c. Event types
  for (const r of get('Event Types')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO event_types (id, name, description, is_default)
       VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), str(r.description), parseBool(r.is_default),
    );
  }

  // 9d. Group events (schedule)
  for (const r of get('Group Events')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO group_events
         (id, group_id, event_date, start_time, end_time, venue_id, contact, details, topic, is_private, event_type_id)
       VALUES ($1,$2,$3::date,$4::time,$5::time,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      r.id, str(r.group_id), parseDate(r.event_date),
      str(r.start_time) || null, str(r.end_time) || null,
      str(r.venue_id), str(r.contact), str(r.details), str(r.topic),
      parseBool(r.is_private), str(r.event_type_id),
    );
  }

  // 9e. Event members
  for (const r of get('Event Members')) {
    if (!r.id || !r.event_id || !r.member_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO event_members (id, event_id, member_id, is_organiser, notes)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      r.id, r.event_id, r.member_id, parseBool(r.is_organiser), str(r.notes),
    );
  }

  // 10. Finance Accounts
  for (const r of get('Finance Accounts')) {
    if (!r.id) continue;
    let pendingTypes;
    try { pendingTypes = JSON.parse(r.pending_types || '[]'); } catch { pendingTypes = []; }
    const ptArr = Array.isArray(pendingTypes) ? pendingTypes : [];
    const ptStr = '{' + ptArr.map((s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',') + '}';
    await tx.$executeRawUnsafe(
      `INSERT INTO finance_accounts
         (id, name, active, locked, sort_order, pending_config, pending_types,
          enable_refunds, balance_brought_forward)
       VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,$9::numeric) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), parseBool(r.active), parseBool(r.locked),
      r.sort_order ? parseInt(r.sort_order) : 0,
      String(r.pending_config || 'disabled'), ptStr, parseBool(r.enable_refunds),
      parseDec(r.balance_brought_forward) ?? 0,
    );
  }

  // 11. Finance Categories
  for (const r of get('Finance Categories')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO finance_categories (id, name, active, locked, sort_order)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), parseBool(r.active), parseBool(r.locked),
      r.sort_order ? parseInt(r.sort_order) : 0,
    );
  }

  // 11b. Credit Batches (must precede transactions for batch_id FK)
  for (const r of get('Credit Batches')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO credit_batches (id, batch_ref, account_id, description, batch_date)
       VALUES ($1,$2,$3,$4,$5::date) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.batch_ref || ''), r.account_id,
      str(r.description), parseDate(r.batch_date),
    );
  }

  // 12. Transactions
  for (const r of get('Ledger')) {
    if (!r.id || !r.account_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO transactions
         (id, transaction_number, account_id, date, type, from_to, amount,
          payment_method, payment_ref, detail, remarks,
          member_id_1, member_id_2, group_id, event_id, cleared_at,
          transfer_id, pending, batch_id,
          gift_aid_amount, gift_aid_claimed_at,
          gift_aid_amount_2, gift_aid_claimed_at_2,
          refund_of_id, refunded_by_id)
       VALUES ($1,$2,$3,$4::date,$5,$6,$7::numeric,$8,$9,$10,$11,$12,$13,$14,$15,$16::date,
               $17,$18,$19,$20::numeric,$21::date,$22::numeric,$23::date,$24,$25)
       ON CONFLICT (id) DO NOTHING`,
      r.id, parseInt(r.transaction_number), r.account_id, parseDate(r.date),
      String(r.type || 'in'), str(r.from_to), parseDec(r.amount),
      str(r.payment_method), str(r.payment_ref), str(r.detail), str(r.remarks),
      str(r.member_id_1), str(r.member_id_2), str(r.group_id), str(r.event_id), parseDate(r.cleared_at),
      str(r.transfer_id), parseBool(r.pending), str(r.batch_id),
      parseDec(r.gift_aid_amount), parseDate(r.gift_aid_claimed_at),
      parseDec(r.gift_aid_amount_2), parseDate(r.gift_aid_claimed_at_2),
      str(r.refund_of_id), str(r.refunded_by_id),
    );
  }

  // 13. Transaction categories
  for (const r of get('Detail')) {
    if (!r.transaction_id || !r.category_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO transaction_categories (id, transaction_id, category_id, amount)
       VALUES (gen_random_uuid()::text,$1,$2,$3::numeric)
       ON CONFLICT (transaction_id, category_id) DO NOTHING`,
      r.transaction_id, r.category_id, parseDec(r.amount),
    );
  }

  // 14. Offices
  for (const r of get('u3a Officers')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO offices (id, name, member_id, office_email, notify_online_join)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), str(r.member_id), str(r.office_email),
      parseBool(r.notify_online_join),
    );
  }

  // 15. Polls
  for (const r of get('Polls')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO polls (id, name, description, member_can_set)
       VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), String(r.description || ''), parseBool(r.member_can_set),
    );
  }

  // 16. Poll members
  for (const r of get('Poll assignments')) {
    if (!r.poll_id || !r.member_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO poll_members (poll_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      r.poll_id, r.member_id,
    );
  }

  // 17. Roles
  for (const r of get('Roles')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO roles (id, name, is_committee, notes)
       VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), parseBool(r.is_committee), str(r.notes),
    );
  }

  // 18. Privileges (role_privileges — look up resource_id from privilege_resources by code)
  for (const r of get('Privileges')) {
    if (!r.role_id || !r.resource_code || !r.action) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO role_privileges (id, role_id, resource_id, action)
       SELECT gen_random_uuid()::text, $1, pr.id, $2
       FROM privilege_resources pr WHERE pr.code = $3
       ON CONFLICT (role_id, resource_id, action) DO NOTHING`,
      r.role_id, String(r.action), String(r.resource_code),
    );
  }

  // 19. Users (must_change_password forced true so restored users must reset)
  for (const r of get('System Users')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, username, name, email, password_hash, active, member_id, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT (id) DO NOTHING`,
      r.id, str(r.username), String(r.name || ''), String(r.email || ''),
      str(r.password_hash), parseBool(r.active !== undefined ? r.active : 1), str(r.member_id),
    );
  }

  // 20. User roles
  for (const r of get('User roles')) {
    if (!r.user_id || !r.role_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      r.user_id, r.role_id,
    );
  }

  // 21. Settings
  const settingsData = get('Site Settings 1');
  if (settingsData.length > 0) {
    const sm = Object.fromEntries(settingsData.map((r) => [String(r.setting || ''), r.value]));
    const v    = (key) => { const val = sm[key]; return (val == null || val === '') ? null : val; };
    const vBool = (key) => { const val = sm[key]; return val == null ? null : parseBool(val); };
    const vInt  = (key) => { const val = sm[key]; return (val != null && val !== '') ? parseInt(val) : null; };
    const vJson = (key) => {
      const val = sm[key];
      if (val == null || val === '') return null;
      try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return null; }
    };

    await tx.$executeRawUnsafe(`
      UPDATE tenant_settings SET
        card_colour               = COALESCE($1, card_colour),
        email_cards               = COALESCE($2, email_cards),
        public_phone              = $3,
        public_email              = $4,
        home_page                 = $5,
        online_join_email         = $6,
        online_renew_email        = $7,
        fee_variation             = COALESCE($8, fee_variation),
        extended_membership_month = $9,
        advance_renewals_weeks    = COALESCE($10, advance_renewals_weeks),
        grace_lapse_weeks         = COALESCE($11, grace_lapse_weeks),
        deletion_years            = COALESCE($12, deletion_years),
        default_payment_method    = COALESCE($13, default_payment_method),
        gift_aid_enabled          = COALESCE($14, gift_aid_enabled),
        gift_aid_online_renewals  = COALESCE($15, gift_aid_online_renewals),
        default_town              = $16,
        default_county            = $17,
        default_std_code          = $18,
        paypal_email              = $19,
        paypal_cancel_url         = $20,
        shared_address_warning    = COALESCE($21, shared_address_warning),
        year_start_month          = COALESCE($22, year_start_month),
        year_start_day            = COALESCE($23, year_start_day),
        online_joining_enabled    = COALESCE($24, online_joining_enabled),
        privacy_policy_url        = $25,
        group_bf_enabled          = COALESCE($26, group_bf_enabled),
        siteworks_activated       = COALESCE($27, siteworks_activated),
        custom_field_label_1      = $28,
        custom_field_label_2      = $29,
        custom_field_label_3      = $30,
        custom_field_label_4      = $31,
        portal_config             = COALESCE($32::jsonb, portal_config),
        group_info_config         = COALESCE($33::jsonb, group_info_config),
        calendar_config           = COALESCE($34::jsonb, calendar_config),
        feature_config            = COALESCE($35::jsonb, feature_config)
      WHERE id = 'singleton'`,
      v('card_colour'), vBool('email_cards'),
      v('public_phone'), v('public_email'), v('home_page'),
      v('online_join_email'), v('online_renew_email'),
      v('fee_variation'), vInt('extended_membership_month'),
      vInt('advance_renewals_weeks'), vInt('grace_lapse_weeks'), vInt('deletion_years'),
      v('default_payment_method'),
      vBool('gift_aid_enabled'), vBool('gift_aid_online_renewals'),
      v('default_town'), v('default_county'), v('default_std_code'),
      v('paypal_email'), v('paypal_cancel_url'), vBool('shared_address_warning'),
      vInt('year_start_month'), vInt('year_start_day'),
      vBool('online_joining_enabled'), v('privacy_policy_url'),
      vBool('group_bf_enabled'), vBool('siteworks_activated'),
      v('custom_field_label_1'), v('custom_field_label_2'),
      v('custom_field_label_3'), v('custom_field_label_4'),
      vJson('portal_config') ? JSON.stringify(vJson('portal_config')) : null,
      vJson('group_info_config') ? JSON.stringify(vJson('group_info_config')) : null,
      vJson('calendar_config') ? JSON.stringify(vJson('calendar_config')) : null,
      vJson('feature_config') ? JSON.stringify(vJson('feature_config')) : null,
    );
  }

  // 22. System messages (UPDATE — rows are seeded at tenant creation)
  for (const r of get('System Messages')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `UPDATE system_messages SET name = $1, subject = $2, body = $3 WHERE id = $4`,
      String(r.name || ''), String(r.subject || ''), String(r.body || ''), r.id,
    );
  }

  // 23. Standard messages (user-created email templates)
  for (const r of get('Standard Messages')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO standard_messages (id, name, subject, body)
       VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), String(r.subject || ''), String(r.body || ''),
    );
  }

  // 24. Standard letters (user-created letter templates)
  for (const r of get('Standard Letters')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO standard_letters (id, name, body)
       VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      r.id, String(r.name || ''), String(r.body || ''),
    );
  }

  // 25. Payment method defaults
  for (const r of get('Payment Method Defaults')) {
    if (!r.payment_method) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO payment_method_defaults (payment_method, account_id)
       VALUES ($1,$2) ON CONFLICT (payment_method) DO UPDATE SET account_id = $2`,
      String(r.payment_method), str(r.account_id),
    );
  }

  await resetSequences(tx);
}

// ── Restore: Beacon (legacy) format ───────────────────────────────────────────

const BEACON_PAYMENT = {
  '1': 'Cash', '2': 'Cheque', '3': 'Standing Order',
  '4': 'Direct Debit', '5': 'Online', '6': 'Other',
};

export const BEACON_DEFAULT_PASSWORD = 'Beacon2!';

// ── Beacon privkey → Beacon2 (resource_code, action) mapping ─────────────────
// Beacon stores privileges as  privkey = base + digit
// where digit: 1=view 2=create 3=change 4=delete 5=extra(download/send/etc.)
// Source: docs/FromBeacon/privileges.php
const BEACON_PRIV_BASE = {
  1010: { code: 'members_list',              extra: 'download' },
  1020: { code: 'member_record' },
  1030: { code: 'groups_list' },
  1040: { code: 'group_records_all',         extra: 'download_members' },
  1050: { code: 'group_records_as_leader',   extra: 'download_members' },
  1060: { code: 'group_records_as_member' },
  1110: { code: 'users_list' },
  1120: { code: 'user_record' },
  // 1130/1140 were obsolete PHP variable names later reassigned to 1340/1350
  1140: { code: 'role_record' },             // old $pROLERECORD (safety net)
  1150: { code: 'audit_trail' },
  1160: { code: 'audit_detail' },
  1170: { code: 'members_non_renewals',      extra: 'lapse' },
  1180: { code: 'members_delete_expired' },
  1190: { code: 'members_recent',            extra: 'download' },
  1200: { code: 'membership_cards',          extra: 'download_and_mark' },
  1230: { code: 'settings' },
  1240: { code: 'address_labels',            extra: 'download' },
  1250: { code: 'poll_set_up' },
  1255: { code: 'custom_fields' },
  1260: { code: 'gift_aid_declaration',      extra: 'download_and_mark' },
  1270: { code: 'membership_renewals',       extra: 'renew' },
  1310: { code: 'group_leaders',             extra: 'email_labels' },
  1320: { code: 'email',                     extra: 'send' },
  1340: { code: 'roles_list' },
  1350: { code: 'role_record' },
  1360: { code: 'finance_ledger',            extra: 'download' },
  1370: { code: 'finance_transfer_money' },
  1380: { code: 'finance_batches' },
  1390: { code: 'finance_reconcile',         extra: 'reconcile' },
  1400: { code: 'finance_statement',         extra: 'download' },
  1410: { code: 'finance_transactions' },
  1420: { code: 'addresses_export',          extra: 'download' },
  1430: { code: 'membership_statistics',     extra: 'download' },
  1440: { code: 'finance_accounts' },
  1450: { code: 'finance_categories' },
  1460: { code: 'group_faculties' },
  1470: { code: 'group_venues' },
  1480: { code: 'member_classes' },
  1490: { code: 'letters',                   extra: 'download' },
  1500: { code: 'member_statuses' },
  1510: { code: 'group_ledger_all',          extra: 'download' },
  1520: { code: 'group_ledger_as_leader',    extra: 'download' },
  1530: { code: 'meetings' },
  1540: { code: 'calendar',                  extra: 'download' },
  1550: { code: 'email_standard_messages' },
  1560: { code: 'system_messages' },
  1570: { code: 'public_links' },
  1580: { code: 'groups_add_by_name' },
  1590: { code: 'groups_add_by_name_leader' },
  1600: { code: 'groups_add_by_no' },
  1610: { code: 'groups_add_by_no_leader' },
  1620: { code: 'email_addresses',           extra: 'download' },
  1630: { code: 'offices' },
  1640: { code: 'data_export_backup',        extra: 'download' },
  1650: { code: 'letters_standard_messages' },
  1660: { code: 'email_delivery',            extra: 'all' },
  1670: { code: 'group_statement',           extra: 'download' },
  // 1680 ($pMEMNEWNOTIFY) has no Beacon2 equivalent
};

function beaconPrivkeyToBeacon2(privkey) {
  const digit = privkey % 10;     // 1–5
  const base  = privkey - digit;  // e.g. 1411 → base 1410
  const entry = BEACON_PRIV_BASE[base];
  if (!entry) return null;        // unknown / obsolete base — skip silently
  const { code, extra } = entry;
  if (digit === 1) return { code, action: 'view' };
  if (digit === 2) return { code, action: 'create' };
  if (digit === 3) return { code, action: 'change' };
  if (digit === 4) return { code, action: 'delete' };
  if (digit === 5) return extra ? { code, action: extra } : null;
  return null;
}

export async function restoreBeacon(tx, wb) {
  const get = (name) => sheetRows(wb.getWorksheet(name));

  // Pre-hash the default password once (bcrypt is slow by design)
  const defaultPasswordHash = await hashPassword(BEACON_DEFAULT_PASSWORD);

  const statusMap  = {};
  const classMap   = {};
  const addressMap = {};
  const memberMap  = {};
  const memberByNo = {};
  const facultyMap = {};
  const groupMap   = {};
  const accountMap = {};
  const catMap     = {};
  const transMap   = {};
  const pollMap    = {};
  const roleMap    = {};   // rkey → new UUID

  // 1. Member statuses
  for (const r of get('Member Statuses')) {
    const stakey = String(r.stakey || '').trim();
    if (!stakey) continue;
    const newId = uuid();
    statusMap[stakey] = { id: newId, name: String(r.status || '') };
    await tx.$executeRawUnsafe(
      `INSERT INTO member_statuses (id, name, locked) VALUES ($1,$2,$3)`,
      newId, String(r.status || ''), parseBool(r.locked),
    );
  }

  // 2. Member classes
  for (const r of get('Membership Classes')) {
    const mckey = String(r.mckey || '').trim();
    if (!mckey) continue;
    const newId = uuid();
    classMap[mckey] = { id: newId, name: String(r.class || '') };
    await tx.$executeRawUnsafe(
      `INSERT INTO member_classes
         (id, name, current, is_joint, is_associate, fee, locked)
       VALUES ($1,$2,$3,$4,$5,$6::numeric,$7)`,
      newId, String(r.class || ''), parseBool(r.status),
      parseBool(r.family), parseBool(r.associate),
      parseDec(r.fee), parseBool(r.locked),
    );
  }

  // 3. Class monthly fees
  for (const r of get('Membership Fees')) {
    const mckey = String(r.mckey || '').trim();
    const cm = classMap[mckey];
    if (!cm) continue;
    const rawMonth = parseInt(r.month);
    const monthIdx = rawMonth === 0 ? 13 : rawMonth;
    if (monthIdx < 1 || monthIdx > 13) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO class_monthly_fees (id, class_id, month_index, fee)
       VALUES (gen_random_uuid()::text,$1,$2,$3::numeric)
       ON CONFLICT (class_id, month_index) DO NOTHING`,
      cm.id, monthIdx, parseDec(r.fee),
    );
  }

  // 4. Addresses
  const memberRows = get('Members');
  const addrData = {};
  for (const r of memberRows) {
    const akey = String(r.akey || '').trim();
    if (!akey || addrData[akey]) continue;
    addrData[akey] = {
      house_no: str(r.house), street: str(r.address1),
      add_line1: str(r.address2), add_line2: str(r.address3),
      town: str(r.town), county: str(r.county),
      postcode: str(r.postcode), telephone: str(r.telephone),
    };
  }
  for (const [akey, data] of Object.entries(addrData)) {
    const newId = uuid();
    addressMap[akey] = newId;
    await tx.$executeRawUnsafe(
      `INSERT INTO addresses (id, house_no, street, add_line1, add_line2, town, county, postcode, telephone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      newId, data.house_no, data.street, data.add_line1, data.add_line2,
      data.town, data.county, data.postcode, data.telephone,
    );
  }

  // 5. Members
  const statusByName = Object.fromEntries(
    Object.values(statusMap).map((s) => [s.name.toLowerCase(), s.id]),
  );
  const classByName = Object.fromEntries(
    Object.values(classMap).map((c) => [c.name.toLowerCase(), c.id]),
  );
  const membersByAkey = {};
  for (const r of memberRows) {
    const akey = String(r.akey || '').trim();
    if (akey) {
      if (!membersByAkey[akey]) membersByAkey[akey] = [];
      membersByAkey[akey].push(String(r.mkey || '').trim());
    }
  }

  for (const r of memberRows) {
    const mkey = String(r.mkey || '').trim();
    if (!mkey) continue;
    const newId = uuid();
    memberMap[mkey] = newId;
    const memNo = parseInt(r.mem_no);
    if (!isNaN(memNo)) memberByNo[memNo] = newId;

    const akey = String(r.akey || '').trim();
    const statusId = statusByName[String(r.status || '').toLowerCase()] || null;
    const classId  = classByName[String(r.class || '').toLowerCase()]  || null;

    await tx.$executeRawUnsafe(
      `INSERT INTO members
         (id, membership_number, title, forenames, surname, suffix, known_as, initials,
          mobile, email, home_u3a, joined_on, next_renewal, gift_aid_from, notes, hide_contact,
          status_id, class_id, address_id)
       VALUES ($1,
         CASE WHEN $2::integer IS NULL THEN nextval('membership_number_seq') ELSE $2::integer END,
         $3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14::date,$15,$16,$17,$18,$19)`,
      newId, isNaN(memNo) ? null : memNo, str(r.title),
      String(r.forename || ''), String(r.surname || ''),
      str(r.suffix), str(r.known_as), str(r.initials),
      str(r.mobile), str(r['e-mail']), str(r.affiliation),
      parseDate(r.joined), parseDate(r.renew), parseDate(r.gift_aid),
      str(r.mem_notes), parseBool(r.enhanced_privacy),
      statusId, classId, akey ? (addressMap[akey] || null) : null,
    );
  }

  // 6. Partner links
  for (const mkeyList of Object.values(membersByAkey)) {
    if (mkeyList.length !== 2) continue;
    const [id1, id2] = [memberMap[mkeyList[0]], memberMap[mkeyList[1]]];
    if (!id1 || !id2) continue;
    await tx.$executeRawUnsafe(`UPDATE members SET partner_id = $1 WHERE id = $2`, id2, id1);
    await tx.$executeRawUnsafe(`UPDATE members SET partner_id = $1 WHERE id = $2`, id1, id2);
  }

  // 7. Faculties
  const facRows = get('Faculties');
  for (const r of facRows) {
    const gfkey = String(r.gfkey || '').trim();
    if (!gfkey) continue;
    const newId = uuid();
    facultyMap[gfkey] = newId;
    await tx.$executeRawUnsafe(`INSERT INTO faculties (id, name) VALUES ($1,$2)`, newId, String(r.faculty || ''));
  }
  const facultyByName = Object.fromEntries(
    facRows.map((r) => [String(r.faculty || '').trim().toLowerCase(), facultyMap[String(r.gfkey || '').trim()]]),
  );

  // 7b. Venues
  const venueMap = {};
  for (const r of get('Venues')) {
    const gvkey = String(r.gvkey || '').trim();
    if (!gvkey) continue;
    const newId = uuid();
    venueMap[gvkey] = newId;
    await tx.$executeRawUnsafe(
      `INSERT INTO venues
         (id, name, address, postcode, telephone, contact, email, website, notes, private_address, accessible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      newId, String(r.venue || ''), str(r.address), str(r.postcode),
      str(r.telephone), str(r.contact), str(r.email), str(r.website),
      str(r.notes), parseBool(r.private), parseBool(r.accessible),
    );
  }

  // 8. Groups
  const groupRows = get('Groups');
  const seenGroups = new Set();
  const groupByName = {};
  for (const r of groupRows) {
    const gkey = String(r.gkey || '').trim();
    if (!gkey || seenGroups.has(gkey)) continue;
    seenGroups.add(gkey);
    const newId = uuid();
    groupMap[gkey] = newId;
    groupByName[String(r.group_name || '').trim().toLowerCase()] = newId;

    const facId    = facultyByName[String(r.faculty || '').trim().toLowerCase()] || null;
    const isActive = String(r.status || '').toLowerCase() !== 'inactive';
    const gvkey    = String(r.gvkey || '').trim();
    const venueId  = gvkey ? (venueMap[gvkey] || null) : null;

    await tx.$executeRawUnsafe(
      `INSERT INTO groups
         (id, name, faculty_id, status, when_text, start_time, end_time, venue, venue_id, enquiries,
          max_members, allow_online_join, enable_waiting_list, notify_leader)
       VALUES ($1,$2,$3,$4,$5,$6::time,$7::time,$8,$9,$10,$11,$12,$13,$14)`,
      newId, String(r.group_name || ''), facId,
      isActive ? 'active' : 'inactive',
      str(r.meets_when), str(r.start_time) || null, str(r.end_time) || null,
      str(r.venue), venueId, str(r.contact),
      r.max_members ? parseInt(r.max_members) : null,
      parseBool(r.join_online), parseBool(r.waiting_list), parseBool(r.notify_leader),
    );
  }

  // 9. Group members
  const seenGm = new Set();
  for (const r of get('Group members')) {
    const gkey  = String(r.gkey || '').trim();
    const memNo = parseInt(r.mem_no);
    const groupId  = groupMap[gkey];
    const memberId = isNaN(memNo) ? null : memberByNo[memNo];
    if (!groupId || !memberId) continue;
    const gmKey = `${groupId}:${memberId}`;
    if (seenGm.has(gmKey)) continue;
    seenGm.add(gmKey);

    const waitingRaw  = str(r.waiting);
    const waitingDate = (waitingRaw && waitingRaw !== '0') ? parseDate(waitingRaw) : null;

    await tx.$executeRawUnsafe(
      `INSERT INTO group_members (id, group_id, member_id, is_leader, waiting_since)
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4::date)
       ON CONFLICT (group_id, member_id) DO NOTHING`,
      groupId, memberId, parseBool(r.leader), waitingDate,
    );
  }

  // 9b. Group ledger entries
  for (const r of get('Group Ledgers')) {
    const gtkey = String(r.gtkey || '').trim();
    const gkey  = String(r.gkey || '').trim();
    const groupId = groupMap[gkey];
    if (!gtkey || !groupId) continue;
    const rawAmount = parseDec(r.amount);
    const moneyIn  = rawAmount != null && rawAmount >= 0 ? rawAmount : null;
    const moneyOut = rawAmount != null && rawAmount < 0 ? Math.abs(rawAmount) : null;
    await tx.$executeRawUnsafe(
      `INSERT INTO group_ledger_entries (id, group_id, entry_date, payee, detail, money_in, money_out)
       VALUES (gen_random_uuid()::text,$1,$2::date,$3,$4,$5::numeric,$6::numeric)`,
      groupId, parseDate(r.date), str(r.payee), str(r.detail), moneyIn, moneyOut,
    );
  }

  // 10. Finance Accounts
  const accRows = get('Finance Accounts');
  for (const r of accRows) {
    const acckey = String(r.acckey || '').trim();
    if (!acckey) continue;
    const newId = uuid();
    accountMap[acckey] = newId;
    await tx.$executeRawUnsafe(
      `INSERT INTO finance_accounts (id, name, active, locked) VALUES ($1,$2,$3,$4)`,
      newId, String(r.name || ''), parseBool(r.status), parseBool(r.locked),
    );
  }
  const accountByName = Object.fromEntries(
    accRows
      .filter((r) => String(r.acckey || '').trim())
      .map((r) => [String(r.name || '').trim().toLowerCase(), accountMap[String(r.acckey || '').trim()]]),
  );

  // 11. Finance Categories
  const catRows = get('Finance Categories');
  for (const r of catRows) {
    const catkey = String(r.catkey || '').trim();
    if (!catkey) continue;
    const newId = uuid();
    catMap[catkey] = newId;
    await tx.$executeRawUnsafe(
      `INSERT INTO finance_categories (id, name, active, locked) VALUES ($1,$2,$3,$4)`,
      newId, String(r.name || ''), parseBool(r.status), parseBool(r.locked),
    );
  }
  const catByName = Object.fromEntries(
    catRows
      .filter((r) => String(r.catkey || '').trim())
      .map((r) => [String(r.name || '').trim().toLowerCase(), catMap[String(r.catkey || '').trim()]]),
  );

  // 12. Transactions
  for (const r of get('Ledger')) {
    const tkey = String(r.tkey || '').trim();
    if (!tkey) continue;
    const rawAmount = parseDec(r.amount);
    if (rawAmount == null) continue;
    const type   = rawAmount >= 0 ? 'in' : 'out';
    const amount = Math.abs(rawAmount);
    const acctId = accountByName[String(r.account || '').trim().toLowerCase()] || null;
    if (!acctId) continue;

    const newId  = uuid();
    transMap[tkey] = newId;

    const groupId  = r.group ? (groupByName[String(r.group || '').trim().toLowerCase()] || null) : null;
    const mem1Id   = r.member_1 ? (memberByNo[parseInt(r.member_1)] || null) : null;
    const mem2Id   = r.member_2 ? (memberByNo[parseInt(r.member_2)] || null) : null;
    const clearedAt = r.cleared ? parseDate(r.cleared) : null;

    await tx.$executeRawUnsafe(
      `INSERT INTO transactions
         (id, transaction_number, account_id, date, type, from_to, amount,
          payment_method, payment_ref, detail, remarks,
          member_id_1, member_id_2, group_id, cleared_at)
       VALUES ($1,$2,$3,$4::date,$5,$6,$7::numeric,$8,$9,$10,$11,$12,$13,$14,$15::date)`,
      newId, parseInt(r.trans_no), acctId, parseDate(r.date),
      type, str(r.payee), amount,
      str(r.payment_method), str(r.cheque), str(r.detail), str(r.notes),
      mem1Id, mem2Id, groupId, clearedAt,
    );
  }

  // 13. Transaction categories
  for (const r of get('Detail')) {
    const tkey  = String(r.tkey || '').trim();
    const txnId = transMap[tkey];
    if (!txnId) continue;
    const catId   = catByName[String(r.category || '').trim().toLowerCase()] || null;
    if (!catId) continue;
    const rawAmt = parseDec(r.amount);
    if (rawAmt == null) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO transaction_categories (id, transaction_id, category_id, amount)
       VALUES (gen_random_uuid()::text,$1,$2,$3::numeric)
       ON CONFLICT (transaction_id, category_id) DO NOTHING`,
      txnId, catId, Math.abs(rawAmt),
    );
  }

  // 14. Offices
  for (const r of get('u3a Officers')) {
    const ofkey = String(r.ofkey || '').trim();
    if (!ofkey) continue;
    const mkey    = String(r.mkey || '').trim();
    const memberId = mkey ? (memberMap[mkey] || null) : null;
    await tx.$executeRawUnsafe(
      `INSERT INTO offices (id, name, member_id, office_email) VALUES ($1,$2,$3,$4)`,
      uuid(), String(r.office || ''), memberId, str(r['e-mail']),
    );
  }

  // 15. Polls
  for (const r of get('Polls')) {
    const pkey = String(r.pkey || '').trim();
    if (!pkey) continue;
    const newId = uuid();
    pollMap[pkey] = newId;
    await tx.$executeRawUnsafe(
      `INSERT INTO polls (id, name, description, member_can_set) VALUES ($1,$2,$3,$4)`,
      newId, String(r.poll || ''), '', false,
    );
  }

  // 16. Poll assignments
  for (const r of get('Poll assignments')) {
    const pkey = String(r.pkey || '').trim();
    const mkey = String(r.mkey || '').trim();
    const pollId   = pollMap[pkey];
    const memberId = memberMap[mkey];
    if (!pollId || !memberId) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO poll_members (poll_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      pollId, memberId,
    );
  }

  // 17. Roles (from Beacon Roles sheet)
  const roleRows = get('Roles');
  for (const r of roleRows) {
    const rkey = String(r.rkey || '').trim();
    if (!rkey) continue;
    const newId = uuid();
    roleMap[rkey] = newId;
    await tx.$executeRawUnsafe(
      `INSERT INTO roles (id, name, is_committee, notes) VALUES ($1,$2,$3,$4)`,
      newId, String(r.r_name || ''), parseBool(r.committee_role), str(r.notes),
    );
  }

  // 18. Users (from Beacon System Users — no passwords; accounts exist but can't log in until reset)
  const userMap = {};  // ukey → newId
  for (const r of get('System Users')) {
    const ukey = String(r.ukey || '').trim();
    if (!ukey) continue;
    const newId = uuid();
    userMap[ukey] = newId;
    const mkey    = String(r.mkey || '').trim();
    const memberId = mkey ? (memberMap[mkey] || null) : null;
    // email is unknown from Beacon export; use a unique placeholder so NOT NULL UNIQUE is satisfied
    const placeholderEmail = `${newId}@beacon-migrated.invalid`;

    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, name, email, username, password_hash, active, member_id, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      newId, String(r.fullname || ''), placeholderEmail,
      str(r.username) || null, defaultPasswordHash, true, memberId,
    );
  }

  // 19. User roles (Beacon: rkey is the primary role for each user)
  for (const r of get('System Users')) {
    const ukey = String(r.ukey || '').trim();
    const rkey = String(r.rkey || '').trim();
    const userId = userMap[ukey];
    const roleId = roleMap[rkey];
    if (!userId || !roleId) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      userId, roleId,
    );
  }

  // 19.5. Role privileges (from Beacon Privileges sheet — rkey + privkey)
  // Each privkey is decoded to a Beacon2 (resource_code, action) pair via BEACON_PRIV_BASE.
  // The resource_id is resolved inline from privilege_resources; unknown privkeys are skipped.
  for (const r of get('Privileges')) {
    const rkey    = String(r.rkey    || '').trim();
    const privkey = parseInt(r.privkey) || 0;
    const roleId  = roleMap[rkey];
    if (!roleId || !privkey) continue;
    const mapped = beaconPrivkeyToBeacon2(privkey);
    if (!mapped) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO role_privileges (id, role_id, resource_id, action)
       SELECT gen_random_uuid()::text, $1, pr.id, $2
       FROM privilege_resources pr WHERE pr.code = $3
       ON CONFLICT (role_id, resource_id, action) DO NOTHING`,
      roleId, mapped.action, mapped.code,
    );
  }

  // 20. Settings
  const ss1 = get('Site Settings 1');
  const ss1Map = Object.fromEntries(ss1.map((r) => [String(r.name || ''), String(r.value ?? '')]));

  const updates = {
    advance_renewals_weeks:   ss1Map['AdvRenewals']       ? parseInt(ss1Map['AdvRenewals'])       : null,
    grace_lapse_weeks:        ss1Map['GraceLapse']        ? parseInt(ss1Map['GraceLapse'])        : null,
    gift_aid_enabled:         ss1Map['GiftAidEnable']    != null ? ss1Map['GiftAidEnable']    === '1' : null,
    gift_aid_online_renewals: ss1Map['GiftAidOnlineRenew'] != null ? ss1Map['GiftAidOnlineRenew'] === '1' : null,
    default_town:             ss1Map['DefaultTown']  || null,
    default_county:           ss1Map['DefaultCounty'] || null,
    default_std_code:         ss1Map['DefaultSTD']   || null,
    default_payment_method:   BEACON_PAYMENT[ss1Map['defaultPaymentMethod']] || null,
    public_phone:             ss1Map['EnqTelephone'] || null,
    public_email:             ss1Map['EnqEmail']     || null,
    online_join_email:        ss1Map['EnqNewMem']    || null,
    online_renew_email:       ss1Map['EnqRenew']     || null,
  };

  const setClauses = [];
  const params = [];
  let pi = 1;
  for (const [col, val] of Object.entries(updates)) {
    if (val !== null) { setClauses.push(`${col} = $${pi++}`); params.push(val); }
  }
  if (setClauses.length > 0) {
    await tx.$executeRawUnsafe(
      `UPDATE tenant_settings SET ${setClauses.join(', ')} WHERE id = 'singleton'`, ...params,
    );
  }

  const ss2 = get('Site Settings 2');
  const ss2Map = Object.fromEntries(ss2.map((r) => [String(r.setting || ''), String(r.value ?? '')]));
  if (ss2Map['paypal_account']) {
    await tx.$executeRawUnsafe(
      `UPDATE tenant_settings SET paypal_email = $1 WHERE id = 'singleton'`, ss2Map['paypal_account'],
    );
  }

  // Apply the default Standard Beacon Implementation preset — all features on
  // except SiteWorks Integration and Custom Fields.  The legacy Beacon export
  // carries no feature_config, so without this the u3a would inherit whatever
  // happened to be on the tenant (or, for a fresh tenant, FEATURE_DEFAULTS_OFF
  // would leave giftAid / groupLedger off).
  await tx.$executeRawUnsafe(
    `UPDATE tenant_settings SET feature_config = $1::jsonb WHERE id = 'singleton'`,
    JSON.stringify(STANDARD_IMPLEMENTATIONS[0].features),
  );

  await resetSequences(tx);
}

export default router;
