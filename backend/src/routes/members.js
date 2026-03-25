// beacon2/backend/src/routes/members.js

import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

// ─── helpers ──────────────────────────────────────────────────────────────

/** Look up the Gift Aid eligible amount for a member at a given date.
 *  Returns null if GA is not enabled, member has no GA declaration, or no GA fee configured.
 */
async function resolveGiftAidAmount(slug, memberId, classId, transactionDate) {
  // Check if GA is enabled
  const [settings] = await tenantQuery(
    slug,
    `SELECT gift_aid_enabled, fee_variation FROM tenant_settings WHERE id = 'singleton'`,
  );
  if (!settings?.gift_aid_enabled) return null;

  // Check if member has a GA declaration at or before the transaction date
  const [m] = await tenantQuery(
    slug,
    `SELECT gift_aid_from FROM members WHERE id = $1`,
    [memberId],
  );
  if (!m?.gift_aid_from) return null;
  const gaFrom = String(m.gift_aid_from).slice(0, 10);
  const txDate = String(transactionDate).slice(0, 10);
  if (gaFrom > txDate) return null;

  // Look up the GA fee from the class
  if (settings.fee_variation === 'varies_by_month') {
    // Month-specific: find the fee for the transaction month
    const txMonth = new Date(txDate).getMonth() + 1; // 1-12
    const [monthFee] = await tenantQuery(
      slug,
      `SELECT gift_aid_fee::float FROM class_monthly_fees WHERE class_id = $1 AND month_index = $2`,
      [classId, txMonth],
    );
    return monthFee?.gift_aid_fee ?? null;
  }

  // Standard: use the class-level gift_aid_fee
  const [cls] = await tenantQuery(
    slug,
    `SELECT gift_aid_fee::float FROM member_classes WHERE id = $1`,
    [classId],
  );
  return cls?.gift_aid_fee ?? null;
}

