// beacon2/backend/src/routes/backup/restore.js
// Restore helpers — consumed by system.js (system-admin only) to rebuild a
// tenant from a Beacon2 or legacy Beacon Excel workbook.

import { hashPassword } from '../../utils/password.js';
import { v4 as uuid } from 'uuid';
import { STANDARD_IMPLEMENTATIONS } from '../../../../shared/constants.js';
import { str } from './helpers.js';

// ── Worksheet / cell parsers ───────────────────────────────────────────────────

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
      headers.forEach((h, i) => {
        obj[h] = vals[i] ?? null;
      });
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

/** Parse a Beacon-format combined "date/time" cell into { date, time }.
 *  Accepts Excel Date objects, strings like "2024-01-15 19:00" or "15/01/2024 19:00",
 *  or date-only values.  Returns ISO date (YYYY-MM-DD) and time (HH:MM) or nulls. */
export function parseBeaconDateTime(val) {
  if (val == null || val === '') return { date: null, time: null };
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return { date: null, time: null };
    return {
      date: val.toISOString().slice(0, 10),
      time: val.toISOString().slice(11, 16),
    };
  }
  const s = String(val).trim();
  if (!s) return { date: null, time: null };
  const parts = s.split(/[ T]+/);
  return {
    date: parseDate(parts[0]),
    time: parts[1] ? parts[1].slice(0, 5) : null,
  };
}

