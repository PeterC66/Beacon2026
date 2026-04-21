// beacon2/backend/src/routes/finance/statements.js
// Financial statement and groups statement (JSON + Excel download).

import { Router } from 'express';
import ExcelJS from 'exceljs';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { computeYearBounds } from './helpers.js';

const router = Router();

// ─── FINANCIAL STATEMENT ──────────────────────────────────────────────────

/** Fetch all data needed for the financial statement. */
async function getStatementData(tenantSlug, accountId, yearNum) {
  const [settings] = await tenantQuery(
    tenantSlug,
    `SELECT year_start_month, year_start_day FROM tenant_settings WHERE id = 'singleton'`,
  );
  const { yearStart, yearEnd } = computeYearBounds(
    yearNum, settings.year_start_month, settings.year_start_day,
  );

  // accountId can be 'all' or a comma-separated list of IDs
  const isAll = accountId === 'all';
  let accounts;
  if (isAll) {
    accounts = await tenantQuery(tenantSlug, `SELECT id, name, balance_brought_forward::float FROM finance_accounts WHERE active = true ORDER BY sort_order, name`);
  } else {
    const requestedIds = accountId.split(',').map((s) => s.trim()).filter(Boolean);
    if (requestedIds.length === 0) throw AppError('At least one account must be selected.', 400);
    accounts = await tenantQuery(tenantSlug, `SELECT id, name, balance_brought_forward::float FROM finance_accounts WHERE id = ANY($1::text[]) ORDER BY sort_order, name`, [requestedIds]);
  }

  if (!isAll && accounts.length === 0) throw AppError('Account not found.', 404);

  const accountIds = accounts.map((a) => a.id);
  const totalBF    = accounts.reduce((s, a) => s + a.balance_brought_forward, 0);

  // Opening balance = BF + net of all non-pending transactions before year start
  const [priorNet] = await tenantQuery(
    tenantSlug,
    `SELECT COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE -amount END), 0)::float AS net
     FROM transactions WHERE account_id = ANY($1::text[]) AND date < $2::date AND pending = false`,
    [accountIds, yearStart],
  );
  const openingBalance = totalBF + (priorNet?.net ?? 0);

  // Category breakdown for this year (exclude pending and refund transactions)
  // For refunded originals, use net amount (original minus refund per category)
  const categoryRows = await tenantQuery(
    tenantSlug,
    `SELECT fc.name AS category, t.type,
            SUM(tc.amount - COALESCE(rc.amount, 0))::float AS total
     FROM transaction_categories tc
     JOIN transactions t ON t.id = tc.transaction_id
     JOIN finance_categories fc ON fc.id = tc.category_id
     LEFT JOIN transactions rt ON rt.id = t.refunded_by_id
     LEFT JOIN transaction_categories rc ON rc.transaction_id = rt.id AND rc.category_id = tc.category_id
     WHERE t.account_id = ANY($1::text[]) AND t.date BETWEEN $2::date AND $3::date
       AND t.pending = false AND t.refund_of_id IS NULL
     GROUP BY fc.name, t.type
     HAVING SUM(tc.amount - COALESCE(rc.amount, 0)) > 0
     ORDER BY fc.name, t.type`,
    [accountIds, yearStart, yearEnd],
  );

  // Year totals (exclude pending and refund transactions; net refunded originals)
  const [yearTotals] = await tenantQuery(
    tenantSlug,
    `SELECT COALESCE(SUM(CASE WHEN t.type='in'  THEN t.amount - COALESCE(rt.amount, 0) ELSE 0 END), 0)::float AS total_in,
            COALESCE(SUM(CASE WHEN t.type='out' THEN t.amount - COALESCE(rt.amount, 0) ELSE 0 END), 0)::float AS total_out
     FROM transactions t
     LEFT JOIN transactions rt ON rt.id = t.refunded_by_id
     WHERE t.account_id = ANY($1::text[]) AND t.date BETWEEN $2::date AND $3::date
       AND t.pending = false AND t.refund_of_id IS NULL`,
    [accountIds, yearStart, yearEnd],
  );

  // Count pending transactions in year range (for warning)
  const [pendingRow] = await tenantQuery(
    tenantSlug,
    `SELECT COUNT(*)::int AS count FROM transactions
     WHERE account_id = ANY($1::text[]) AND date BETWEEN $2::date AND $3::date AND pending = true`,
    [accountIds, yearStart, yearEnd],
  );
  const pendingCount = pendingRow?.count ?? 0;

  const totalIn       = yearTotals?.total_in  ?? 0;
  const totalOut      = yearTotals?.total_out ?? 0;
  const closingBalance = openingBalance + totalIn - totalOut;

  // Build label: "All Accounts", single name, or comma-separated names
  const allActive = await tenantQuery(tenantSlug, `SELECT COUNT(*)::int AS count FROM finance_accounts WHERE active = true`);
  const isEffectivelyAll = isAll || accounts.length === (allActive[0]?.count ?? 0);
  const accountLabel = isEffectivelyAll
    ? 'All Accounts'
    : accounts.map((a) => a.name).join(', ');

  return { yearNum, yearStart, yearEnd, accountLabel, openingBalance, totalIn, totalOut, closingBalance, categoryRows, pendingCount };
}