/** Derive initials from a forenames string: "William John" → "WJ" */
function deriveInitials(forenames) {
  return (forenames ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join('');
}

// ─── GET /members ─────────────────────────────────────────────────────────
// Query params:
//   status      – comma-separated list of status IDs  (default: all)
//   classId     – single class ID
//   pollId      – filter to members in this poll
//   negatePoll  – '1' to invert: members NOT in the poll
//   q           – free-text search
//   letter      – single letter to filter surname start

router.get('/', requirePrivilege('members_list', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { status, classId, pollId, negatePoll, q, letter, cf } = req.query;

    const conditions = [];
    const params = [];
    let i = 1;

    if (status) {
      const ids = status.split(',').filter(Boolean);
      if (ids.length) {
        conditions.push(`m.status_id = ANY($${i++}::text[])`);
        params.push(ids);
      }
    }

    if (classId) {
      conditions.push(`m.class_id = $${i++}`);
      params.push(classId);
    }

    if (pollId) {
      if (negatePoll === '1') {
        conditions.push(`m.id NOT IN (SELECT member_id FROM poll_members WHERE poll_id = $${i++})`);
      } else {
        conditions.push(`m.id IN (SELECT member_id FROM poll_members WHERE poll_id = $${i++})`);
      }
      params.push(pollId);
    }

    if (letter && /^[A-Z]$/i.test(letter)) {
      conditions.push(`upper(m.surname) LIKE $${i++}`);
      params.push(letter.toUpperCase() + '%');
    }

    if (q) {
      const like = `%${q}%`;
      conditions.push(`(
        m.surname        ILIKE $${i}   OR
        m.forenames      ILIKE $${i}   OR
        m.known_as       ILIKE $${i}   OR
        m.email          ILIKE $${i}   OR
        m.mobile         ILIKE $${i}   OR
        a.street         ILIKE $${i}   OR
        a.town           ILIKE $${i}   OR
        a.postcode       ILIKE $${i}   OR
        m.custom_field_1 ILIKE $${i}   OR
        m.custom_field_2 ILIKE $${i}   OR
        m.custom_field_3 ILIKE $${i}   OR
        m.custom_field_4 ILIKE $${i}   OR
        m.membership_number::text = $${i + 1}
      )`);
      params.push(like, q.trim());
      i += 2;
    }

    if (cf) {
      const cfLike = `%${cf}%`;
      conditions.push(`(
        m.custom_field_1 ILIKE $${i}   OR
        m.custom_field_2 ILIKE $${i}   OR
        m.custom_field_3 ILIKE $${i}   OR
        m.custom_field_4 ILIKE $${i}
      )`);
      params.push(cfLike);
      i += 1;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const members = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.title, m.forenames, m.surname,
              m.known_as, m.email, m.mobile, m.hide_contact,
              ms.id AS status_id, ms.name AS status,
              mc.id AS class_id,  mc.name AS class,
              a.house_no, a.street, a.town, a.postcode,
              m.joined_on, m.next_renewal, m.partner_id,
              m.custom_field_1, m.custom_field_2,
              m.custom_field_3, m.custom_field_4
       FROM members m
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN member_classes  mc ON mc.id = m.class_id
       LEFT JOIN addresses        a ON a.id  = m.address_id
       ${where}
       ORDER BY m.surname, m.forenames`,
      params,
    );

    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─── GET /members/validate ────────────────────────────────────────────────
// Returns all members with their address data for client-side data quality checks.
// Requires settings:view (admin only).

// ─── GET /members/recent ──────────────────────────────────────────────────
// Returns members who joined in the given date range.
// Query params: from (ISO date), to (ISO date). Defaults: last 30 days.

router.get('/recent', requirePrivilege('members_recent', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const toDate   = req.query.to   || new Date().toISOString().slice(0, 10);
    const fromDate = req.query.from || (() => {
      const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
    })();

    const rows = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email, m.mobile,
              a.telephone, m.joined_on,
              mc.name AS class_name,
              ms.name AS status_name,
              a.house_no, a.street, a.town, a.postcode
       FROM members m
       LEFT JOIN member_classes   mc ON mc.id = m.class_id
       LEFT JOIN member_statuses  ms ON ms.id = m.status_id
       LEFT JOIN addresses         a ON a.id  = m.address_id
       WHERE m.joined_on >= $1::date
         AND m.joined_on <= $2::date
       ORDER BY m.joined_on DESC, m.surname, m.forenames`,
      [fromDate, toDate],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── GET /members/statistics ──────────────────────────────────────────────
// Returns membership and group statistics.
// Query params: from, to — date range for section 4 (Members by Renew Date).

router.get('/statistics', requirePrivilege('membership_statistics', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;

    // Fetch settings for year start and renewal periods
    const [cfg] = await tenantQuery(
      slug,
      `SELECT year_start_month, year_start_day, advance_renewals_weeks, grace_lapse_weeks
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    const yearStartMonth = cfg?.year_start_month ?? 1;
    const yearStartDay   = cfg?.year_start_day   ?? 1;
    const advanceWeeks   = cfg?.advance_renewals_weeks ?? 4;
    const graceLapse     = cfg?.grace_lapse_weeks      ?? 4;

    // Compute current membership year start date
    const now = new Date();
    const thisYear = now.getFullYear();
    const candidateStart = new Date(thisYear, yearStartMonth - 1, yearStartDay);
    const yearStartDate = candidateStart <= now
      ? candidateStart
      : new Date(thisYear - 1, yearStartMonth - 1, yearStartDay);
    const yearStartIso = yearStartDate.toISOString().slice(0, 10);

    // Section 2: Current members by class
    const classStats = await tenantQuery(
      slug,
      `SELECT mc.id, mc.name,
              COUNT(m.id)::int                                    AS total,
              COUNT(m.id) FILTER (WHERE m.email IS NOT NULL AND m.email <> '')::int AS with_email,
              COUNT(m.id) FILTER (WHERE m.joined_on >= $1::date)::int               AS first_year,
              COUNT(m.id) FILTER (WHERE m.joined_on <  $1::date)::int               AS second_year_plus
       FROM member_classes mc
       LEFT JOIN members m ON m.class_id = mc.id
                           AND m.status_id IN (
                               SELECT id FROM member_statuses WHERE name ILIKE '%Current%'
                           )
       GROUP BY mc.id, mc.name
       ORDER BY mc.name`,
      [yearStartIso],
    );

    const totalCurrent = classStats.reduce((s, r) => s + r.total, 0);

    // Section 1: General member status counts
    const [statusCounts] = await tenantQuery(
      slug,
      `SELECT
         COUNT(*) FILTER (
           WHERE status_id IN (SELECT id FROM member_statuses WHERE name ILIKE '%Current%')
             AND (next_renewal IS NULL OR next_renewal < $1::date)
         )::int AS current_not_renewed,
         COUNT(*) FILTER (
           WHERE status_id IN (SELECT id FROM member_statuses WHERE name ILIKE '%Lapsed%')
         )::int AS lapsed_count
       FROM members`,
      [yearStartIso],
    );

    // Section 3: Active groups
    const [groupStats] = await tenantQuery(
      slug,
      `SELECT
         COUNT(*)::int AS active_groups,
         COALESCE(AVG(gm_counts.cnt), 0)::numeric(10,1) AS avg_members
       FROM groups g
       LEFT JOIN (
         SELECT group_id, COUNT(*)::int AS cnt
         FROM group_members
         WHERE waiting_since IS NULL
         GROUP BY group_id
       ) gm_counts ON gm_counts.group_id = g.id
       WHERE g.status = 'active'`,
    );

    const [notInGroup] = await tenantQuery(
      slug,
      `SELECT COUNT(*)::int AS count
       FROM members m
       WHERE status_id IN (SELECT id FROM member_statuses WHERE name ILIKE '%Current%')
         AND NOT EXISTS (
           SELECT 1 FROM group_members gm
           WHERE gm.member_id = m.id AND gm.waiting_since IS NULL
         )`,
    );

    // Section 4: Members by Renew Date
    const toDate   = req.query.to   || now.toISOString().slice(0, 10);
    const fromDate = req.query.from || yearStartIso;

    const renewStats = await tenantQuery(
      slug,
      `SELECT mc.id, mc.name,
              COUNT(m.id) FILTER (
                WHERE m.status_id IN (SELECT id FROM member_statuses WHERE name ILIKE '%Current%')
                  AND m.next_renewal IS NOT NULL
                  AND m.next_renewal >= $1::date
                  AND m.next_renewal <= $2::date
              )::int AS not_renewed,
              COUNT(m.id) FILTER (
                WHERE m.joined_on >= $1::date
                  AND m.joined_on <= $2::date
              )::int AS new_members
       FROM member_classes mc
       LEFT JOIN members m ON m.class_id = mc.id
       GROUP BY mc.id, mc.name
       ORDER BY mc.name`,
      [fromDate, toDate],
    );

    res.json({
      yearStart: yearStartIso,
      advanceRenewalsWeeks: advanceWeeks,
      graceLapseWeeks:      graceLapse,
      currentNotRenewed:    statusCounts?.current_not_renewed ?? 0,
      lapsedCount:          statusCounts?.lapsed_count        ?? 0,
      totalCurrent,
      classStats,
      activeGroups:         groupStats?.active_groups ?? 0,
      avgGroupMembers:      groupStats?.avg_members   ?? 0,
      membersNotInGroup:    notInGroup?.count          ?? 0,
      renewStats,
      renewFrom:  fromDate,
      renewTo:    toDate,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /members/renewals ────────────────────────────────────────────────
// Lists Current and Lapsed members with fee info for the renewals screen.
// Also returns year boundaries so the client can filter by period.

router.get('/renewals', requirePrivilege('membership_renewals', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;

    const [cfg] = await tenantQuery(
      slug,
      `SELECT year_start_month, year_start_day, advance_renewals_weeks
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    const ysm  = cfg?.year_start_month     ?? 1;
    const ysd  = cfg?.year_start_day       ?? 1;
    const advW = cfg?.advance_renewals_weeks ?? 4;

    const now = new Date();
    const yr  = now.getFullYear();
    const candidateStart = new Date(yr, ysm - 1, ysd);
    const yearStart = candidateStart <= now
      ? candidateStart
      : new Date(yr - 1, ysm - 1, ysd);

    const prevYearStart = new Date(yearStart);
    prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);

    const nextYearStart = new Date(yearStart);
    nextYearStart.setFullYear(nextYearStart.getFullYear() + 1);

    // "Next year" tab only visible within advance_renewals_weeks before nextYearStart
    const advanceStart = new Date(nextYearStart);
    advanceStart.setDate(advanceStart.getDate() - advW * 7);
    const showNextYear = now >= advanceStart;

    const rows = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
              ms.id   AS status_id, ms.name AS status_name,
              mc.id   AS class_id,  mc.name AS class_name,
              mc.fee, mc.gift_aid_fee,
              m.next_renewal, m.gift_aid_from, m.partner_id,
              p.forenames AS partner_forenames, p.surname AS partner_surname
       FROM members m
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN member_classes  mc ON mc.id = m.class_id
       LEFT JOIN members          p ON p.id  = m.partner_id
       WHERE ms.name ILIKE '%Current%' OR ms.name ILIKE '%Lapsed%'
       ORDER BY m.surname, m.forenames`,
    );

    res.json({
      members: rows,
      yearStart:     yearStart.toISOString().slice(0, 10),
      prevYearStart: prevYearStart.toISOString().slice(0, 10),
      nextYearStart: nextYearStart.toISOString().slice(0, 10),
      showNextYear,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /members/renew ──────────────────────────────────────────────────
// Bulk-renews the given members: advances next_renewal by 1 year, sets
// status to Current if Lapsed, creates a finance transaction for each.

const renewSchema = z.object({
  memberIds:      z.array(z.string().min(1)).min(1),
  accountId:      z.string().min(1),
  paymentMethod:  z.string().min(1),
  amounts:        z.record(z.string(), z.number().positive()),
  giftAidChanges: z.record(z.string(), z.boolean()).optional(),
  yearStart:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post('/renew', requirePrivilege('membership_renewals', 'renew'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = renewSchema.parse(req.body);

    // Find the "Current" status id to upgrade Lapsed members
    const [currentStatus] = await tenantQuery(
      slug,
      `SELECT id FROM member_statuses WHERE name ILIKE '%Current%' ORDER BY name LIMIT 1`,
    );
    if (!currentStatus) throw new AppError('No "Current" member status found.', 400);

    const renewed = [];
    const errors  = [];

    for (const memberId of data.memberIds) {
      try {
        // Fetch member to get current next_renewal and status
        const [m] = await tenantQuery(
          slug,
          `SELECT m.id, m.forenames, m.surname, m.next_renewal, m.status_id,
                  ms.name AS status_name, m.gift_aid_from, m.class_id
           FROM members m
           LEFT JOIN member_statuses ms ON ms.id = m.status_id
           WHERE m.id = $1`,
          [memberId],
        );
        if (!m) { errors.push({ memberId, error: 'Member not found' }); continue; }

        // New next_renewal = current next_renewal + 1 year (or yearStart + 1 year if null)
        const base = m.next_renewal
          ? String(m.next_renewal).slice(0, 10)
          : data.yearStart;
        const baseDate = new Date(base);
        baseDate.setFullYear(baseDate.getFullYear() + 1);
        const newNextRenewal = baseDate.toISOString().slice(0, 10);

        // Should we set to Current?
        const isLapsed = (m.status_name ?? '').toLowerCase().includes('lapsed');
        const newStatusId = isLapsed ? currentStatus.id : m.status_id;

        // Gift Aid update
        const gaChange = data.giftAidChanges?.[memberId];
        let giftAidFrom;
        if (gaChange === true && !m.gift_aid_from) {
          giftAidFrom = 'TODAY';
        } else if (gaChange === false) {
          giftAidFrom = null;
        } else {
          giftAidFrom = m.gift_aid_from ? String(m.gift_aid_from).slice(0, 10) : null;
        }

        // Update member record
        await tenantQuery(
          slug,
          `UPDATE members
           SET next_renewal  = $1::date,
               status_id     = $2,
               gift_aid_from = $3::date,
               card_printed  = false,
               updated_at    = now()
           WHERE id = $4`,
          [newNextRenewal, newStatusId, giftAidFrom === 'TODAY' ? new Date().toISOString().slice(0, 10) : giftAidFrom, memberId],
        );

        // Create finance transaction (no category splits — user can categorize via ledger)
        const amount = data.amounts[memberId];
        const fromTo = `${m.forenames} ${m.surname}`;

        // Resolve Gift Aid eligible amount (uses the member's gift_aid_from after any update above)
        const effectiveGaFrom = giftAidFrom === 'TODAY'
          ? new Date().toISOString().slice(0, 10)
          : giftAidFrom;
        let gaAmount = null;
        if (effectiveGaFrom && m.class_id) {
          gaAmount = await resolveGiftAidAmount(slug, memberId, m.class_id, new Date().toISOString().slice(0, 10));
        }

        const [txn] = await tenantQuery(
          slug,
          `INSERT INTO transactions
             (account_id, date, type, from_to, amount, payment_method, member_id_1, gift_aid_amount)
           VALUES ($1, CURRENT_DATE, 'in', $2, $3::numeric, $4, $5, $6::numeric)
           RETURNING id, transaction_number`,
          [data.accountId, fromTo, amount, data.paymentMethod, memberId, gaAmount],
        );

        logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'renew', entityType: 'member', entityId: memberId, detail: JSON.stringify({ newNextRenewal }) });

        // Gift Aid consent audit
        if (gaChange === true && !m.gift_aid_from) {
          logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'gift_aid_consent', entityType: 'member', entityId: memberId, entityName: `${m.forenames} ${m.surname}`, detail: JSON.stringify({ giftAidFrom: new Date().toISOString().slice(0, 10) }) });
        } else if (gaChange === false && m.gift_aid_from) {
          logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'gift_aid_withdrawn', entityType: 'member', entityId: memberId, entityName: `${m.forenames} ${m.surname}`, detail: JSON.stringify({ previousGiftAidFrom: String(m.gift_aid_from).slice(0, 10) }) });
        }

        renewed.push({ memberId, newNextRenewal, transactionNumber: txn.transaction_number });
      } catch (err) {
        errors.push({ memberId, error: err.message });
      }
    }

    res.json({ renewed, errors });
  } catch (err) {
    next(err);
  }
});

// ─── GET /members/non-renewals ────────────────────────────────────────────
// mode=this_year  — Current members whose next_renewal < current year start
// mode=long_term  — All members whose next_renewal is older than deletion_years

router.get('/non-renewals', requirePrivilege('members_non_renewals', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const mode = req.query.mode === 'long_term' ? 'long_term' : 'this_year';

    const [cfg] = await tenantQuery(
      slug,
      `SELECT year_start_month, year_start_day, grace_lapse_weeks, deletion_years
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    const ysm          = cfg?.year_start_month   ?? 1;
    const ysd          = cfg?.year_start_day     ?? 1;
    const graceLapse   = cfg?.grace_lapse_weeks  ?? 4;
    const deletionYrs  = cfg?.deletion_years     ?? 7;

    const now = new Date();
    const yr  = now.getFullYear();
    const candidateStart = new Date(yr, ysm - 1, ysd);
    const yearStart = candidateStart <= now
      ? candidateStart
      : new Date(yr - 1, ysm - 1, ysd);
    const yearStartIso = yearStart.toISOString().slice(0, 10);

    let rows;
    if (mode === 'this_year') {
      rows = await tenantQuery(
        slug,
        `SELECT m.id, m.membership_number, m.forenames, m.surname,
                ms.name AS status_name,
                mc.name AS class_name,
                m.next_renewal, m.email, m.mobile
         FROM members m
         LEFT JOIN member_statuses ms ON ms.id = m.status_id
         LEFT JOIN member_classes  mc ON mc.id = m.class_id
         WHERE ms.name ILIKE '%Current%'
           AND (m.next_renewal IS NULL OR m.next_renewal < $1::date)
         ORDER BY m.surname, m.forenames`,
        [yearStartIso],
      );
    } else {
      // Compute cutoff date in JS to avoid PostgreSQL interval casting issues
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - deletionYrs);
      const cutoffIso = cutoff.toISOString().slice(0, 10);

      rows = await tenantQuery(
        slug,
        `SELECT m.id, m.membership_number, m.forenames, m.surname,
                ms.name AS status_name,
                mc.name AS class_name,
                m.next_renewal, m.email, m.mobile
         FROM members m
         LEFT JOIN member_statuses ms ON ms.id = m.status_id
         LEFT JOIN member_classes  mc ON mc.id = m.class_id
         WHERE m.next_renewal IS NOT NULL
           AND m.next_renewal < $1::date
         ORDER BY m.next_renewal, m.surname`,
        [cutoffIso],
      );
    }

    res.json({
      members: rows,
      mode,
      yearStart:    yearStartIso,
      graceLapse,
      deletionYears: deletionYrs,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /members/lapse ──────────────────────────────────────────────────
// Changes status to the "Lapsed" status for the given member IDs.

router.post('/lapse', requirePrivilege('members_non_renewals', 'lapse'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { memberIds } = z.object({ memberIds: z.array(z.string()).min(1) }).parse(req.body);

    const [lapsedStatus] = await tenantQuery(
      slug,
      `SELECT id FROM member_statuses WHERE name ILIKE '%Lapsed%' ORDER BY name LIMIT 1`,
    );
    if (!lapsedStatus) throw new AppError('No "Lapsed" member status found.', 400);

    await tenantQuery(
      slug,
      `UPDATE members SET status_id = $1, updated_at = now()
       WHERE id = ANY($2::text[])`,
      [lapsedStatus.id, memberIds],
    );

    logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'lapse', entityType: 'member', entityId: memberIds.join(',') });
    res.json({ lapsed: memberIds.length });
  } catch (err) {
    next(err);
  }
});

router.get('/validate', requirePrivilege('member_data_validation', 'view'), async (req, res, next) => {
  try {
    const members = await tenantQuery(
      req.user.tenantSlug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname,
              m.status_id, m.class_id, m.joined_on, m.next_renewal,
              m.email, m.mobile,
              a.id         AS address_id,
              a.house_no, a.street, a.add_line1, a.add_line2,
              a.town, a.county, a.postcode, a.telephone
       FROM members m
       LEFT JOIN addresses a ON a.id = m.address_id
       ORDER BY m.surname, m.forenames`,
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─── GET /members/download ────────────────────────────────────────────────
// Download selected members as Excel, PDF, or email-CSV.
// Query params: format (excel|pdf|email-csv), ids (comma-separated), fields (comma-separated)

const MEMBER_FIELD_DEFS = {
  membership_number: { label: 'Membership No', get: (m) => String(m.membership_number ?? '') },
  title:        { label: 'Title',       get: (m) => m.title ?? '' },
  forenames:    { label: 'Forenames',   get: (m) => m.forenames ?? '' },
  known_as:     { label: 'Known As',    get: (m) => m.known_as ?? '' },
  surname:      { label: 'Surname',     get: (m) => m.surname ?? '' },
  email:        { label: 'Email',       get: (m) => m.email ?? '' },
  mobile:       { label: 'Mobile',      get: (m) => m.mobile ?? '' },
  telephone:    { label: 'Telephone',   get: (m) => m.telephone ?? '' },
  address:      { label: 'Address',     get: (m) => [m.house_no, m.street, m.add_line1, m.add_line2].filter(Boolean).join(', ') },
  town:         { label: 'Town',        get: (m) => m.town ?? '' },
  county:       { label: 'County',      get: (m) => m.county ?? '' },
  postcode:     { label: 'Postcode',    get: (m) => m.postcode ?? '' },
  country:      { label: 'Country',     get: (m) => m.country ?? '' },
  status:       { label: 'Status',      get: (m) => m.status ?? '' },
  class:        { label: 'Class',       get: (m) => m.class ?? '' },
  joined_on:    { label: 'Joined',      get: (m) => m.joined_on    ? String(m.joined_on).slice(0, 10)    : '' },
  next_renewal:    { label: 'Next Renewal',    get: (m) => m.next_renewal ? String(m.next_renewal).slice(0, 10) : '' },
  custom_field_1:  { label: 'Custom Field 1',  get: (m) => m.custom_field_1 ?? '' },
  custom_field_2:  { label: 'Custom Field 2',  get: (m) => m.custom_field_2 ?? '' },
  custom_field_3:  { label: 'Custom Field 3',  get: (m) => m.custom_field_3 ?? '' },
  custom_field_4:  { label: 'Custom Field 4',  get: (m) => m.custom_field_4 ?? '' },
};

function buildMemberPdf(rows, cols, title) {
  const PAGE_W = 841.89; const PAGE_H = 595.28; // A4 landscape
  const MARGIN = 36; const FONT_SZ = 7; const ROW_H = 13;
  const usableW = PAGE_W - MARGIN * 2;
  const colW = usableW / cols.length;

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape', autoFirstPage: true });

  function drawHeader(y) {
    doc.font('Helvetica-Bold').fontSize(FONT_SZ);
    cols.forEach((f, idx) => {
      doc.text(MEMBER_FIELD_DEFS[f].label, MARGIN + idx * colW, y, { width: colW - 3, lineBreak: false, ellipsis: true });
    });
    return y + ROW_H;
  }

  let y = MARGIN + 4;
  doc.font('Helvetica-Bold').fontSize(9).text(title, MARGIN, y, { lineBreak: false });
  y += 16;
  y = drawHeader(y);
  doc.moveTo(MARGIN, y - 2).lineTo(PAGE_W - MARGIN, y - 2).strokeColor('#aaaaaa').stroke();

  doc.font('Helvetica').fontSize(FONT_SZ);
  for (const m of rows) {
    if (y + ROW_H > PAGE_H - MARGIN) {
      doc.addPage({ size: 'A4', layout: 'landscape' });
      y = MARGIN + 4;
      y = drawHeader(y);
      doc.moveTo(MARGIN, y - 2).lineTo(PAGE_W - MARGIN, y - 2).strokeColor('#aaaaaa').stroke();
      doc.font('Helvetica').fontSize(FONT_SZ);
    }
    cols.forEach((f, idx) => {
      doc.text(MEMBER_FIELD_DEFS[f].get(m), MARGIN + idx * colW, y, { width: colW - 3, lineBreak: false, ellipsis: true });
    });
    y += ROW_H;
  }
  doc.end();
  return doc;
}

router.get('/download', requirePrivilege('members_list', 'view'), async (req, res, next) => {
  try {
    const { format = 'excel', ids = '', fields = '' } = req.query;
    const slug = req.user.tenantSlug;
    const memberIds = ids.split(',').map((s) => s.trim()).filter(Boolean);
    if (!memberIds.length) throw AppError('No member IDs provided.', 400);

    const rows = await tenantQuery(slug,
      `SELECT m.id, m.membership_number, m.title, m.forenames, m.surname, m.known_as,
              m.email, m.mobile,
              ms.name AS status, mc.name AS class,
              a.house_no, a.street, a.add_line1, a.add_line2,
              a.town, a.county, a.postcode, a.country, a.telephone,
              m.joined_on, m.next_renewal,
              m.custom_field_1, m.custom_field_2,
              m.custom_field_3, m.custom_field_4
       FROM members m
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN member_classes  mc ON mc.id = m.class_id
       LEFT JOIN addresses        a ON a.id  = m.address_id
       WHERE m.id = ANY($1::text[])
       ORDER BY m.surname, m.forenames`,
      [memberIds],
    );

    const tenantPart = slug.replace(/^u3a_/, '');
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'email-csv') {
      const content = rows.map((m) => m.email).filter(Boolean).join('\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tenantPart}_member_emails_${stamp}.csv"`);
      return res.send(content);
    }

    const activeCols = fields.split(',').map((s) => s.trim()).filter((f) => f && MEMBER_FIELD_DEFS[f]);
    const cols = activeCols.length ? activeCols : Object.keys(MEMBER_FIELD_DEFS);

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Members');
      ws.columns = cols.map((f) => ({ header: MEMBER_FIELD_DEFS[f].label, width: 20 }));
      ws.getRow(1).font = { bold: true };
      for (const m of rows) ws.addRow(cols.map((f) => MEMBER_FIELD_DEFS[f].get(m)));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${tenantPart}_members_${stamp}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    if (format === 'pdf') {
      const doc = buildMemberPdf(rows, cols, `Members — ${stamp}`);
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      await new Promise((resolve) => doc.on('end', resolve));
      const buf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${tenantPart}_members_${stamp}.pdf"`);
      return res.send(buf);
    }

    throw AppError('Invalid format.', 400);
  } catch (err) { next(err); }
});

// ─── GET /members/:id/groups ──────────────────────────────────────────────
// Returns groups (and waiting list) the member belongs to.

router.get('/:id/groups', requirePrivilege('member_record', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT g.id, g.name, g.status, gm.is_leader, gm.waiting_since
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.member_id = $1
       ORDER BY g.name`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── GET /members/:id ─────────────────────────────────────────────────────

router.get('/:id', requirePrivilege('member_record', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;

    const [member] = await tenantQuery(
      slug,
      `SELECT m.*,
              ms.name AS status_name,
              mc.name AS class_name,
              mc.is_associate,
              a.house_no, a.street, a.add_line1, a.add_line2,
              a.town, a.county, a.postcode, a.telephone,
              p.forenames AS partner_forenames, p.surname AS partner_surname,
              p.membership_number AS partner_number,
              p.status_id AS partner_status_id, ps.name AS partner_status_name,
              p.class_id AS partner_class_id, pc.name AS partner_class_name,
              (p.id IS NOT NULL AND p.address_id = m.address_id) AS address_shared
       FROM members m
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN member_classes  mc ON mc.id = m.class_id
       LEFT JOIN addresses        a ON a.id  = m.address_id
       LEFT JOIN members          p ON p.id  = m.partner_id
       LEFT JOIN member_statuses ps ON ps.id = p.status_id
       LEFT JOIN member_classes  pc ON pc.id = p.class_id
       WHERE m.id = $1`,
      [req.params.id],
    );

    if (!member) throw AppError('Member not found.', 404);

    // Attach current poll memberships
    const pollRows = await tenantQuery(
      slug,
      `SELECT poll_id FROM poll_members WHERE member_id = $1`,
      [req.params.id],
    );
    member.poll_ids = pollRows.map((r) => r.poll_id);

    res.json(member);
  } catch (err) {
    next(err);
  }
});

// ─── POST /members ────────────────────────────────────────────────────────

const addressSchema = z.object({
  houseNo:   z.string().optional(),
  street:    z.string().optional(),
  addLine1:  z.string().optional(),
  addLine2:  z.string().optional(),
  town:      z.string().optional(),
  county:    z.string().optional(),
  postcode:  z.string().optional(),
  telephone: z.string().optional(),
});

const paymentSchema = z.object({
  accountId: z.string().min(1),
  amount:    z.number().positive(),
  method:    z.string().optional().nullable(),
  ref:       z.string().optional().nullable(),
});

// Minimal schema for a new partner joining at the same time — shares the primary member's address
const newPartnerSchema = z.object({
  title:       z.string().max(20).optional(),
  forenames:   z.string().min(1).max(100),
  surname:     z.string().min(1).max(100),
  knownAs:     z.string().max(50).optional(),
  email:       z.string().email().optional().or(z.literal('')),
  mobile:      z.string().max(30).optional(),
  statusId:    z.string().min(1),
  classId:     z.string().min(1),
  joinedOn:    z.string().min(1),
  nextRenewal: z.string().min(1, 'Next renewal date is required'),
  giftAidFrom: z.string().optional(),
});

const createMemberSchema = z.object({
  title:       z.string().max(20).optional(),
  forenames:   z.string().min(1).max(100),
  surname:     z.string().min(1).max(100),
  knownAs:     z.string().max(50).optional(),
  suffix:      z.string().max(30).optional(),
  email:       z.string().email().optional().or(z.literal('')),
  mobile:      z.string().max(30).optional(),
  statusId:    z.string().min(1),
  classId:     z.string().min(1),
  joinedOn:    z.string().min(1, 'Date joined is required'),  // ISO date string
  nextRenewal: z.string().min(1, 'Next renewal date is required'),
  giftAidFrom: z.string().optional(),
  homeU3a:      z.string().max(100).optional(),
  notes:        z.string().optional(),
  hideContact:  z.boolean().default(false),
  customField1: z.string().nullable().optional(),
  customField2: z.string().nullable().optional(),
  customField3: z.string().nullable().optional(),
  customField4: z.string().nullable().optional(),
  // Address — either a new address object, an existing partner's id, or a new partner (shares primary's address)
  address:           addressSchema.optional(),
  existingPartnerId: z.string().optional(),
  newPartner:        newPartnerSchema.optional(),   // A: two new members joining together
  // Optional updates to an existing partner when linking
  partnerClassId:    z.string().optional(),         // C: update partner's class
  partnerRenewal:    z.object({ nextRenewal: z.string().min(1) }).optional(), // B: renew partner
  // Optional payment — creates a financial transaction when provided
  payment: paymentSchema.optional(),
}).superRefine((val, ctx) => {
  // Postcode is required when not sharing a partner's address and not adding a new partner
  if (!val.existingPartnerId && !val.newPartner && !val.address?.postcode?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address', 'postcode'],
      message: 'Postcode is required',
    });
  }
});

/** Create a financial transaction linked to a member. Splits overpayments into Membership + Donations. */
async function createMemberPayment(slug, pay, memberId, memberName, joinedOn, classId) {
  const [cls] = await tenantQuery(slug, `SELECT fee::float AS fee FROM member_classes WHERE id = $1`, [classId]);
  const classFee = cls?.fee ?? null;

  const cats = await tenantQuery(
    slug,
    `SELECT id, name FROM finance_categories WHERE name IN ('Membership', 'Donations') AND active = true`,
    [],
  );
  const membershipCatId = cats.find((c) => c.name === 'Membership')?.id ?? null;
  const donationsCatId  = cats.find((c) => c.name === 'Donations')?.id  ?? null;

  let categories;
  if (classFee !== null && pay.amount > classFee + 0.001 && membershipCatId && donationsCatId) {
    const donation = Math.round((pay.amount - classFee) * 100) / 100;
    categories = [
      { categoryId: membershipCatId, amount: classFee },
      { categoryId: donationsCatId,  amount: donation },
    ];
  } else {
    const catId = membershipCatId ?? donationsCatId;
    if (!catId) throw AppError('No active Membership or Donations category found to record payment.', 500);
    categories = [{ categoryId: catId, amount: pay.amount }];
  }

  // Resolve Gift Aid eligible amount
  const gaAmount = await resolveGiftAidAmount(slug, memberId, classId, joinedOn);

  const [txn] = await tenantQuery(
    slug,
    `INSERT INTO transactions
       (account_id, date, type, from_to, amount, payment_method, payment_ref, member_id_1, gift_aid_amount)
     VALUES ($1, $2::date, 'in', $3, $4::numeric, $5, $6, $7, $8::numeric)
     RETURNING id, transaction_number`,
    [pay.accountId, joinedOn, memberName, pay.amount, pay.method ?? null, pay.ref ?? null, memberId, gaAmount],
  );

  for (const cat of categories) {
    await tenantQuery(
      slug,
      `INSERT INTO transaction_categories (transaction_id, category_id, amount) VALUES ($1, $2, $3::numeric)`,
      [txn.id, cat.categoryId, cat.amount],
    );
  }
}

router.post('/', requirePrivilege('member_record', 'create'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = createMemberSchema.parse(req.body);

    // Duplicate name check — warn but proceed (frontend must have confirmed)
    const duplicateCheck = !req.query.confirmed;
    if (duplicateCheck) {
      const dupes = await tenantQuery(
        slug,
        `SELECT id FROM members
         WHERE lower(forenames) = lower($1) AND lower(surname) = lower($2)`,
        [data.forenames, data.surname],
      );
      if (dupes.length > 0) {
        return res.status(409).json({
          error: 'A member with that name already exists.',
          code: 'DUPLICATE_NAME',
          existingId: dupes[0].id,
        });
      }
    }

    // Resolve address_id
    let addressId = null;

    if (data.existingPartnerId) {
      // Share address with an existing member
      const [partner] = await tenantQuery(
        slug,
        `SELECT id, address_id FROM members WHERE id = $1`,
        [data.existingPartnerId],
      );
      if (!partner) throw AppError('Partner member not found.', 404);
      addressId = partner.address_id;
    } else if (data.address) {
      const addr = data.address;
      const [newAddr] = await tenantQuery(
        slug,
        `INSERT INTO addresses (house_no, street, add_line1, add_line2, town, county, postcode, telephone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          addr.houseNo   ?? null, addr.street   ?? null,
          addr.addLine1  ?? null, addr.addLine2  ?? null,
          addr.town      ?? null, addr.county    ?? null,
          addr.postcode ? addr.postcode.trim().toUpperCase() : null, addr.telephone ?? null,
        ],
      );
      addressId = newAddr.id;
    }

    const initials = deriveInitials(data.forenames);
    const email = data.email ? data.email.toLowerCase() : null;

    const [member] = await tenantQuery(
      slug,
      `INSERT INTO members
         (title, forenames, surname, known_as, initials, suffix, email, mobile,
          address_id, status_id, class_id, joined_on, next_renewal, gift_aid_from,
          home_u3a, notes, hide_contact, partner_id,
          custom_field_1, custom_field_2, custom_field_3, custom_field_4)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14::date,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id, membership_number, title, forenames, surname, known_as,
                 initials, suffix, email, mobile, status_id, class_id,
                 joined_on, next_renewal, gift_aid_from, home_u3a, notes,
                 hide_contact, partner_id, address_id, created_at`,
      [
        data.title      ?? null,
        data.forenames,
        data.surname,
        data.knownAs    ?? null,
        initials,
        data.suffix     ?? null,
        email,
        data.mobile     ?? null,
        addressId,
        data.statusId,
        data.classId,
        data.joinedOn   ?? null,
        data.nextRenewal ?? null,
        data.giftAidFrom ?? null,
        data.homeU3a    ?? null,
        data.notes      ?? null,
        data.hideContact,
        data.existingPartnerId ?? null,
        data.customField1 ?? null,
        data.customField2 ?? null,
        data.customField3 ?? null,
        data.customField4 ?? null,
      ],
    );

    // If existing partner specified, set partner_id on both sides (bi-directional)
    if (data.existingPartnerId) {
      await tenantQuery(
        slug,
        `UPDATE members SET partner_id = $1, updated_at = now() WHERE id = $2`,
        [member.id, data.existingPartnerId],
      );
    }

    // ── A: Create new partner joining at the same time (shares address) ───
    if (data.newPartner) {
      const np = data.newPartner;
      const npInitials = deriveInitials(np.forenames);
      const npEmail = np.email ? np.email.toLowerCase() : null;

      const [partner] = await tenantQuery(
        slug,
        `INSERT INTO members
           (title, forenames, surname, known_as, initials, email, mobile,
            address_id, status_id, class_id, joined_on, next_renewal, gift_aid_from,
            hide_contact, partner_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12::date,$13::date,$14,$15)
         RETURNING id, membership_number, forenames, surname`,
        [
          np.title      ?? null,
          np.forenames,
          np.surname,
          np.knownAs    ?? null,
          npInitials,
          npEmail,
          np.mobile     ?? null,
          addressId,
          np.statusId,
          np.classId,
          np.joinedOn   ?? null,
          np.nextRenewal ?? null,
          np.giftAidFrom ?? null,
          false,
          member.id,
        ],
      );

      // Set primary member's partner_id to the new partner
      await tenantQuery(
        slug,
        `UPDATE members SET partner_id = $1, updated_at = now() WHERE id = $2`,
        [partner.id, member.id],
      );
    }

    // ── B: Renew existing partner at the same time ────────────────────────
    if (data.existingPartnerId && data.partnerRenewal) {
      await tenantQuery(
        slug,
        `UPDATE members SET next_renewal = $1::date, updated_at = now() WHERE id = $2`,
        [data.partnerRenewal.nextRenewal, data.existingPartnerId],
      );
    }

    // ── C: Update existing partner's class if requested ───────────────────
    if (data.existingPartnerId && data.partnerClassId) {
      await tenantQuery(
        slug,
        `UPDATE members SET class_id = $1, updated_at = now() WHERE id = $2`,
        [data.partnerClassId, data.existingPartnerId],
      );
    }

    // ── Payment transaction for primary member ────────────────────────────
    if (data.payment) {
      const memberName = [data.title, data.forenames, data.surname].filter(Boolean).join(' ');
      await createMemberPayment(slug, data.payment, member.id, memberName, data.joinedOn, data.classId);
    }

    logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'create', entityType: 'member', entityId: member.id, entityName: `${data.forenames} ${data.surname}` });

    // Gift Aid consent audit entry
    if (data.giftAidFrom) {
      logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'gift_aid_consent', entityType: 'member', entityId: member.id, entityName: `${data.forenames} ${data.surname}`, detail: JSON.stringify({ giftAidFrom: data.giftAidFrom }) });
    }

    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /members/:id ───────────────────────────────────────────────────