export function parseDec(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

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
      r.id,
      String(r.name || ''),
      parseBool(r.locked),
    );
  }

  // 2. Member classes
  for (const r of get('Membership Classes')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO member_classes
         (id, name, current, explanation, is_joint, is_associate, show_online, fee, gift_aid_fee, locked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::numeric,$9::numeric,$10) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      parseBool(r.current),
      str(r.explanation),
      parseBool(r.is_joint),
      parseBool(r.is_associate),
      parseBool(r.show_online),
      parseDec(r.fee),
      parseDec(r.gift_aid_fee),
      parseBool(r.locked),
    );
  }

  // 3. Class monthly fees
  for (const r of get('Membership Fees')) {
    if (!r.class_id || r.month_index == null) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO class_monthly_fees (id, class_id, month_index, fee, gift_aid_fee)
       VALUES (gen_random_uuid()::text,$1,$2,$3::numeric,$4::numeric)
       ON CONFLICT (class_id, month_index) DO NOTHING`,
      r.class_id,
      parseInt(r.month_index),
      parseDec(r.fee),
      parseDec(r.gift_aid_fee),
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
      r.address_id,
      str(r.house_no),
      str(r.street),
      str(r.add_line1),
      str(r.add_line2),
      str(r.town),
      str(r.county),
      str(r.postcode),
      str(r.telephone),
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
      r.id,
      parseInt(r.membership_number),
      str(r.title),
      String(r.forenames || ''),
      String(r.surname || ''),
      str(r.suffix),
      str(r.known_as),
      str(r.initials),
      str(r.mobile),
      str(r.email),
      str(r.home_u3a),
      parseDate(r.joined_on),
      parseDate(r.next_renewal),
      parseDate(r.gift_aid_from),
      str(r.notes),
      parseBool(r.hide_contact),
      str(r.emergency_contact),
      str(r.custom_field_1),
      str(r.custom_field_2),
      str(r.custom_field_3),
      str(r.custom_field_4),
      str(r.status_id),
      str(r.class_id),
      str(r.address_id),
    );
  }

  // 6. Restore partner links
  for (const r of membersData) {
    if (!r.id || !r.partner_id) continue;
    await tx.$executeRawUnsafe(
      `UPDATE members SET partner_id = $1 WHERE id = $2`,
      r.partner_id,
      r.id,
    );
  }

  // 7. Faculties
  for (const r of get('Faculties')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO faculties (id, name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
    );
  }

  // 7b. Venues (must come before Groups so venue_id FK is valid)
  for (const r of get('Venues')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO venues
         (id, name, address, postcode, telephone, contact, email, website, notes, private_address, accessible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      str(r.address),
      str(r.postcode),
      str(r.telephone),
      str(r.contact),
      str(r.email),
      str(r.website),
      str(r.notes),
      parseBool(r.private_address),
      parseBool(r.accessible),
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
      r.id,
      String(r.name || ''),
      str(r.short_name) || null,
      String(r.type || 'group'),
      str(r.faculty_id),
      String(r.status || 'active'),
      str(r.when_text),
      str(r.start_time) || null,
      str(r.end_time) || null,
      str(r.venue),
      str(r.venue_id),
      str(r.enquiries),
      r.max_members ? parseInt(r.max_members) : null,
      parseBool(r.allow_online_join),
      parseBool(r.enable_waiting_list),
      parseBool(r.notify_leader),
      parseBool(r.display_waiting_list),
      str(r.information),
      str(r.notes),
      parseBool(r.show_addresses),
    );
  }

  // 9. Group members
  for (const r of get('Group members')) {
    if (!r.id || !r.group_id || !r.member_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO group_members (id, group_id, member_id, is_leader, waiting_since)
       VALUES ($1,$2,$3,$4,$5::date) ON CONFLICT (id) DO NOTHING`,
      r.id,
      r.group_id,
      r.member_id,
      parseBool(r.is_leader),
      parseDate(r.waiting_since),
    );
  }

  // 9b. Group ledger entries
  for (const r of get('Group Ledgers')) {
    if (!r.id || !r.group_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO group_ledger_entries (id, group_id, entry_date, payee, detail, money_in, money_out)
       VALUES ($1,$2,$3::date,$4,$5,$6::numeric,$7::numeric) ON CONFLICT (id) DO NOTHING`,
      r.id,
      r.group_id,
      parseDate(r.entry_date),
      str(r.payee),
      str(r.detail),
      parseDec(r.money_in),
      parseDec(r.money_out),
    );
  }

  // 9c. Event types
  for (const r of get('Event Types')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO event_types (id, name, description, is_default)
       VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      str(r.description),
      parseBool(r.is_default),
    );
  }

  // 9d. Group events (schedule)
  for (const r of get('Group Events')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO group_events
         (id, group_id, event_date, start_time, end_time, venue_id, contact, details, topic, is_private, event_type_id)
       VALUES ($1,$2,$3::date,$4::time,$5::time,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      r.id,
      str(r.group_id),
      parseDate(r.event_date),
      str(r.start_time) || null,
      str(r.end_time) || null,
      str(r.venue_id),
      str(r.contact),
      str(r.details),
      str(r.topic),
      parseBool(r.is_private),
      str(r.event_type_id),
    );
  }

  // 9e. Event members
  for (const r of get('Event Members')) {
    if (!r.id || !r.event_id || !r.member_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO event_members (id, event_id, member_id, is_organiser, notes)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      r.id,
      r.event_id,
      r.member_id,
      parseBool(r.is_organiser),
      str(r.notes),
    );
  }

  // 10. Finance Accounts
  for (const r of get('Finance Accounts')) {
    if (!r.id) continue;
    let pendingTypes;
    try {
      pendingTypes = JSON.parse(r.pending_types || '[]');
    } catch {
      pendingTypes = [];
    }
    const ptArr = Array.isArray(pendingTypes) ? pendingTypes : [];
    const ptStr =
      '{' +
      ptArr
        .map((s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"')
        .join(',') +
      '}';
    await tx.$executeRawUnsafe(
      `INSERT INTO finance_accounts
         (id, name, active, locked, sort_order, pending_config, pending_types,
          enable_refunds, balance_brought_forward)
       VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,$9::numeric) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      parseBool(r.active),
      parseBool(r.locked),
      r.sort_order ? parseInt(r.sort_order) : 0,
      String(r.pending_config || 'disabled'),
      ptStr,
      parseBool(r.enable_refunds),
      parseDec(r.balance_brought_forward) ?? 0,
    );
  }

  // 11. Finance Categories
  for (const r of get('Finance Categories')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO finance_categories (id, name, active, locked, sort_order)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      parseBool(r.active),
      parseBool(r.locked),
      r.sort_order ? parseInt(r.sort_order) : 0,
    );
  }

  // 11b. Credit Batches (must precede transactions for batch_id FK)
  for (const r of get('Credit Batches')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO credit_batches (id, batch_ref, account_id, description, batch_date)
       VALUES ($1,$2,$3,$4,$5::date) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.batch_ref || ''),
      r.account_id,
      str(r.description),
      parseDate(r.batch_date),
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
      r.id,
      parseInt(r.transaction_number),
      r.account_id,
      parseDate(r.date),
      String(r.type || 'in'),
      str(r.from_to),
      parseDec(r.amount),
      str(r.payment_method),
      str(r.payment_ref),
      str(r.detail),
      str(r.remarks),
      str(r.member_id_1),
      str(r.member_id_2),
      str(r.group_id),
      str(r.event_id),
      parseDate(r.cleared_at),
      str(r.transfer_id),
      parseBool(r.pending),
      str(r.batch_id),
      parseDec(r.gift_aid_amount),
      parseDate(r.gift_aid_claimed_at),
      parseDec(r.gift_aid_amount_2),
      parseDate(r.gift_aid_claimed_at_2),
      str(r.refund_of_id),
      str(r.refunded_by_id),
    );
  }

  // 13. Transaction categories
  for (const r of get('Detail')) {
    if (!r.transaction_id || !r.category_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO transaction_categories (id, transaction_id, category_id, amount)
       VALUES (gen_random_uuid()::text,$1,$2,$3::numeric)
       ON CONFLICT (transaction_id, category_id) DO NOTHING`,
      r.transaction_id,
      r.category_id,
      parseDec(r.amount),
    );
  }

  // 14. Offices
  for (const r of get('u3a Officers')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO offices (id, name, member_id, office_email, notify_online_join)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      str(r.member_id),
      str(r.office_email),
      parseBool(r.notify_online_join),
    );
  }

  // 15. Polls
  for (const r of get('Polls')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO polls (id, name, description, member_can_set)
       VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      String(r.description || ''),
      parseBool(r.member_can_set),
    );
  }

  // 16. Poll members
  for (const r of get('Poll assignments')) {
    if (!r.poll_id || !r.member_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO poll_members (poll_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      r.poll_id,
      r.member_id,
    );
  }

  // 17. Roles
  for (const r of get('Roles')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO roles (id, name, is_committee, notes)
       VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      parseBool(r.is_committee),
      str(r.notes),
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
      r.role_id,
      String(r.action),
      String(r.resource_code),
    );
  }

  // 19. Users — password_hash from the backup is NEVER imported. A malicious
  // backup author could otherwise plant a known-password account and bind it
  // to the Administration role via the User roles sheet, then log in once and
  // take over the tenant. password_hash is left NULL (the schema allows it);
  // the sys-admin must use POST /system/tenants/:id/set-temp-password after
  // the restore so users can log in. must_change_password = true is kept so
  // that whatever password the sys-admin sets must be replaced on first use.
  for (const r of get('System Users')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, username, name, email, password_hash, active, member_id, must_change_password)
       VALUES ($1,$2,$3,$4,NULL,$5,$6,true) ON CONFLICT (id) DO NOTHING`,
      r.id,
      str(r.username),
      String(r.name || ''),
      String(r.email || ''),
      parseBool(r.active !== undefined ? r.active : 1),
      str(r.member_id),
    );
  }

  // 20. User roles
  for (const r of get('User roles')) {
    if (!r.user_id || !r.role_id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      r.user_id,
      r.role_id,
    );
  }

  // 21. Settings
  const settingsData = get('Site Settings 1');
  if (settingsData.length > 0) {
    const sm = Object.fromEntries(settingsData.map((r) => [String(r.setting || ''), r.value]));
    const v = (key) => {
      const val = sm[key];
      return val == null || val === '' ? null : val;
    };
    const vBool = (key) => {
      const val = sm[key];
      return val == null ? null : parseBool(val);
    };
    const vInt = (key) => {
      const val = sm[key];
      return val != null && val !== '' ? parseInt(val) : null;
    };
    const vJson = (key) => {
      const val = sm[key];
      if (val == null || val === '') return null;
      try {
        return typeof val === 'string' ? JSON.parse(val) : val;
      } catch {
        return null;
      }
    };

    await tx.$executeRawUnsafe(
      `
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
      v('card_colour'),
      vBool('email_cards'),
      v('public_phone'),
      v('public_email'),
      v('home_page'),
      v('online_join_email'),
      v('online_renew_email'),
      v('fee_variation'),
      vInt('extended_membership_month'),
      vInt('advance_renewals_weeks'),
      vInt('grace_lapse_weeks'),
      vInt('deletion_years'),
      v('default_payment_method'),
      vBool('gift_aid_enabled'),
      vBool('gift_aid_online_renewals'),
      v('default_town'),
      v('default_county'),
      v('default_std_code'),
      v('paypal_email'),
      v('paypal_cancel_url'),
      vBool('shared_address_warning'),
      vInt('year_start_month'),
      vInt('year_start_day'),
      vBool('online_joining_enabled'),
      v('privacy_policy_url'),
      vBool('group_bf_enabled'),
      vBool('siteworks_activated'),
      v('custom_field_label_1'),
      v('custom_field_label_2'),
      v('custom_field_label_3'),
      v('custom_field_label_4'),
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
      String(r.name || ''),
      String(r.subject || ''),
      String(r.body || ''),
      r.id,
    );
  }

  // 23. Standard messages (user-created email templates)
  for (const r of get('Standard Messages')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO standard_messages (id, name, subject, body)
       VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      String(r.subject || ''),
      String(r.body || ''),
    );
  }

  // 24. Standard letters (user-created letter templates)
  for (const r of get('Standard Letters')) {
    if (!r.id) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO standard_letters (id, name, body)
       VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      r.id,
      String(r.name || ''),
      String(r.body || ''),
    );
  }

  // 25. Payment method defaults
  for (const r of get('Payment Method Defaults')) {
    if (!r.payment_method) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO payment_method_defaults (payment_method, account_id)
       VALUES ($1,$2) ON CONFLICT (payment_method) DO UPDATE SET account_id = $2`,
      String(r.payment_method),
      str(r.account_id),
    );
  }

  await resetSequences(tx);
}

