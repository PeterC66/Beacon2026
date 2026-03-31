// beacon2/backend/src/routes/giftAid.js
// Gift Aid declaration: list eligible transactions, download Excel, mark as claimed.

import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { tenantQuery } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

/** Compute financial year bounds from settings. */
function computeYearBounds(yearNum, startMonth, startDay) {
  const m = String(startMonth).padStart(2, '0');
  const d = String(startDay).padStart(2, '0');
  const yearStart = `${yearNum}-${m}-${d}`;
  const next = new Date(Date.UTC(yearNum + 1, startMonth - 1, startDay));
  next.setUTCDate(next.getUTCDate() - 1);
  const yearEnd = next.toISOString().slice(0, 10);
  return { yearStart, yearEnd };
}

/** Determine the current financial year number based on today and year start settings. */
function currentFinancialYear(startMonth, startDay) {
  const now = new Date();
  const y = now.getFullYear();
  const thisYearStart = new Date(y, startMonth - 1, startDay);
  return now >= thisYearStart ? y : y - 1;
}

/** Fetch Gift Aid eligible transactions within a date range.
 *  A transaction is eligible when:
 *  - type = 'in' (a payment received)
 *  - linked to a member (member_id_1 or member_id_2)
 *  - gift_aid_amount (or gift_aid_amount_2) > 0
 *  - the member's gift_aid_from is set and <= the transaction date
 *
 *  Returns one row per member slot (member_slot = 1 or 2).
 *  The composite key for each row is (transaction id, member_slot).
 */
async function fetchDeclarationRows(tenantSlug, from, to, excludeClaimed) {
  let claimedFilter1 = '';
  let claimedFilter2 = '';
  if (excludeClaimed) {
    claimedFilter1 = 'AND t.gift_aid_claimed_at IS NULL';
    claimedFilter2 = 'AND t.gift_aid_claimed_at_2 IS NULL';
  }

  const rows = await tenantQuery(
    tenantSlug,
    `SELECT t.id, t.transaction_number, t.date, t.gift_aid_amount::float AS gift_aid_amount,
            t.gift_aid_claimed_at, 1 AS member_slot,
            m.id AS member_id, m.title, m.forenames, m.surname,
            m.membership_number, m.gift_aid_from, m.email,
            a.house_no, a.postcode
     FROM transactions t
     JOIN members m ON m.id = t.member_id_1
     LEFT JOIN addresses a ON a.id = m.address_id
     WHERE t.type = 'in'
       AND t.member_id_1 IS NOT NULL
       AND t.gift_aid_amount IS NOT NULL AND t.gift_aid_amount > 0
       AND m.gift_aid_from IS NOT NULL AND m.gift_aid_from <= t.date
       AND t.date BETWEEN $1::date AND $2::date
       ${claimedFilter1}

     UNION ALL

     SELECT t.id, t.transaction_number, t.date, t.gift_aid_amount_2::float AS gift_aid_amount,
            t.gift_aid_claimed_at_2 AS gift_aid_claimed_at, 2 AS member_slot,
            m.id AS member_id, m.title, m.forenames, m.surname,
            m.membership_number, m.gift_aid_from, m.email,
            a.house_no, a.postcode
     FROM transactions t
     JOIN members m ON m.id = t.member_id_2
     LEFT JOIN addresses a ON a.id = m.address_id
     WHERE t.type = 'in'
       AND t.member_id_2 IS NOT NULL
       AND t.gift_aid_amount_2 IS NOT NULL AND t.gift_aid_amount_2 > 0
       AND m.gift_aid_from IS NOT NULL AND m.gift_aid_from <= t.date
       AND t.date BETWEEN $1::date AND $2::date
       ${claimedFilter2}

     ORDER BY surname, forenames, date`,
    [from, to],
  );

  return rows;
}

// ─── LIST ──────────────────────────────────────────────────────────────────

// GET /gift-aid?year=&excludeClaimed=
router.get('/', requirePrivilege('gift_aid_declaration', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [settings] = await tenantQuery(
      slug,
      `SELECT year_start_month, year_start_day, gift_aid_enabled
       FROM tenant_settings WHERE id = 'singleton'`,
    );

    if (!settings?.gift_aid_enabled) {
      return res.json({ enabled: false, rows: [], yearNum: null });
    }

    const startMonth = settings.year_start_month;
    const startDay   = settings.year_start_day;
    const yearNum    = req.query.year
      ? parseInt(req.query.year, 10)
      : currentFinancialYear(startMonth, startDay);

    const { yearStart, yearEnd } = computeYearBounds(yearNum, startMonth, startDay);
    const excludeClaimed = req.query.excludeClaimed !== '0';

    const rows = await fetchDeclarationRows(slug, yearStart, yearEnd, excludeClaimed);

    res.json({
      enabled: true,
      rows,
      yearNum,
      yearStart,
      yearEnd,
      startMonth,
      startDay,
    });
  } catch (err) { next(err); }
});

// ─── DOWNLOAD EXCEL ─────────────────────────────────────────────────────

const downloadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  from: z.string().min(1),
  to: z.string().min(1),
});