const updateMemberSchema = z.object({
  title:        z.string().max(20).optional(),
  forenames:    z.string().min(1).max(100).optional(),
  surname:      z.string().min(1).max(100).optional(),
  knownAs:      z.string().max(50).nullable().optional(),
  suffix:       z.string().max(30).nullable().optional(),
  email:        z.string().email().optional().or(z.literal('')).nullable(),
  mobile:       z.string().max(30).nullable().optional(),
  statusId:     z.string().optional(),
  classId:      z.string().optional(),
  joinedOn:     z.string().nullable().optional(),
  nextRenewal:  z.string().nullable().optional(),
  giftAidFrom:  z.string().nullable().optional(),
  homeU3a:      z.string().max(100).nullable().optional(),
  notes:        z.string().nullable().optional(),
  hideContact:  z.boolean().optional(),
  customField1: z.string().nullable().optional(),
  customField2: z.string().nullable().optional(),
  customField3: z.string().nullable().optional(),
  customField4: z.string().nullable().optional(),
  partnerId:    z.string().nullable().optional(),
  // 'both' = update the shared address row in place; 'me-only' = create a new address for this member only
  addressScope: z.enum(['both', 'me-only']).optional(),
  // Address fields — updates the linked address record
  address: z.object({
    houseNo:   z.string().nullable().optional(),
    street:    z.string().nullable().optional(),
    addLine1:  z.string().nullable().optional(),
    addLine2:  z.string().nullable().optional(),
    town:      z.string().nullable().optional(),
    county:    z.string().nullable().optional(),
    postcode:  z.string().nullable().optional(),
    telephone: z.string().nullable().optional(),
  }).optional(),
});