// ── Restore: Beacon (legacy) format ───────────────────────────────────────────

const BEACON_PAYMENT = {
  1: 'Cash',
  2: 'Cheque',
  3: 'Standing Order',
  4: 'Direct Debit',
  5: 'Online',
  6: 'Other',
};

export const BEACON_DEFAULT_PASSWORD = 'Beacon2!';

// ── Beacon privkey → Beacon2 (resource_code, action) mapping ─────────────────
// Beacon stores privileges as  privkey = base + digit
// where digit: 1=view 2=create 3=change 4=delete 5=extra(download/send/etc.)
// Source: docs/FromBeacon/privileges.php
const BEACON_PRIV_BASE = {
  1010: { code: 'members_list', extra: 'download' },
  1020: { code: 'member_record' },
  1030: { code: 'groups_list' },
  1040: { code: 'group_records_all', extra: 'download_members' },
  1050: { code: 'group_records_as_leader', extra: 'download_members' },
  1060: { code: 'group_records_as_member' },
  1110: { code: 'users_list' },
  1120: { code: 'user_record' },
  // 1130/1140 were obsolete PHP variable names later reassigned to 1340/1350
  1140: { code: 'role_record' }, // old $pROLERECORD (safety net)
  1150: { code: 'audit_trail' },
  1160: { code: 'audit_detail' },
  1170: { code: 'members_non_renewals', extra: 'lapse' },
  1180: { code: 'members_delete_expired' },
  1190: { code: 'members_recent', extra: 'download' },
  1200: { code: 'membership_cards', extra: 'download_and_mark' },
  1230: { code: 'settings' },
  1240: { code: 'address_labels', extra: 'download' },
  1250: { code: 'poll_set_up' },
  1255: { code: 'custom_fields' },
  1260: { code: 'gift_aid_declaration', extra: 'download_and_mark' },
  1270: { code: 'membership_renewals', extra: 'renew' },
  1310: { code: 'group_leaders', extra: 'email_labels' },
  1320: { code: 'email', extra: 'send' },
  1340: { code: 'roles_list' },
  1350: { code: 'role_record' },
  1360: { code: 'finance_ledger', extra: 'download' },
  1370: { code: 'finance_transfer_money' },
  1380: { code: 'finance_batches' },
  1390: { code: 'finance_reconcile', extra: 'reconcile' },
  1400: { code: 'finance_statement', extra: 'download' },
  1410: { code: 'finance_transactions' },
  1420: { code: 'addresses_export', extra: 'download' },
  1430: { code: 'membership_statistics', extra: 'download' },
  1440: { code: 'finance_accounts' },
  1450: { code: 'finance_categories' },
  1460: { code: 'group_faculties' },
  1470: { code: 'group_venues' },
  1480: { code: 'member_classes' },
  1490: { code: 'letters', extra: 'download' },
  1500: { code: 'member_statuses' },
  1510: { code: 'group_ledger_all', extra: 'download' },
  1520: { code: 'group_ledger_as_leader', extra: 'download' },
  1530: { code: 'meetings' },
  1540: { code: 'calendar', extra: 'download' },
  1550: { code: 'email_standard_messages' },
  1560: { code: 'system_messages' },
  1570: { code: 'public_links' },
  1580: { code: 'groups_add_by_name' },
  1590: { code: 'groups_add_by_name_leader' },
  1600: { code: 'groups_add_by_no' },
  1610: { code: 'groups_add_by_no_leader' },
  1620: { code: 'email_addresses', extra: 'download' },
  1630: { code: 'offices' },
  1640: { code: 'data_export_backup', extra: 'download' },
  1650: { code: 'letters_standard_messages' },
  1660: { code: 'email_delivery', extra: 'all' },
  1670: { code: 'group_statement', extra: 'download' },
  // 1680 ($pMEMNEWNOTIFY) has no Beacon2 equivalent
};

