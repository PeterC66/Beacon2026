// beacon2/backend/src/routes/finance/transfers.js
// Transfer money CRUD.

import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();
router.use(requireFeature('transferMoney'));

// ─── TRANSFER MONEY ───────────────────────────────────────────────────────

const transferSchema = z.object({
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount:          z.number().positive(),
  from_account_id: z.string().min(1),
  to_account_id:   z.string().min(1),
  payment_ref:     z.string().optional().nullable(),
  detail:          z.string().optional().nullable(),
  remarks:         z.string().optional().nullable(),
  group_id:        z.string().optional().nullable(),
});

// GET /finance/transfers — list all transfers (most recent first)
router.get('/transfers', requirePrivilege('finance_transfer_money', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT t_out.transfer_id AS id,
              t_out.id AS from_txn_id,  t_in.id AS to_txn_id,
              t_out.transaction_number AS from_number,
              t_in.transaction_number  AS to_number,
              t_out.date,
              t_out.amount::float AS amount,
              t_out.account_id AS from_account_id,  fa_out.name AS from_account,
              t_in.account_id  AS to_account_id,    fa_in.name  AS to_account,
              t_out.payment_ref, t_out.detail, t_out.remarks,
              t_out.group_id, g.name AS group_name, g.short_name AS group_short_name, g.type AS group_type,
              t_out.cleared_at
       FROM transactions t_out
       JOIN transactions     t_in   ON t_in.transfer_id = t_out.transfer_id AND t_in.type = 'in'
       JOIN finance_accounts fa_out ON fa_out.id = t_out.account_id
       JOIN finance_accounts fa_in  ON fa_in.id  = t_in.account_id
       LEFT JOIN groups g ON g.id = t_out.group_id
       WHERE t_out.transfer_id IS NOT NULL AND t_out.type = 'out'
       ORDER BY t_out.date DESC, t_out.transaction_number DESC`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /finance/transfers/:transferId — get one transfer
router.get('/transfers/:transferId', requirePrivilege('finance_transfer_money', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT t.id, t.transaction_number, t.type, t.account_id,
              t.date, t.amount::float, t.payment_ref, t.detail, t.remarks,
              t.group_id, t.transfer_id, t.cleared_at, fa.name AS account_name
       FROM transactions t
       JOIN finance_accounts fa ON fa.id = t.account_id
       WHERE t.transfer_id = $1`,
      [req.params.transferId],
    );
    if (rows.length < 2) throw AppError('Transfer not found.', 404);
    const outRow = rows.find((r) => r.type === 'out');
    const inRow  = rows.find((r) => r.type === 'in');
    res.json({ id: req.params.transferId, out: outRow, in: inRow });
  } catch (err) { next(err); }
});

// POST /finance/transfers — create a new transfer (two linked transactions)
router.post('/transfers', requirePrivilege('finance_transfer_money', 'create'), async (req, res, next) => {
  try {
    const data = transferSchema.parse(req.body);
    if (data.from_account_id === data.to_account_id) {
      throw AppError('From and To accounts must be different.', 400);
    }
    const transferId = uuidv4();

    const [outTxn] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO transactions
         (account_id, date, type, amount, payment_ref, detail, remarks, group_id, transfer_id)
       VALUES ($1, $2::date, 'out', $3::numeric, $4, $5, $6, $7, $8)
       RETURNING id, transaction_number`,
      [data.from_account_id, data.date, data.amount,
       data.payment_ref ?? null, data.detail ?? null, data.remarks ?? null,
       data.group_id ?? null, transferId],
    );
    const [inTxn] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO transactions
         (account_id, date, type, amount, payment_ref, detail, remarks, group_id, transfer_id)
       VALUES ($1, $2::date, 'in', $3::numeric, $4, $5, $6, $7, $8)
       RETURNING id, transaction_number`,
      [data.to_account_id, data.date, data.amount,
       data.payment_ref ?? null, data.detail ?? null, data.remarks ?? null,
       data.group_id ?? null, transferId],
    );
    res.status(201).json({ id: transferId, out: outTxn, in: inTxn });
  } catch (err) { next(err); }
});