// POST /gift-aid/download  body: { ids, from, to }
router.post('/download', requirePrivilege('gift_aid_declaration', 'download_and_mark'), async (req, res, next) => {
  try {
    const data = downloadSchema.parse(req.body);
    const slug = req.user.tenantSlug;

    // Fetch all rows in the date range, then filter to selected IDs
    const allRows = await fetchDeclarationRows(slug, data.from, data.to, false);
    const idSet = new Set(data.ids);
    const rows = allRows.filter((r) => idSet.has(r.id));

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No matching transactions found.' });
    }

    // Build Excel workbook matching HMRC column format
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Gift Aid');

    ws.columns = [
      { header: 'Title',              key: 'title',     width: 10 },
      { header: 'First Name',         key: 'firstName', width: 20 },
      { header: 'Last Name',          key: 'lastName',  width: 20 },
      { header: 'House Name or No',   key: 'houseNo',   width: 20 },
      { header: 'Postcode',           key: 'postcode',  width: 12 },
      { header: 'Date',               key: 'date',      width: 14 },
      { header: 'Amount',             key: 'amount',    width: 12 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FFE2EFDA' },
    };

    for (const r of rows) {
      // Format date as DD/MM/YYYY
      const dateStr = r.date ? fmtDate(r.date) : '';
      ws.addRow({
        title:     r.title || '',
        firstName: (r.forenames || '').split(' ')[0] || '',
        lastName:  r.surname || '',
        houseNo:   r.house_no || '',
        postcode:  r.postcode || '',
        date:      dateStr,
        amount:    Number(r.gift_aid_amount).toFixed(2),
      });
    }

    const tenantPart = slug.replace(/^u3a_/, '');
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${tenantPart}_gift_aid_declaration_${stamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buffer = await wb.xlsx.writeBuffer();
    res.send(buffer);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(422).json({ error: 'Validation failed.', issues: err.issues });
    }
    next(err);
  }
});

// ─── MARK AS CLAIMED ────────────────────────────────────────────────────

const markSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  ids_2: z.array(z.string().min(1)).optional(),
});

// POST /gift-aid/mark  body: { ids, ids_2 }
// ids = transaction IDs to mark member_slot 1 as claimed
// ids_2 = transaction IDs to mark member_slot 2 as claimed
router.post('/mark', requirePrivilege('gift_aid_declaration', 'download_and_mark'), async (req, res, next) => {
  try {
    const data = markSchema.parse(req.body);
    const slug = req.user.tenantSlug;
    const todayStr = new Date().toISOString().slice(0, 10);
    let totalMarked = 0;

    // Mark member slot 1
    if (data.ids.length > 0) {
      const result = await tenantQuery(
        slug,
        `UPDATE transactions
         SET gift_aid_claimed_at = $1::date, updated_at = now()
         WHERE id = ANY($2::text[])
           AND gift_aid_amount IS NOT NULL
           AND gift_aid_amount > 0
           AND gift_aid_claimed_at IS NULL
         RETURNING id`,
        [todayStr, data.ids],
      );
      totalMarked += result.length;
    }

    // Mark member slot 2
    if (data.ids_2 && data.ids_2.length > 0) {
      const result2 = await tenantQuery(
        slug,
        `UPDATE transactions
         SET gift_aid_claimed_at_2 = $1::date, updated_at = now()
         WHERE id = ANY($2::text[])
           AND gift_aid_amount_2 IS NOT NULL
           AND gift_aid_amount_2 > 0
           AND gift_aid_claimed_at_2 IS NULL
         RETURNING id`,
        [todayStr, data.ids_2],
      );
      totalMarked += result2.length;
    }

    logAudit(slug, {
      userId: req.user.userId,
      userName: req.user.name,
      action: 'gift_aid_mark',
      entityType: 'transactions',
      detail: JSON.stringify({ count: totalMarked, date: todayStr }),
    });

    res.json({ marked: totalMarked });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(422).json({ error: 'Validation failed.', issues: err.issues });
    }
    next(err);
  }
});

// ─── GIFT AID LOG — doc 9.2(b) ─────────────────────────────────────────
// GET /gift-aid/log?from=&to=&memberId=
// Returns audit entries for gift_aid_consent and gift_aid_withdrawn actions.

router.get('/log', requirePrivilege('gift_aid_declaration', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;

    // Default window: 3 months ago → today
    const now   = new Date();
    const dfrom = new Date(now);
    dfrom.setMonth(dfrom.getMonth() - 3);

    const fromStr = req.query.from || dfrom.toISOString().slice(0, 10);
    const toStr   = req.query.to   || now.toISOString().slice(0, 10);

    let sql = `
      SELECT id, user_name, action, entity_id, entity_name, detail, created_at
      FROM audit_log
      WHERE action IN ('gift_aid_consent', 'gift_aid_withdrawn')
        AND created_at >= $1::date
        AND created_at <  $2::date + INTERVAL '1 day'`;
    const params = [fromStr, toStr];

    if (req.query.memberId) {
      sql += `\n        AND entity_id = $3`;
      params.push(req.query.memberId);
    }

    sql += `\n      ORDER BY created_at DESC LIMIT 500`;

    const rows = await tenantQuery(slug, sql, params);

    // Also return a list of members who have entries, for the member filter dropdown
    const members = await tenantQuery(
      slug,
      `SELECT DISTINCT entity_id AS id, entity_name AS name
       FROM audit_log
       WHERE action IN ('gift_aid_consent', 'gift_aid_withdrawn')
       ORDER BY entity_name`,
    );

    res.json({ rows, members });
  } catch (err) { next(err); }
});

// ─── Helpers ────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return '';
  return `${day}/${m}/${y}`;
}

export default router;