router.patch('/:id', requirePrivilege('member_record', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = updateMemberSchema.parse(req.body);
    const memberId = req.params.id;

    // Early empty-body check (before any DB call)
    const MEMBER_FIELDS = ['title','forenames','surname','knownAs','suffix','email','mobile',
      'statusId','classId','joinedOn','nextRenewal','giftAidFrom','homeU3a','notes','hideContact',
      'customField1','customField2','customField3','customField4','partnerId'];
    if (!data.address && !MEMBER_FIELDS.some((f) => data[f] !== undefined)) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    // Fetch current member to get address_id and partner's address_id
    const [current] = await tenantQuery(
      slug,
      `SELECT m.id, m.address_id, m.forenames, m.surname, m.partner_id,
              m.gift_aid_from, p.address_id AS partner_address_id
       FROM members m
       LEFT JOIN members p ON p.id = m.partner_id
       WHERE m.id = $1`,
      [memberId],
    );
    if (!current) throw AppError('Member not found.', 404);

    // Is this address currently shared with the partner?
    const addressIsShared = current.partner_id !== null
      && current.address_id !== null
      && current.address_id === current.partner_address_id;

    // ── Handle partner change ──────────────────────────────────────────────
    // When partnerId changes we must: set the reverse link on the new partner,
    // clear the reverse link on the old partner, point X at the new partner's
    // address, and queue X's old address for deletion if nothing else uses it.
    let oldAddressIdForCleanup = null;
    let partnerIsChanging = false;

    if (data.partnerId !== undefined) {
      const newPartnerId = data.partnerId;                    // null = clearing
      const oldPartnerId = current.partner_id ?? null;       // normalise to null

      if (newPartnerId !== oldPartnerId) {
        partnerIsChanging = true;

        if (newPartnerId) {
          if (newPartnerId === memberId) throw AppError('A member cannot be their own partner.', 400);

          const [partnerY] = await tenantQuery(
            slug,
            `SELECT id, address_id FROM members WHERE id = $1`,
            [newPartnerId],
          );
          if (!partnerY) throw AppError('Partner not found.', 404);

          // X will share Y's address row
          if (partnerY.address_id) {
            data._newAddressId = partnerY.address_id;
          }

          // Set Y.partner_id = X (bi-directional)
          await tenantQuery(
            slug,
            `UPDATE members SET partner_id = $1, updated_at = now() WHERE id = $2`,
            [memberId, newPartnerId],
          );

          // Schedule X's old address for cleanup after the member UPDATE
          oldAddressIdForCleanup = current.address_id;
        }

        // Clear old partner Z's reverse link (if Z ≠ new partner)
        if (oldPartnerId && oldPartnerId !== newPartnerId) {
          await tenantQuery(
            slug,
            `UPDATE members SET partner_id = NULL, updated_at = now() WHERE id = $1`,
            [oldPartnerId],
          );
        }
      }
    }

    // Update address if address fields supplied (skipped when partner is changing)
    if (data.address && !partnerIsChanging) {
      const addr = data.address;

      // When the address is shared and the caller wants 'me-only', create a new
      // address record for this member and leave the partner's address unchanged.
      const splitAddress = addressIsShared && data.addressScope === 'me-only';

      if (splitAddress || !current.address_id) {
        // Read the current shared address to populate unchanged fields
        let base = {};
        if (current.address_id) {
          const [existingAddr] = await tenantQuery(
            slug,
            `SELECT house_no, street, add_line1, add_line2, town, county, postcode, telephone
             FROM addresses WHERE id = $1`,
            [current.address_id],
          );
          base = existingAddr ?? {};
        }
        const [newAddr] = await tenantQuery(
          slug,
          `INSERT INTO addresses (house_no, street, add_line1, add_line2, town, county, postcode, telephone)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            addr.houseNo   !== undefined ? addr.houseNo   : (base.house_no  ?? null),
            addr.street    !== undefined ? addr.street    : (base.street    ?? null),
            addr.addLine1  !== undefined ? addr.addLine1  : (base.add_line1 ?? null),
            addr.addLine2  !== undefined ? addr.addLine2  : (base.add_line2 ?? null),
            addr.town      !== undefined ? addr.town      : (base.town      ?? null),
            addr.county    !== undefined ? addr.county    : (base.county    ?? null),
            addr.postcode  !== undefined ? (addr.postcode ? addr.postcode.trim().toUpperCase() : addr.postcode) : (base.postcode  ?? null),
            addr.telephone !== undefined ? addr.telephone : (base.telephone ?? null),
          ],
        );
        data._newAddressId = newAddr.id;
      } else if (current.address_id) {
        // Update existing address record in place (affects all members sharing it)
        const addrFields = [];
        const addrVals = [];
        let ai = 1;
        if (addr.houseNo   !== undefined) { addrFields.push(`house_no = $${ai++}`);   addrVals.push(addr.houseNo); }
        if (addr.street    !== undefined) { addrFields.push(`street = $${ai++}`);     addrVals.push(addr.street); }
        if (addr.addLine1  !== undefined) { addrFields.push(`add_line1 = $${ai++}`);  addrVals.push(addr.addLine1); }
        if (addr.addLine2  !== undefined) { addrFields.push(`add_line2 = $${ai++}`);  addrVals.push(addr.addLine2); }
        if (addr.town      !== undefined) { addrFields.push(`town = $${ai++}`);       addrVals.push(addr.town); }
        if (addr.county    !== undefined) { addrFields.push(`county = $${ai++}`);     addrVals.push(addr.county); }
        if (addr.postcode  !== undefined) { addrFields.push(`postcode = $${ai++}`);   addrVals.push(addr.postcode ? addr.postcode.trim().toUpperCase() : addr.postcode); }
        if (addr.telephone !== undefined) { addrFields.push(`telephone = $${ai++}`);  addrVals.push(addr.telephone); }
        if (addrFields.length) {
          addrFields.push(`updated_at = now()`);
          addrVals.push(current.address_id);
          await tenantQuery(
            slug,
            `UPDATE addresses SET ${addrFields.join(', ')} WHERE id = $${ai}`,
            addrVals,
          );
        }
      }
    }

    // Build member UPDATE
    const fields = [];
    const values = [];
    let i = 1;

    if (data.title       !== undefined) { fields.push(`title = $${i++}`);        values.push(data.title); }
    if (data.forenames   !== undefined) { fields.push(`forenames = $${i++}`);    values.push(data.forenames);
                                          fields.push(`initials = $${i++}`);     values.push(deriveInitials(data.forenames)); }
    if (data.surname     !== undefined) { fields.push(`surname = $${i++}`);      values.push(data.surname); }
    if (data.knownAs     !== undefined) { fields.push(`known_as = $${i++}`);     values.push(data.knownAs); }
    if (data.suffix      !== undefined) { fields.push(`suffix = $${i++}`);       values.push(data.suffix); }
    if (data.email       !== undefined) { fields.push(`email = $${i++}`);        values.push(data.email ? data.email.toLowerCase() : null); }
    if (data.mobile      !== undefined) { fields.push(`mobile = $${i++}`);       values.push(data.mobile); }
    if (data.statusId    !== undefined) { fields.push(`status_id = $${i++}`);    values.push(data.statusId);
                                         fields.push('card_printed = false'); }
    if (data.classId     !== undefined) { fields.push(`class_id = $${i++}`);     values.push(data.classId); }
    if (data.joinedOn    !== undefined) { fields.push(`joined_on = $${i++}::date`);    values.push(data.joinedOn); }
    if (data.nextRenewal !== undefined) { fields.push(`next_renewal = $${i++}::date`); values.push(data.nextRenewal); }
    if (data.giftAidFrom !== undefined) { fields.push(`gift_aid_from = $${i++}::date`); values.push(data.giftAidFrom); }
    if (data.homeU3a     !== undefined) { fields.push(`home_u3a = $${i++}`);     values.push(data.homeU3a); }
    if (data.notes       !== undefined) { fields.push(`notes = $${i++}`);        values.push(data.notes); }
    if (data.hideContact !== undefined) { fields.push(`hide_contact = $${i++}`); values.push(data.hideContact); }
    if (data.customField1 !== undefined) { fields.push(`custom_field_1 = $${i++}`); values.push(data.customField1); }
    if (data.customField2 !== undefined) { fields.push(`custom_field_2 = $${i++}`); values.push(data.customField2); }
    if (data.customField3 !== undefined) { fields.push(`custom_field_3 = $${i++}`); values.push(data.customField3); }
    if (data.customField4 !== undefined) { fields.push(`custom_field_4 = $${i++}`); values.push(data.customField4); }
    if (data.partnerId   !== undefined) { fields.push(`partner_id = $${i++}`);   values.push(data.partnerId); }
    if (data._newAddressId)             { fields.push(`address_id = $${i++}`);   values.push(data._newAddressId); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);
    values.push(memberId);

    const [member] = await tenantQuery(
      slug,
      `UPDATE members SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, membership_number`,
      values,
    );
    if (!member) throw AppError('Member not found.', 404);

    // After the member UPDATE, delete X's old address if it is no longer referenced
    if (oldAddressIdForCleanup && oldAddressIdForCleanup !== data._newAddressId) {
      const [remaining] = await tenantQuery(
        slug,
        `SELECT COUNT(*)::int AS n FROM members WHERE address_id = $1`,
        [oldAddressIdForCleanup],
      );
      if (remaining.n === 0) {
        await tenantQuery(slug, `DELETE FROM addresses WHERE id = $1`, [oldAddressIdForCleanup]);
      }
    }

    logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'update', entityType: 'member', entityId: member.id });

    // Gift Aid consent audit entry — log when gift_aid_from is set or cleared
    if (data.giftAidFrom !== undefined) {
      const oldGa = current.gift_aid_from ? String(current.gift_aid_from).slice(0, 10) : null;
      const newGa = data.giftAidFrom || null;
      if (newGa !== oldGa) {
        const memberName = `${data.forenames ?? current.forenames} ${data.surname ?? current.surname}`;
        const action = newGa ? 'gift_aid_consent' : 'gift_aid_withdrawn';
        logAudit(slug, { userId: req.user.userId, userName: req.user.name, action, entityType: 'member', entityId: member.id, entityName: memberName, detail: JSON.stringify({ giftAidFrom: newGa, previousGiftAidFrom: oldGa }) });
      }
    }

    res.json({ message: 'Member updated.', id: member.id, membership_number: member.membership_number });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /members/:id ──────────────────────────────────────────────────

router.delete('/:id', requirePrivilege('member_record', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const memberId = req.params.id;

    const [member] = await tenantQuery(
      slug,
      `SELECT id, address_id, partner_id FROM members WHERE id = $1`,
      [memberId],
    );
    if (!member) throw AppError('Member not found.', 404);

    // Clear partner back-reference before deleting
    if (member.partner_id) {
      await tenantQuery(
        slug,
        `UPDATE members SET partner_id = NULL, updated_at = now() WHERE id = $1`,
        [member.partner_id],
      );
    }

    await tenantQuery(slug, `DELETE FROM members WHERE id = $1`, [memberId]);

    // Delete address only if no other member references it
    if (member.address_id) {
      const [remaining] = await tenantQuery(
        slug,
        `SELECT COUNT(*)::int AS n FROM members WHERE address_id = $1`,
        [member.address_id],
      );
      if (remaining.n === 0) {
        await tenantQuery(slug, `DELETE FROM addresses WHERE id = $1`, [member.address_id]);
      }
    }

    logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'delete', entityType: 'member', entityId: memberId });
    res.json({ message: 'Member deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
