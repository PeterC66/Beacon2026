// beacon2/backend/src/routes/teams/ledger.js
// Team ledger sub-resource: /teams/:id/ledger. Uses the same
// group_ledger_entries table and privilege checks as group ledgers, gated by
// the `groupLedger` feature.

import { Router } from 'express';
import ExcelJS from 'exceljs';
import { requireFeature } from '../../middleware/requireFeature.js';
import { tenantQuery } from '../../utils/db.js';
import { sanitizeCell } from '../../utils/spreadsheet.js';
import { ledgerEntrySchema } from '../../schemas/common.js';

const router = Router();

async function hasLedgerAccess(req, teamId, action) {
  const { userId, tenantSlug, privileges } = req.user;
  if (privileges.includes(`group_ledger_all:${action}`)) return true;
  if (privileges.includes(`group_ledger_as_leader:${action}`)) {
    const rows = await tenantQuery(
      tenantSlug,
      `SELECT 1 FROM users u
       JOIN members m ON m.id = u.member_id
       JOIN group_members gm ON gm.member_id = m.id
       WHERE u.id = $1 AND gm.group_id = $2 AND gm.is_leader = true`,
      [userId, teamId],
    );
    return rows.length > 0;
  }
  return false;
}

// GET /teams/:id/ledger
router.get('/:id/ledger', requireFeature('groupLedger'), async (req, res, next) => {
  try {
    const teamId = req.params.id;
    if (!(await hasLedgerAccess(req, teamId, 'view'))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const slug = req.user.tenantSlug;

    const year = new Date().getFullYear();
    const from = req.query.from || `${year}-01-01`;
    const to = req.query.to || `${year}-12-31`;

    const bfRows = await tenantQuery(
      slug,
      `SELECT COALESCE(SUM(money_in),0) - COALESCE(SUM(money_out),0) AS bf
       FROM group_ledger_entries
       WHERE group_id = $1 AND entry_date < $2::date`,
      [teamId, from],
    );
    const broughtForward = parseFloat(bfRows[0]?.bf ?? 0);

    const entries = await tenantQuery(
      slug,
      `SELECT id, entry_date, payee, detail, money_in, money_out, created_at
       FROM group_ledger_entries
       WHERE group_id = $1 AND entry_date >= $2::date AND entry_date <= $3::date
       ORDER BY entry_date, created_at`,
      [teamId, from, to],
    );

    res.json({ broughtForward, entries });
  } catch (err) {
    next(err);
  }
});

// POST /teams/:id/ledger
router.post('/:id/ledger', requireFeature('groupLedger'), async (req, res, next) => {
  try {
    const teamId = req.params.id;
    if (!(await hasLedgerAccess(req, teamId, 'create'))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const data = ledgerEntrySchema.parse(req.body);
    const slug = req.user.tenantSlug;

    const [entry] = await tenantQuery(
      slug,
      `INSERT INTO group_ledger_entries (group_id, entry_date, payee, detail, money_in, money_out)
       VALUES ($1, $2::date, $3, $4, $5::numeric, $6::numeric)
       RETURNING *`,
      [
        teamId,
        data.entryDate,
        data.payee ?? null,
        data.detail ?? null,
        data.moneyIn ?? null,
        data.moneyOut ?? null,
      ],
    );
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// PATCH /teams/:id/ledger/:entryId
router.patch('/:id/ledger/:entryId', requireFeature('groupLedger'), async (req, res, next) => {
  try {
    const { id: teamId, entryId } = req.params;
    if (!(await hasLedgerAccess(req, teamId, 'change'))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const data = ledgerEntrySchema.partial().parse(req.body);
    const slug = req.user.tenantSlug;

    const fields = [];
    const vals = [];
    let pi = 1;
    if (data.entryDate !== undefined) {
      fields.push(`entry_date = $${pi++}::date`);
      vals.push(data.entryDate);
    }
    if (data.payee !== undefined) {
      fields.push(`payee      = $${pi++}`);
      vals.push(data.payee ?? null);
    }
    if (data.detail !== undefined) {
      fields.push(`detail     = $${pi++}`);
      vals.push(data.detail ?? null);
    }
    if (data.moneyIn !== undefined) {
      fields.push(`money_in   = $${pi++}::numeric`);
      vals.push(data.moneyIn ?? null);
    }
    if (data.moneyOut !== undefined) {
      fields.push(`money_out  = $${pi++}::numeric`);
      vals.push(data.moneyOut ?? null);
    }
    if (fields.length === 0) return res.json({});

    fields.push(`updated_at = now()`);
    const [updated] = await tenantQuery(
      slug,
      `UPDATE group_ledger_entries SET ${fields.join(', ')}
       WHERE id = $${pi++} AND group_id = $${pi++}
       RETURNING *`,
      [...vals, entryId, teamId],
    );
    if (!updated) return res.status(404).json({ error: 'Entry not found.' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /teams/:id/ledger/download
router.get('/:id/ledger/download', requireFeature('groupLedger'), async (req, res, next) => {
  try {
    const teamId = req.params.id;
    if (!(await hasLedgerAccess(req, teamId, 'download'))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const slug = req.user.tenantSlug;
    const { from, to } = req.query;

    const conditions = ['gle.group_id = $1'];
    const params = [teamId];
    let pi = 2;
    if (from) {
      conditions.push(`gle.entry_date >= $${pi++}::date`);
      params.push(from);
    }
    if (to) {
      conditions.push(`gle.entry_date <= $${pi++}::date`);
      params.push(to);
    }

    const [[teamRow], entries] = await Promise.all([
      tenantQuery(slug, `SELECT name FROM groups WHERE id = $1 AND type = 'team'`, [teamId]),
      tenantQuery(
        slug,
        `SELECT gle.entry_date, gle.payee, gle.detail, gle.money_in, gle.money_out
         FROM group_ledger_entries gle
         WHERE ${conditions.join(' AND ')}
         ORDER BY gle.entry_date, gle.created_at`,
        params,
      ),
    ]);

    const teamName = teamRow?.name ?? 'Team';
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Team Ledger');
    ws.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Payee', key: 'payee', width: 24 },
      { header: 'Detail', key: 'detail', width: 36 },
      { header: 'In (£)', key: 'money_in', width: 12 },
      { header: 'Out (£)', key: 'money_out', width: 12 },
      { header: 'Balance', key: 'balance', width: 12 },
    ];
    let balance = 0;
    for (const e of entries) {
      const inn = parseFloat(e.money_in) || 0;
      const out = parseFloat(e.money_out) || 0;
      balance += inn - out;
      ws.addRow({
        date: e.entry_date ? String(e.entry_date).slice(0, 10) : '',
        payee: sanitizeCell(e.payee ?? ''),
        detail: sanitizeCell(e.detail ?? ''),
        money_in: e.money_in != null ? parseFloat(e.money_in) : null,
        money_out: e.money_out != null ? parseFloat(e.money_out) : null,
        balance: parseFloat(balance.toFixed(2)),
      });
    }

    const tenantPart = req.user.tenantSlug.replace(/^u3a_/, '');
    const safeName = teamName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${tenantPart}_${safeName}_ledger_${dateStr}.xlsx`;

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
});

// DELETE /teams/:id/ledger/:entryId
router.delete('/:id/ledger/:entryId', requireFeature('groupLedger'), async (req, res, next) => {
  try {
    const { id: teamId, entryId } = req.params;
    if (!(await hasLedgerAccess(req, teamId, 'delete'))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const slug = req.user.tenantSlug;
    await tenantQuery(slug, `DELETE FROM group_ledger_entries WHERE id = $1 AND group_id = $2`, [
      entryId,
      teamId,
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