// PATCH /finance/transfers/:transferId — update both legs of a transfer
router.patch('/transfers/:transferId', requirePrivilege('finance_transfer_money', 'change'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, type, cleared_at FROM transactions WHERE transfer_id = $1`,
      [req.params.transferId],
    );
    if (rows.length < 2) throw AppError('Transfer not found.', 404);
    if (rows.some((r) => r.cleared_at)) throw AppError('Cleared transfers cannot be changed.', 400);

    const data = transferSchema.partial().parse(req.body);
    if (data.from_account_id && data.to_account_id && data.from_account_id === data.to_account_id) {
      throw AppError('From and To accounts must be different.', 400);
    }

    const outRow = rows.find((r) => r.type === 'out');
    const inRow  = rows.find((r) => r.type === 'in');

    // Update OUT transaction
    const outFields = []; const outVals = []; let oi = 1;
    if (data.date            !== undefined) { outFields.push(`date = $${oi++}::date`);        outVals.push(data.date); }
    if (data.amount          !== undefined) { outFields.push(`amount = $${oi++}::numeric`);   outVals.push(data.amount); }
    if (data.from_account_id !== undefined) { outFields.push(`account_id = $${oi++}`);        outVals.push(data.from_account_id); }
    if (data.payment_ref     !== undefined) { outFields.push(`payment_ref = $${oi++}`);       outVals.push(data.payment_ref); }
    if (data.detail          !== undefined) { outFields.push(`detail = $${oi++}`);            outVals.push(data.detail); }
    if (data.remarks         !== undefined) { outFields.push(`remarks = $${oi++}`);           outVals.push(data.remarks); }
    if (data.group_id        !== undefined) { outFields.push(`group_id = $${oi++}`);          outVals.push(data.group_id); }
    if (outFields.length > 0) {
      outFields.push(`updated_at = now()`);
      outVals.push(outRow.id);
      await tenantQuery(req.user.tenantSlug, `UPDATE transactions SET ${outFields.join(', ')} WHERE id = $${oi}`, outVals);
    }

    // Update IN transaction
    const inFields = []; const inVals = []; let ii = 1;
    if (data.date           !== undefined) { inFields.push(`date = $${ii++}::date`);        inVals.push(data.date); }
    if (data.amount         !== undefined) { inFields.push(`amount = $${ii++}::numeric`);   inVals.push(data.amount); }
    if (data.to_account_id  !== undefined) { inFields.push(`account_id = $${ii++}`);        inVals.push(data.to_account_id); }
    if (data.payment_ref    !== undefined) { inFields.push(`payment_ref = $${ii++}`);       inVals.push(data.payment_ref); }
    if (data.detail         !== undefined) { inFields.push(`detail = $${ii++}`);            inVals.push(data.detail); }
    if (data.remarks        !== undefined) { inFields.push(`remarks = $${ii++}`);           inVals.push(data.remarks); }
    if (data.group_id       !== undefined) { inFields.push(`group_id = $${ii++}`);          inVals.push(data.group_id); }
    if (inFields.length > 0) {
      inFields.push(`updated_at = now()`);
      inVals.push(inRow.id);
      await tenantQuery(req.user.tenantSlug, `UPDATE transactions SET ${inFields.join(', ')} WHERE id = $${ii}`, inVals);
    }

    res.json({ message: 'Transfer updated.' });
  } catch (err) { next(err); }
});

// DELETE /finance/transfers/:transferId — delete both legs
router.delete('/transfers/:transferId', requirePrivilege('finance_transfer_money', 'delete'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, cleared_at FROM transactions WHERE transfer_id = $1`,
      [req.params.transferId],
    );
    if (rows.length < 2) throw AppError('Transfer not found.', 404);
    if (rows.some((r) => r.cleared_at)) throw AppError('Cleared transfers cannot be deleted.', 400);
    await tenantQuery(req.user.tenantSlug, `DELETE FROM transactions WHERE transfer_id = $1`, [req.params.transferId]);
    res.json({ message: 'Transfer deleted.' });
  } catch (err) { next(err); }
});

export default router;
