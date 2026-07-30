// beacon2026/backend/src/routes/members/list.js
// Read-only member listings, statistics, validation, and download/export.

import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery, escapeLike } from '../../utils/db.js';
import { sanitizeCell } from '../../utils/spreadsheet.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

// ─── GET /members ─────────────────────────────────────────────────────────
// Query params:
//   status      – comma-separated list of status IDs  (default: all)
//   classId     – single class ID
//   pollId      – filter to members in this poll
//   negatePoll  – '1' to invert: members NOT in the poll
//   q           – free-text search
//   letter      – single letter to filter surname start
//   paymentMethod – filter by last membership transaction's payment method

router.get('/', requirePrivilege('members_list', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { status, classId, pollId, negatePoll, q, letter, cf, paymentMethod } = req.query;

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
      const like = `%${escapeLike(q)}%`;
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
      const cfLike = `%${escapeLike(cf)}%`;
      conditions.push(`(
        m.custom_field_1 ILIKE $${i}   OR
        m.custom_field_2 ILIKE $${i}   OR
        m.custom_field_3 ILIKE $${i}   OR
        m.custom_field_4 ILIKE $${i}
      )`);
      params.push(cfLike);
      i += 1;
    }

    if (paymentMethod) {
      conditions.push(`m.id IN (
        SELECT lt.member_id_1
        FROM (
          SELECT DISTINCT ON (t.member_id_1) t.member_id_1, t.payment_method
          FROM transactions t
          WHERE t.member_id_1 IS NOT NULL AND t.type = 'in'
          ORDER BY t.member_id_1, t.date DESC, t.created_at DESC
        ) lt
        WHERE lt.payment_method = $${i++}
      )`);
      params.push(paymentMethod);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const members = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.title, m.forenames, m.surname,
              m.known_as, m.email, m.mobile, m.hide_contact,
              ms.id AS status_id, ms.name AS status,
              mc.id AS class_id,  mc.name AS class,
              a.house_no, a.street, a.town, a.postcode, a.telephone,
              m.joined_on, m.next_renewal, m.partner_id,
              m.custom_field_1, m.custom_field_2,
              m.custom_field_3, m.custom_field_4,
              (m.portal_password_hash IS NOT NULL) AS has_portal_password,
              m.portal_email_verified
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
    const toDate = req.query.to || new Date().toISOString().slice(0, 10);
    const fromDate =
      req.query.from ||
      (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
      })();

    const rows = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
              m.email, m.mobile, a.telephone, m.joined_on, m.next_renewal,
              mc.name AS class_name,
              ms.name AS status_name,
              a.house_no, a.street, a.town, a.postcode,
              m.portal_password_hash IS NOT NULL AS has_portal_password,
              m.portal_email_verified
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

router.get(
  '/statistics',
  requirePrivilege('membership_statistics', 'view'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;

      // Fetch settings for year start and renewal periods
      const [cfg] = await tenantQuery(
        slug,
        `SELECT year_start_month, year_start_day, advance_renewals_weeks, grace_lapse_weeks
       FROM tenant_settings WHERE id = 'singleton'`,
      );
      const yearStartMonth = cfg?.year_start_month ?? 1;
      const yearStartDay = cfg?.year_start_day ?? 1;
      const advanceWeeks = cfg?.advance_renewals_weeks ?? 4;
      const graceLapse = cfg?.grace_lapse_weeks ?? 4;

      // Compute current membership year start date
      const now = new Date();
      const thisYear = now.getFullYear();
      const candidateStart = new Date(thisYear, yearStartMonth - 1, yearStartDay);
      const yearStartDate =
        candidateStart <= now
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
      const toDate = req.query.to || now.toISOString().slice(0, 10);
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
        graceLapseWeeks: graceLapse,
        currentNotRenewed: statusCounts?.current_not_renewed ?? 0,
        lapsedCount: statusCounts?.lapsed_count ?? 0,
        totalCurrent,
        classStats,
        activeGroups: groupStats?.active_groups ?? 0,
        avgGroupMembers: groupStats?.avg_members ?? 0,
        membersNotInGroup: notInGroup?.count ?? 0,
        renewStats,
        renewFrom: fromDate,
        renewTo: toDate,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/validate',
  requirePrivilege('member_data_validation', 'view'),
  async (req, res, next) => {
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
  },
);

// ─── GET /members/download ────────────────────────────────────────────────
// Download selected members as Excel, PDF, or email-CSV.
// Query params: format (excel|pdf|email-csv), ids (comma-separated), fields (comma-separated)

const MEMBER_FIELD_DEFS = {
  membership_number: { label: 'Membership No', get: (m) => String(m.membership_number ?? '') },
  title: { label: 'Title', get: (m) => m.title ?? '' },
  forenames: { label: 'Forenames', get: (m) => m.forenames ?? '' },
  known_as: { label: 'Known As', get: (m) => m.known_as ?? '' },
  surname: { label: 'Surname', get: (m) => m.surname ?? '' },
  email: { label: 'Email', get: (m) => m.email ?? '' },
  mobile: { label: 'Mobile', get: (m) => m.mobile ?? '' },
  telephone: { label: 'Telephone', get: (m) => m.telephone ?? '' },
  address: {
    label: 'Address',
    get: (m) => [m.house_no, m.street, m.add_line1, m.add_line2].filter(Boolean).join(', '),
  },
  town: { label: 'Town', get: (m) => m.town ?? '' },
  county: { label: 'County', get: (m) => m.county ?? '' },
  postcode: { label: 'Postcode', get: (m) => m.postcode ?? '' },
  country: { label: 'Country', get: (m) => m.country ?? '' },
  status: { label: 'Status', get: (m) => m.status ?? '' },
  class: { label: 'Class', get: (m) => m.class ?? '' },
  joined_on: { label: 'Joined', get: (m) => (m.joined_on ? String(m.joined_on).slice(0, 10) : '') },
  next_renewal: {
    label: 'Next Renewal',
    get: (m) => (m.next_renewal ? String(m.next_renewal).slice(0, 10) : ''),
  },
  custom_field_1: { label: 'Custom Field 1', get: (m) => m.custom_field_1 ?? '' },
  custom_field_2: { label: 'Custom Field 2', get: (m) => m.custom_field_2 ?? '' },
  custom_field_3: { label: 'Custom Field 3', get: (m) => m.custom_field_3 ?? '' },
  custom_field_4: { label: 'Custom Field 4', get: (m) => m.custom_field_4 ?? '' },
  emergency_contact: { label: 'Emergency Contact', get: (m) => m.emergency_contact ?? '' },
};

function buildMemberPdf(rows, cols, title) {
  const PAGE_W = 841.89;
  const PAGE_H = 595.28; // A4 landscape
  const MARGIN = 36;
  const FONT_SZ = 7;
  const ROW_H = 13;
  const usableW = PAGE_W - MARGIN * 2;
  const colW = usableW / cols.length;

  const doc = new PDFDocument({
    margin: MARGIN,
    size: 'A4',
    layout: 'landscape',
    autoFirstPage: true,
  });

  function drawHeader(y) {
    doc.font('Helvetica-Bold').fontSize(FONT_SZ);
    cols.forEach((f, idx) => {
      doc.text(MEMBER_FIELD_DEFS[f].label, MARGIN + idx * colW, y, {
        width: colW - 3,
        lineBreak: false,
        ellipsis: true,
      });
    });
    return y + ROW_H;
  }

  let y = MARGIN + 4;
  doc.font('Helvetica-Bold').fontSize(9).text(title, MARGIN, y, { lineBreak: false });
  y += 16;
  y = drawHeader(y);
  doc
    .moveTo(MARGIN, y - 2)
    .lineTo(PAGE_W - MARGIN, y - 2)
    .strokeColor('#aaaaaa')
    .stroke();

  doc.font('Helvetica').fontSize(FONT_SZ);
  for (const m of rows) {
    if (y + ROW_H > PAGE_H - MARGIN) {
      doc.addPage({ size: 'A4', layout: 'landscape' });
      y = MARGIN + 4;
      y = drawHeader(y);
      doc
        .moveTo(MARGIN, y - 2)
        .lineTo(PAGE_W - MARGIN, y - 2)
        .strokeColor('#aaaaaa')
        .stroke();
      doc.font('Helvetica').fontSize(FONT_SZ);
    }
    cols.forEach((f, idx) => {
      doc.text(MEMBER_FIELD_DEFS[f].get(m), MARGIN + idx * colW, y, {
        width: colW - 3,
        lineBreak: false,
        ellipsis: true,
      });
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
    const memberIds = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!memberIds.length) throw AppError('No member IDs provided.', 400);

    const rows = await tenantQuery(
      slug,
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
      const content = rows
        .map((m) => m.email)
        .filter(Boolean)
        .join('\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${tenantPart}_member_emails_${stamp}.csv"`,
      );
      return res.send(content);
    }

    const activeCols = fields
      .split(',')
      .map((s) => s.trim())
      .filter((f) => f && MEMBER_FIELD_DEFS[f]);
    const cols = activeCols.length ? activeCols : Object.keys(MEMBER_FIELD_DEFS);

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Members');
      ws.columns = cols.map((f) => ({ header: MEMBER_FIELD_DEFS[f].label, width: 20 }));
      ws.getRow(1).font = { bold: true };
      for (const m of rows) ws.addRow(cols.map((f) => sanitizeCell(MEMBER_FIELD_DEFS[f].get(m))));
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${tenantPart}_members_${stamp}.xlsx"`,
      );
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
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${tenantPart}_members_${stamp}.pdf"`,
      );
      return res.send(buf);
    }

    throw AppError('Invalid format.', 400);
  } catch (err) {
    next(err);
  }
});

export default router;