// GET /finance/statement?accountId=&year= — JSON data for on-screen display
router.get('/statement', requireFeature('financialStatement'), requirePrivilege('finance_statement', 'view'), async (req, res, next) => {
  try {
    const { accountId, year } = req.query;
    if (!accountId) throw AppError('accountId is required.', 400);
    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    const data = await getStatementData(req.user.tenantSlug, accountId, yearNum);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /finance/statement/download?accountId=&year=&format=xlsx — download Excel
router.get('/statement/download', requireFeature('financialStatement'), requirePrivilege('finance_statement', 'download'), async (req, res, next) => {
  try {
    const { accountId, year, format } = req.query;
    if (!accountId) throw AppError('accountId is required.', 400);
    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    const d = await getStatementData(req.user.tenantSlug, accountId, yearNum);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Statement');

    ws.columns = [
      { width: 35 }, { width: 15 }, { width: 15 },
    ];

    // Title
    ws.addRow([`Financial Statement — ${d.accountLabel}`]).font = { bold: true, size: 14 };
    ws.addRow([`Financial Year ${d.yearNum} (${d.yearStart} to ${d.yearEnd})`]).font = { italic: true };
    ws.addRow([]);

    // Receipts section
    ws.addRow(['Receipts (income)', 'Amount (£)']).font = { bold: true };
    const inRows = d.categoryRows.filter((r) => r.type === 'in');
    for (const row of inRows) {
      ws.addRow([row.category, Number(row.total).toFixed(2)]);
    }
    ws.addRow(['Total Receipts', Number(d.totalIn).toFixed(2)]).font = { bold: true };
    ws.addRow([]);

    // Payments section
    ws.addRow(['Payments (expenditure)', 'Amount (£)']).font = { bold: true };
    const outRows = d.categoryRows.filter((r) => r.type === 'out');
    for (const row of outRows) {
      ws.addRow([row.category, Number(row.total).toFixed(2)]);
    }
    ws.addRow(['Total Payments', Number(d.totalOut).toFixed(2)]).font = { bold: true };
    ws.addRow([]);

    // Balance Sheet
    ws.addRow(['Balance Sheet']).font = { bold: true };
    ws.addRow(['Opening Balance (brought forward)', Number(d.openingBalance).toFixed(2)]);
    ws.addRow(['Plus: Total Receipts',              Number(d.totalIn).toFixed(2)]);
    ws.addRow(['Less: Total Payments',              Number(d.totalOut).toFixed(2)]);
    ws.addRow(['Closing Balance',                   Number(d.closingBalance).toFixed(2)]).font = { bold: true };

    const tenantPart = req.user.tenantSlug.replace(/^u3a_/, '');
    const safeLabel  = d.accountLabel.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
    const filename   = `${tenantPart}_statement_${safeLabel}_${d.yearNum}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// ─── GROUPS STATEMENT ─────────────────────────────────────────────────────

/** Build groups statement data (shared by GET and download). */
async function getGroupsStatementData(tenantSlug, from, to) {
  const groups = await tenantQuery(
    tenantSlug,
    `SELECT g.id, g.name, g.short_name, g.type, g.status,
            COALESCE((SELECT SUM(COALESCE(b.money_in, 0)) - SUM(COALESCE(b.money_out, 0))
                      FROM group_ledger_entries b
                      WHERE b.group_id = g.id AND b.entry_date < $1::date), 0)::float AS bf,
            COALESCE(SUM(e.money_in),  0)::float AS total_in,
            COALESCE(SUM(e.money_out), 0)::float AS total_out
     FROM groups g
     LEFT JOIN group_ledger_entries e ON e.group_id = g.id
       AND e.entry_date BETWEEN $1::date AND $2::date
     GROUP BY g.id, g.name, g.short_name, g.type, g.status
     ORDER BY g.name`,
    [from, to],
  );
  // Compute balance as B/F + In - Out
  for (const g of groups) {
    g.balance = g.bf + g.total_in - g.total_out;
  }
  return groups;
}

/** Fetch individual ledger entries for all groups in the period. */
async function getGroupsStatementEntries(tenantSlug, from, to) {
  return tenantQuery(
    tenantSlug,
    `SELECT e.group_id, e.entry_date, e.payee, e.detail,
            e.money_in::float, e.money_out::float
     FROM group_ledger_entries e
     WHERE e.entry_date BETWEEN $1::date AND $2::date
     ORDER BY e.group_id, e.entry_date, e.id`,
    [from, to],
  );
}

// GET /finance/groups-statement?from=&to= — JSON summary
router.get('/groups-statement', requireFeature('groupsStatement'), requirePrivilege('group_statement', 'view'), async (req, res, next) => {
  try {
    const { from, to, showTransactions } = req.query;
    if (!from || !to) throw AppError('from and to dates are required.', 400);
    const groups = await getGroupsStatementData(req.user.tenantSlug, from, to);
    let entries = null;
    if (showTransactions === '1' || showTransactions === 'true') {
      entries = await getGroupsStatementEntries(req.user.tenantSlug, from, to);
    }
    res.json({ groups, entries });
  } catch (err) { next(err); }
});

// GET /finance/groups-statement/download?from=&to=&showTransactions= — Excel
router.get('/groups-statement/download', requireFeature('groupsStatement'), requirePrivilege('group_statement', 'download'), async (req, res, next) => {
  try {
    const { from, to, showTransactions } = req.query;
    if (!from || !to) throw AppError('from and to dates are required.', 400);
    const groups  = await getGroupsStatementData(req.user.tenantSlug, from, to);
    const entries = (showTransactions === '1' || showTransactions === 'true')
      ? await getGroupsStatementEntries(req.user.tenantSlug, from, to)
      : null;

    // Map entries by groupId for quick lookup
    const entriesByGroup = {};
    if (entries) {
      for (const e of entries) {
        if (!entriesByGroup[e.group_id]) entriesByGroup[e.group_id] = [];
        entriesByGroup[e.group_id].push(e);
      }
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Groups Statement');
    ws.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 12 }];

    ws.addRow([`Groups Statement — ${from} to ${to}`]).font = { bold: true, size: 13 };
    ws.addRow([]);

    const hdr = ws.addRow(['Group', 'B/F', 'In (£)', 'Out (£)', 'Balance (£)', 'Status']);
    hdr.font = { bold: true };

    for (const g of groups) {
      const gRow = ws.addRow([
        g.name,
        g.bf !== 0 ? Number(g.bf).toFixed(2) : '',
        Number(g.total_in).toFixed(2),
        Number(g.total_out).toFixed(2),
        Number(g.balance).toFixed(2),
        g.status,
      ]);
      gRow.font = { bold: true };

      if (entries && entriesByGroup[g.id]) {
        for (const e of entriesByGroup[g.id]) {
          ws.addRow([
            `  ${String(e.entry_date).slice(0, 10)} — ${e.payee ?? ''}${e.detail ? ': ' + e.detail : ''}`,
            '',
            e.money_in  > 0 ? Number(e.money_in).toFixed(2)  : '',
            e.money_out > 0 ? Number(e.money_out).toFixed(2) : '',
          ]);
        }
      }
    }

    // Totals row
    ws.addRow([]);
    const totBf  = groups.reduce((s, g) => s + g.bf,        0);
    const totIn  = groups.reduce((s, g) => s + g.total_in,  0);
    const totOut = groups.reduce((s, g) => s + g.total_out, 0);
    const totRow = ws.addRow([
      'TOTAL',
      Number(totBf).toFixed(2),
      Number(totIn).toFixed(2),
      Number(totOut).toFixed(2),
      Number(totBf + totIn - totOut).toFixed(2),
    ]);
    totRow.font = { bold: true };

    const tenantPart = req.user.tenantSlug.replace(/^u3a_/, '');
    const filename   = `${tenantPart}_groups_statement_${from}_to_${to}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

export default router;