function beaconPrivkeyToBeacon2(privkey) {
  const digit = privkey % 10; // 1–5
  const base = privkey - digit; // e.g. 1411 → base 1410
  const entry = BEACON_PRIV_BASE[base];
  if (!entry) return null; // unknown / obsolete base — skip silently
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

  const statusMap = {};
  const classMap = {};
  const addressMap = {};
  const memberMap = {};
  const memberByNo = {};
  const facultyMap = {};
  const groupMap = {};
  const accountMap = {};
  const catMap = {};
  const transMap = {};
  const pollMap = {};
  const roleMap = {}; // rkey → new UUID

  // 1. Member statuses
  for (const r of get('Member Statuses')) {
    const stakey = String(r.stakey || '').trim();
    if (!stakey) continue;
    const newId = uuid();
    statusMap[stakey] = { id: newId, name: String(r.status || '') };
    await tx.$executeRawUnsafe(
      `INSERT INTO member_statuses (id, name, locked) VALUES ($1,$2,$3)`,
      newId,
      String(r.status || ''),
      parseBool(r.locked),
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
      newId,
      String(r.class || ''),
      parseBool(r.status),
      parseBool(r.family),
      parseBool(r.associate),
      parseDec(r.fee),
      parseBool(r.locked),
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
      cm.id,
      monthIdx,
      parseDec(r.fee),
    );
  }

  // 4. Addresses
  const memberRows = get('Members');
  const addrData = {};
  for (const r of memberRows) {
    const akey = String(r.akey || '').trim();
    if (!akey || addrData[akey]) continue;
    addrData[akey] = {
      house_no: str(r.house),
      street: str(r.address1),
      add_line1: str(r.address2),
      add_line2: str(r.address3),
      town: str(r.town),
      county: str(r.county),
      postcode: str(r.postcode),
      telephone: str(r.telephone),
    };
  }
  for (const [akey, data] of Object.entries(addrData)) {
    const newId = uuid();
    addressMap[akey] = newId;
    await tx.$executeRawUnsafe(
      `INSERT INTO addresses (id, house_no, street, add_line1, add_line2, town, county, postcode, telephone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      newId,
      data.house_no,
      data.street,
      data.add_line1,
      data.add_line2,
      data.town,
      data.county,
      data.postcode,
      data.telephone,
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
    const classId = classByName[String(r.class || '').toLowerCase()] || null;

    await tx.$executeRawUnsafe(
      `INSERT INTO members
         (id, membership_number, title, forenames, surname, suffix, known_as, initials,
          mobile, email, home_u3a, joined_on, next_renewal, gift_aid_from, notes, hide_contact,
          status_id, class_id, address_id)
       VALUES ($1,
         CASE WHEN $2::integer IS NULL THEN nextval('membership_number_seq') ELSE $2::integer END,
         $3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14::date,$15,$16,$17,$18,$19)`,
      newId,
      isNaN(memNo) ? null : memNo,
      str(r.title),
      String(r.forename || ''),
      String(r.surname || ''),
      str(r.suffix),
      str(r.known_as),
      str(r.initials),
      str(r.mobile),
      str(r['e-mail']),
      str(r.affiliation),
      parseDate(r.joined),
      parseDate(r.renew),
      parseDate(r.gift_aid),
      str(r.mem_notes),
      parseBool(r.enhanced_privacy),
      statusId,
      classId,
      akey ? addressMap[akey] || null : null,
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
    await tx.$executeRawUnsafe(
      `INSERT INTO faculties (id, name) VALUES ($1,$2)`,
      newId,
      String(r.faculty || ''),
    );
  }
  const facultyByName = Object.fromEntries(
    facRows.map((r) => [
      String(r.faculty || '')
        .trim()
        .toLowerCase(),
      facultyMap[String(r.gfkey || '').trim()],
    ]),
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
      newId,
      String(r.venue || ''),
      str(r.address),
      str(r.postcode),
      str(r.telephone),
      str(r.contact),
      str(r.email),
      str(r.website),
      str(r.notes),
      parseBool(r.private),
      parseBool(r.accessible),
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
    groupByName[
      String(r.group_name || '')
        .trim()
        .toLowerCase()
    ] = newId;

    const facId =
      facultyByName[
        String(r.faculty || '')
          .trim()
          .toLowerCase()
      ] || null;
    const isActive = String(r.status || '').toLowerCase() !== 'inactive';
    const gvkey = String(r.gvkey || '').trim();
    const venueId = gvkey ? venueMap[gvkey] || null : null;

    await tx.$executeRawUnsafe(
      `INSERT INTO groups
         (id, name, faculty_id, status, when_text, start_time, end_time, venue, venue_id, enquiries,
          max_members, allow_online_join, enable_waiting_list, notify_leader)
       VALUES ($1,$2,$3,$4,$5,$6::time,$7::time,$8,$9,$10,$11,$12,$13,$14)`,
      newId,
      String(r.group_name || ''),
      facId,
      isActive ? 'active' : 'inactive',
      str(r.meets_when),
      str(r.start_time) || null,
      str(r.end_time) || null,
      str(r.venue),
      venueId,
      str(r.contact),
      r.max_members ? parseInt(r.max_members) : null,
      parseBool(r.join_online),
      parseBool(r.waiting_list),
      parseBool(r.notify_leader),
    );
  }

  // 9. Group members
  const seenGm = new Set();
  for (const r of get('Group members')) {
    const gkey = String(r.gkey || '').trim();
    const memNo = parseInt(r.mem_no);
    const groupId = groupMap[gkey];
    const memberId = isNaN(memNo) ? null : memberByNo[memNo];
    if (!groupId || !memberId) continue;
    const gmKey = `${groupId}:${memberId}`;
    if (seenGm.has(gmKey)) continue;
    seenGm.add(gmKey);

    const waitingRaw = str(r.waiting);
    const waitingDate = waitingRaw && waitingRaw !== '0' ? parseDate(waitingRaw) : null;

    await tx.$executeRawUnsafe(
      `INSERT INTO group_members (id, group_id, member_id, is_leader, waiting_since)
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4::date)
       ON CONFLICT (group_id, member_id) DO NOTHING`,
      groupId,
      memberId,
      parseBool(r.leader),
      waitingDate,
    );
  }

  // 9b. Group ledger entries
  for (const r of get('Group Ledgers')) {
    const gtkey = String(r.gtkey || '').trim();
    const gkey = String(r.gkey || '').trim();
    const groupId = groupMap[gkey];
    if (!gtkey || !groupId) continue;
    const rawAmount = parseDec(r.amount);
    const moneyIn = rawAmount != null && rawAmount >= 0 ? rawAmount : null;
    const moneyOut = rawAmount != null && rawAmount < 0 ? Math.abs(rawAmount) : null;
    await tx.$executeRawUnsafe(
      `INSERT INTO group_ledger_entries (id, group_id, entry_date, payee, detail, money_in, money_out)
       VALUES (gen_random_uuid()::text,$1,$2::date,$3,$4,$5::numeric,$6::numeric)`,
      groupId,
      parseDate(r.date),
      str(r.payee),
      str(r.detail),
      moneyIn,
      moneyOut,
    );
  }

  // 9c. Open Meetings (Calendar entries with no gkey)
  // clearTenantData() removed the seeded "Open Meetings" event type, so re-create it.
  // Then process the Calendar sheet — rows without a gkey are u3a-wide Open Meetings.
  // Group-tied calendar entries (gkey set) are not restored here; that would require
  // resolving their group and is tracked separately in KNOWN-ISSUES.
  const openMeetingsEventTypeId = uuid();
  await tx.$executeRawUnsafe(
    `INSERT INTO event_types (id, name, description, is_default)
     VALUES ($1, 'Open Meetings', 'u3a-wide events not tied to any group', true)`,
    openMeetingsEventTypeId,
  );

  for (const r of get('Calendar')) {
    const gkey = String(r.gkey || '').trim();
    if (gkey) continue;
    const dt = parseBeaconDateTime(r['date/time']);
    if (!dt.date) continue;
    const gvkey = String(r.gvkey || '').trim();
    const venueId = gvkey ? venueMap[gvkey] || null : null;
    const endTimeRaw = r.end_time;
    const endTime = endTimeRaw
      ? endTimeRaw instanceof Date
        ? endTimeRaw.toISOString().slice(11, 16)
        : String(endTimeRaw).slice(0, 5)
      : null;
    await tx.$executeRawUnsafe(
      `INSERT INTO group_events
         (id, group_id, event_date, start_time, end_time, venue_id,
          contact, details, topic, is_private, event_type_id)
       VALUES ($1, NULL, $2::date, $3::time, $4::time, $5, $6, $7, $8, $9, $10)`,
      uuid(),
      dt.date,
      dt.time,
      endTime,
      venueId,
      str(r.enquiries),
      str(r.detail),
      str(r.topic),
      parseBool(r.exclude_public),
      openMeetingsEventTypeId,
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
      newId,
      String(r.name || ''),
      parseBool(r.status),
      parseBool(r.locked),
    );
  }
  const accountByName = Object.fromEntries(
    accRows
      .filter((r) => String(r.acckey || '').trim())
      .map((r) => [
        String(r.name || '')
          .trim()
          .toLowerCase(),
        accountMap[String(r.acckey || '').trim()],
      ]),
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
      newId,
      String(r.name || ''),
      parseBool(r.status),
      parseBool(r.locked),
    );
  }
  const catByName = Object.fromEntries(
    catRows
      .filter((r) => String(r.catkey || '').trim())
      .map((r) => [
        String(r.name || '')
          .trim()
          .toLowerCase(),
        catMap[String(r.catkey || '').trim()],
      ]),
  );

  // 12. Transactions
  for (const r of get('Ledger')) {
    const tkey = String(r.tkey || '').trim();
    if (!tkey) continue;
    const rawAmount = parseDec(r.amount);
    if (rawAmount == null) continue;
    const type = rawAmount >= 0 ? 'in' : 'out';
    const amount = Math.abs(rawAmount);
    const acctId =
      accountByName[
        String(r.account || '')
          .trim()
          .toLowerCase()
      ] || null;
    if (!acctId) continue;

    const newId = uuid();
    transMap[tkey] = newId;

    const groupId = r.group
      ? groupByName[
          String(r.group || '')
            .trim()
            .toLowerCase()
        ] || null
      : null;
    const mem1Id = r.member_1 ? memberByNo[parseInt(r.member_1)] || null : null;
    const mem2Id = r.member_2 ? memberByNo[parseInt(r.member_2)] || null : null;
    const clearedAt = r.cleared ? parseDate(r.cleared) : null;

    await tx.$executeRawUnsafe(
      `INSERT INTO transactions
         (id, transaction_number, account_id, date, type, from_to, amount,
          payment_method, payment_ref, detail, remarks,
          member_id_1, member_id_2, group_id, cleared_at)
       VALUES ($1,$2,$3,$4::date,$5,$6,$7::numeric,$8,$9,$10,$11,$12,$13,$14,$15::date)`,
      newId,
      parseInt(r.trans_no),
      acctId,
      parseDate(r.date),
      type,
      str(r.payee),
      amount,
      str(r.payment_method),
      str(r.cheque),
      str(r.detail),
      str(r.notes),
      mem1Id,
      mem2Id,
      groupId,
      clearedAt,
    );
  }

  // 13. Transaction categories
  for (const r of get('Detail')) {
    const tkey = String(r.tkey || '').trim();
    const txnId = transMap[tkey];
    if (!txnId) continue;
    const catId =
      catByName[
        String(r.category || '')
          .trim()
          .toLowerCase()
      ] || null;
    if (!catId) continue;
    const rawAmt = parseDec(r.amount);
    if (rawAmt == null) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO transaction_categories (id, transaction_id, category_id, amount)
       VALUES (gen_random_uuid()::text,$1,$2,$3::numeric)
       ON CONFLICT (transaction_id, category_id) DO NOTHING`,
      txnId,
      catId,
      Math.abs(rawAmt),
    );
  }

  // 14. Offices
  for (const r of get('u3a Officers')) {
    const ofkey = String(r.ofkey || '').trim();
    if (!ofkey) continue;
    const mkey = String(r.mkey || '').trim();
    const memberId = mkey ? memberMap[mkey] || null : null;
    await tx.$executeRawUnsafe(
      `INSERT INTO offices (id, name, member_id, office_email) VALUES ($1,$2,$3,$4)`,
      uuid(),
      String(r.office || ''),
      memberId,
      str(r['e-mail']),
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
      newId,
      String(r.poll || ''),
      '',
      false,
    );
  }

  // 16. Poll assignments
  for (const r of get('Poll assignments')) {
    const pkey = String(r.pkey || '').trim();
    const mkey = String(r.mkey || '').trim();
    const pollId = pollMap[pkey];
    const memberId = memberMap[mkey];
    if (!pollId || !memberId) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO poll_members (poll_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      pollId,
      memberId,
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
      newId,
      String(r.r_name || ''),
      parseBool(r.committee_role),
      str(r.notes),
    );
  }

  // 18. Users (from Beacon System Users — no passwords; accounts exist but can't log in until reset)
  const userMap = {}; // ukey → newId
  for (const r of get('System Users')) {
    const ukey = String(r.ukey || '').trim();
    if (!ukey) continue;
    const newId = uuid();
    userMap[ukey] = newId;
    const mkey = String(r.mkey || '').trim();
    const memberId = mkey ? memberMap[mkey] || null : null;
    // email is unknown from Beacon export; use a unique placeholder so NOT NULL UNIQUE is satisfied
    const placeholderEmail = `${newId}@beacon-migrated.invalid`;

    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, name, email, username, password_hash, active, member_id, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      newId,
      String(r.fullname || ''),
      placeholderEmail,
      str(r.username) || null,
      defaultPasswordHash,
      true,
      memberId,
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
      userId,
      roleId,
    );
  }

  // 19.5. Role privileges (from Beacon Privileges sheet — rkey + privkey)
  // Each privkey is decoded to a Beacon2 (resource_code, action) pair via BEACON_PRIV_BASE.
  // The resource_id is resolved inline from privilege_resources; unknown privkeys are skipped.
  for (const r of get('Privileges')) {
    const rkey = String(r.rkey || '').trim();
    const privkey = parseInt(r.privkey) || 0;
    const roleId = roleMap[rkey];
    if (!roleId || !privkey) continue;
    const mapped = beaconPrivkeyToBeacon2(privkey);
    if (!mapped) continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO role_privileges (id, role_id, resource_id, action)
       SELECT gen_random_uuid()::text, $1, pr.id, $2
       FROM privilege_resources pr WHERE pr.code = $3
       ON CONFLICT (role_id, resource_id, action) DO NOTHING`,
      roleId,
      mapped.action,
      mapped.code,
    );
  }

  // 20. Settings
  const ss1 = get('Site Settings 1');
  const ss1Map = Object.fromEntries(ss1.map((r) => [String(r.name || ''), String(r.value ?? '')]));

  const updates = {
    advance_renewals_weeks: ss1Map['AdvRenewals'] ? parseInt(ss1Map['AdvRenewals']) : null,
    grace_lapse_weeks: ss1Map['GraceLapse'] ? parseInt(ss1Map['GraceLapse']) : null,
    gift_aid_enabled: ss1Map['GiftAidEnable'] != null ? ss1Map['GiftAidEnable'] === '1' : null,
    gift_aid_online_renewals:
      ss1Map['GiftAidOnlineRenew'] != null ? ss1Map['GiftAidOnlineRenew'] === '1' : null,
    default_town: ss1Map['DefaultTown'] || null,
    default_county: ss1Map['DefaultCounty'] || null,
    default_std_code: ss1Map['DefaultSTD'] || null,
    default_payment_method: BEACON_PAYMENT[ss1Map['defaultPaymentMethod']] || null,
    public_phone: ss1Map['EnqTelephone'] || null,
    public_email: ss1Map['EnqEmail'] || null,
    online_join_email: ss1Map['EnqNewMem'] || null,
    online_renew_email: ss1Map['EnqRenew'] || null,
  };

  const setClauses = [];
  const params = [];
  let pi = 1;
  for (const [col, val] of Object.entries(updates)) {
    if (val !== null) {
      setClauses.push(`${col} = $${pi++}`);
      params.push(val);
    }
  }
  if (setClauses.length > 0) {
    await tx.$executeRawUnsafe(
      `UPDATE tenant_settings SET ${setClauses.join(', ')} WHERE id = 'singleton'`,
      ...params,
    );
  }

  const ss2 = get('Site Settings 2');
  const ss2Map = Object.fromEntries(
    ss2.map((r) => [String(r.setting || ''), String(r.value ?? '')]),
  );
  if (ss2Map['paypal_account']) {
    await tx.$executeRawUnsafe(
      `UPDATE tenant_settings SET paypal_email = $1 WHERE id = 'singleton'`,
      ss2Map['paypal_account'],
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
