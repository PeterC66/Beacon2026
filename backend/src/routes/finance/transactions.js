// beacon2/backend/src/routes/finance/transactions.js
// Transaction list, single, create, bulk-pending, update, delete, and refund.

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../utils/audit.js';
import { FINANCE_PAYMENT_METHODS } from '../../../../shared/constants.js';
import { computeYearBounds } from './helpers.js';

const router = Router();

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────

// GET /finance/transactions?accountId=&categoryId=&groupId=&memberId=&eventId=&year=
router.get('/transactions', requirePrivilege('finance_ledger', 'view'), async (req, res, next) => {
  try {
    const { accountId, categoryId, groupId, memberId, eventId, year } = req.query;
    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    const yearStart = `${yearNum}-01-01`;
    const yearEnd   = `${yearNum}-12-31`;

    let sql, params;

    // Common SELECT columns shared by all views
    const commonCols = `
               t.id, t.transaction_number, t.account_id, t.date, t.type,
               t.from_to, t.amount::float, t.payment_method, t.payment_ref,
               t.detail, t.remarks, t.cleared_at, t.pending,
               t.member_id_1, t.member_id_2, t.group_id, t.event_id,
               t.batch_id,
               t.refund_of_id, t.refunded_by_id,
               ref_orig.transaction_number AS refund_of_txn_number,
               ref_by.transaction_number AS refunded_by_txn_number,
               m1.forenames || ' ' || m1.surname AS member_1_name,
               m1.membership_number AS member_1_no,
               m2.forenames || ' ' || m2.surname AS member_2_name,
               m2.membership_number AS member_2_no,
               g.name AS group_name, g.short_name AS group_short_name, g.type AS group_type,
               ge_ev.event_date AS event_date, ge_ev.topic AS event_topic,
               COALESCE(ge_g.name, ge_et.name) AS event_label,
               fa.name AS account_name,
               cb.batch_ref AS batch_no,
               cb.description AS batch_description`;
    const commonJoins = `
        LEFT JOIN members m1 ON m1.id = t.member_id_1
        LEFT JOIN members m2 ON m2.id = t.member_id_2
        LEFT JOIN groups g   ON g.id  = t.group_id
        LEFT JOIN group_events ge_ev ON ge_ev.id = t.event_id
        LEFT JOIN groups ge_g ON ge_g.id = ge_ev.group_id
        LEFT JOIN event_types ge_et ON ge_et.id = ge_ev.event_type_id
        LEFT JOIN finance_accounts fa ON fa.id = t.account_id
        LEFT JOIN credit_batches cb ON cb.id = t.batch_id
        LEFT JOIN transactions ref_orig ON ref_orig.id = t.refund_of_id
        LEFT JOIN transactions ref_by   ON ref_by.id   = t.refunded_by_id
        LEFT JOIN transaction_categories tc ON tc.transaction_id = t.id
        LEFT JOIN finance_categories fc ON fc.id = tc.category_id`;
    const categoriesAgg = `
               COALESCE(
                 json_agg(json_build_object('category_id', tc.category_id, 'name', fc.name, 'amount', tc.amount::float))
                   FILTER (WHERE tc.id IS NOT NULL), '[]'
               ) AS categories`;
    const commonGroupBy = `t.id, m1.forenames, m1.surname, m1.membership_number,
                 m2.forenames, m2.surname, m2.membership_number,
                 g.name, g.short_name, g.type,
                 ge_ev.event_date, ge_ev.topic, ge_g.name, ge_et.name,
                 fa.name, cb.batch_ref, cb.description,
                 ref_orig.transaction_number, ref_by.transaction_number`;

    if (memberId) {
      sql = `
        SELECT ${commonCols},
               ${categoriesAgg}
        FROM transactions t
        ${commonJoins}
        WHERE (t.member_id_1 = $1 OR t.member_id_2 = $1)
        GROUP BY ${commonGroupBy}
        ORDER BY t.date, t.transaction_number`;
      params = [memberId];

    } else if (accountId) {
      sql = `
        SELECT ${commonCols},
               ${categoriesAgg}
        FROM transactions t
        ${commonJoins}
        WHERE t.account_id = $1 AND t.date BETWEEN $2::date AND $3::date
        GROUP BY ${commonGroupBy}
        ORDER BY t.date, t.transaction_number`;
      params = [accountId, yearStart, yearEnd];

    } else if (categoryId) {
      sql = `
        SELECT ${commonCols},
               tc_this.amount::float AS category_amount,
               ${categoriesAgg}
        FROM transactions t
        JOIN transaction_categories tc_this ON tc_this.transaction_id = t.id AND tc_this.category_id = $1
        ${commonJoins}
        WHERE t.date BETWEEN $2::date AND $3::date
        GROUP BY ${commonGroupBy}, tc_this.amount
        ORDER BY t.date, t.transaction_number`;
      params = [categoryId, yearStart, yearEnd];

    } else if (groupId) {
      sql = `
        SELECT ${commonCols},
               ${categoriesAgg}
        FROM transactions t
        ${commonJoins}
        WHERE ($1 = 'all' OR t.group_id = $1) AND t.date BETWEEN $2::date AND $3::date
        GROUP BY ${commonGroupBy}
        ORDER BY t.date, t.transaction_number`;
      params = [groupId, yearStart, yearEnd];

    } else if (eventId) {
      sql = `
        SELECT ${commonCols},
               ${categoriesAgg}
        FROM transactions t
        ${commonJoins}
        WHERE t.event_id = $1
        GROUP BY ${commonGroupBy}
        ORDER BY t.date, t.transaction_number`;
      params = [eventId];

    } else {
      return res.json([]);
    }

    const rows = await tenantQuery(req.user.tenantSlug, sql, params);

    // For account view, also compute the opening balance (BF + net of prior-year transactions)
    if (accountId) {
      const [acc] = await tenantQuery(
        req.user.tenantSlug,
        `SELECT balance_brought_forward::float FROM finance_accounts WHERE id = $1`,
        [accountId],
      );
      const bf = acc?.balance_brought_forward ?? 0;
      const [priorNet] = await tenantQuery(
        req.user.tenantSlug,
        `SELECT COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE -amount END), 0)::float AS net
         FROM transactions WHERE account_id = $1 AND date < $2::date AND pending = false`,
        [accountId, yearStart],
      );
      const openingBalance = bf + (priorNet?.net ?? 0);
      return res.json({ transactions: rows, openingBalance });
    }

    // For group view, compute per-group opening balances if group_bf_enabled
    if (groupId) {
      const [setting] = await tenantQuery(
        req.user.tenantSlug,
        `SELECT group_bf_enabled FROM tenant_settings WHERE id = 'singleton'`,
      );
      if (setting?.group_bf_enabled) {
        let bfSql, bfParams;
        if (groupId === 'all') {
          bfSql = `
            SELECT t.group_id, g.name AS group_name, g.short_name AS group_short_name, g.type AS group_type,
                   COALESCE(SUM(CASE WHEN t.type='in' THEN t.amount ELSE -t.amount END), 0)::float AS balance
            FROM transactions t
            LEFT JOIN groups g ON g.id = t.group_id
            WHERE t.group_id IS NOT NULL AND t.date < $1::date AND t.pending = false
            GROUP BY t.group_id, g.name, g.short_name, g.type
            HAVING SUM(CASE WHEN t.type='in' THEN t.amount ELSE -t.amount END) <> 0
            ORDER BY g.name`;
          bfParams = [yearStart];
        } else {
          bfSql = `
            SELECT t.group_id, g.name AS group_name, g.short_name AS group_short_name, g.type AS group_type,
                   COALESCE(SUM(CASE WHEN t.type='in' THEN t.amount ELSE -t.amount END), 0)::float AS balance
            FROM transactions t
            LEFT JOIN groups g ON g.id = t.group_id
            WHERE t.group_id = $1 AND t.date < $2::date AND t.pending = false
            GROUP BY t.group_id, g.name, g.short_name, g.type`;
          bfParams = [groupId, yearStart];
        }
        const groupBfRows = await tenantQuery(req.user.tenantSlug, bfSql, bfParams);
        return res.json({ transactions: rows, groupBf: groupBfRows });
      }
    }

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /finance/transactions/:id
router.get('/transactions/:id', requirePrivilege('finance_transactions', 'view'), async (req, res, next) => {
  try {
    const [txn] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT t.id, t.transaction_number, t.account_id, t.date, t.type,
              t.from_to, t.amount::float, t.payment_method, t.payment_ref,
              t.detail, t.remarks, t.cleared_at, t.pending, t.transfer_id,
              t.member_id_1, t.member_id_2, t.group_id, t.event_id,
              t.gift_aid_amount::float AS gift_aid_amount, t.gift_aid_claimed_at,
              t.gift_aid_amount_2::float AS gift_aid_amount_2, t.gift_aid_claimed_at_2,
              t.batch_id, cb.batch_ref,
              t.refund_of_id, t.refunded_by_id,
              ref_orig.transaction_number AS refund_of_txn_number,
              ref_by.transaction_number AS refunded_by_txn_number,
              ref_by.amount::float AS refunded_amount,
              m1.forenames || ' ' || m1.surname AS member_1_name,
              m2.forenames || ' ' || m2.surname AS member_2_name,
              g.name AS group_name, g.short_name AS group_short_name, g.type AS group_type,
              ge_ev.event_date AS event_date, ge_ev.topic AS event_topic,
              COALESCE(ge_g.name, ge_et.name) AS event_label,
              fa.name AS account_name,
              fa.enable_refunds AS account_enable_refunds,
              COALESCE(
                json_agg(json_build_object('category_id', tc.category_id, 'name', fc.name, 'amount', tc.amount::float))
                  FILTER (WHERE tc.id IS NOT NULL), '[]'
              ) AS categories
       FROM transactions t
       LEFT JOIN members m1 ON m1.id = t.member_id_1
       LEFT JOIN members m2 ON m2.id = t.member_id_2
       LEFT JOIN groups g   ON g.id  = t.group_id
       LEFT JOIN group_events ge_ev ON ge_ev.id = t.event_id
       LEFT JOIN groups ge_g ON ge_g.id = ge_ev.group_id
       LEFT JOIN event_types ge_et ON ge_et.id = ge_ev.event_type_id
       LEFT JOIN finance_accounts fa ON fa.id = t.account_id
       LEFT JOIN credit_batches cb ON cb.id = t.batch_id
       LEFT JOIN transactions ref_orig ON ref_orig.id = t.refund_of_id
       LEFT JOIN transactions ref_by   ON ref_by.id   = t.refunded_by_id
       LEFT JOIN transaction_categories tc ON tc.transaction_id = t.id
       LEFT JOIN finance_categories fc ON fc.id = tc.category_id
       WHERE t.id = $1
       GROUP BY t.id, m1.forenames, m1.surname, m2.forenames, m2.surname, g.name, g.short_name, g.type,
                ge_ev.event_date, ge_ev.topic, ge_g.name, ge_et.name,
                fa.name, cb.batch_ref,
                ref_orig.transaction_number, ref_by.transaction_number, ref_by.amount, fa.enable_refunds`,
      [req.params.id],
    );
    if (!txn) throw AppError('Transaction not found.', 404);
    res.json(txn);
  } catch (err) { next(err); }
});

// POST /finance/transactions
const txnCategorySchema = z.object({
  category_id: z.string().min(1),
  amount:      z.number().positive(),
});

const createTxnSchema = z.object({
  account_id:     z.string().min(1),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type:           z.enum(['in', 'out']),
  from_to:        z.string().optional().nullable(),
  amount:         z.number().positive(),
  payment_method: z.string().optional().nullable(),
  payment_ref:    z.string().optional().nullable(),
  detail:         z.string().optional().nullable(),
  remarks:        z.string().optional().nullable(),
  member_id_1:       z.string().optional().nullable(),
  member_id_2:       z.string().optional().nullable(),
  group_id:          z.string().optional().nullable(),
  event_id:          z.string().optional().nullable(),
  pending:           z.boolean().optional(),
  gift_aid_amount:   z.number().min(0).optional().nullable(),
  gift_aid_amount_2: z.number().min(0).optional().nullable(),
  categories:        z.array(txnCategorySchema).min(1),
});

router.post('/transactions', requirePrivilege('finance_transactions', 'create'), async (req, res, next) => {
  try {
    const data = createTxnSchema.parse(req.body);

    // Validate category amounts sum to transaction amount
    const catTotal = data.categories.reduce((s, c) => s + c.amount, 0);
    if (Math.abs(catTotal - data.amount) > 0.001) {
      throw AppError(`Category amounts (${catTotal.toFixed(2)}) must equal transaction amount (${data.amount.toFixed(2)}).`, 400);
    }

    // Determine pending status based on account config
    let pending = data.pending ?? false;
    const [acct] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT pending_config, pending_types FROM finance_accounts WHERE id = $1`,
      [data.account_id],
    );
    if (acct) {
      if (acct.pending_config === 'disabled') {
        pending = false;
      } else if (acct.pending_config === 'by_type') {
        const types = acct.pending_types ?? [];
        pending = types.includes(data.payment_method ?? '');
      }
      // 'optional' — use whatever the client sent
    }

    const [txn] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO transactions
         (account_id, date, type, from_to, amount, payment_method, payment_ref, detail, remarks, member_id_1, member_id_2, group_id, event_id, pending, gift_aid_amount, gift_aid_amount_2)
       VALUES ($1, $2::date, $3, $4, $5::numeric, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::numeric, $16::numeric)
       RETURNING id, transaction_number`,
      [
        data.account_id, data.date, data.type,
        data.from_to ?? null, data.amount,
        data.payment_method ?? null, data.payment_ref ?? null,
        data.detail ?? null, data.remarks ?? null,
        data.member_id_1 ?? null, data.member_id_2 ?? null, data.group_id ?? null,
        data.event_id ?? null, pending,
        data.gift_aid_amount ?? null, data.gift_aid_amount_2 ?? null,
      ],
    );

    for (const cat of data.categories) {
      await tenantQuery(
        req.user.tenantSlug,
        `INSERT INTO transaction_categories (transaction_id, category_id, amount) VALUES ($1, $2, $3::numeric)`,
        [txn.id, cat.category_id, cat.amount],
      );
    }

    res.status(201).json({ id: txn.id, transaction_number: txn.transaction_number });
  } catch (err) { next(err); }
});

// ─── BULK PENDING ────────────────────────────────────────────────────────
// Must be defined BEFORE /transactions/:id to avoid Express matching 'bulk-pending' as :id.

const bulkPendingSchema = z.object({
  ids:     z.array(z.string().min(1)).min(1),
  pending: z.boolean(),
});

router.patch('/transactions/bulk-pending', requirePrivilege('finance_transactions', 'change'), async (req, res, next) => {
  try {
    const { ids, pending } = bulkPendingSchema.parse(req.body);

    // Validate: only non-cleared, non-transfer, non-batched transactions
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, cleared_at, transfer_id, batch_id FROM transactions WHERE id = ANY($1::text[])`,
      [ids],
    );

    const errors = [];
    for (const r of rows) {
      if (r.cleared_at)   errors.push(`Transaction ${r.id} is cleared.`);
      if (r.transfer_id)  errors.push(`Transaction ${r.id} is a transfer.`);
      if (r.batch_id)     errors.push(`Transaction ${r.id} is in a credit batch.`);
    }
    if (errors.length > 0) throw AppError(errors.join(' '), 400);

    await tenantQuery(
      req.user.tenantSlug,
      `UPDATE transactions SET pending = $1, updated_at = now() WHERE id = ANY($2::text[])`,
      [pending, ids],
    );

    res.json({ message: `${ids.length} transaction(s) updated.`, count: ids.length });
  } catch (err) { next(err); }
});

// PATCH /finance/transactions/:id
const updateTxnSchema = createTxnSchema.partial().extend({
  categories: z.array(txnCategorySchema).min(1).optional(),
  batch_id:   z.string().nullable().optional(),
  pending:    z.boolean().optional(),
});

router.patch('/transactions/:id', requirePrivilege('finance_transactions', 'change'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, amount::float AS amount, cleared_at, transfer_id, pending, refund_of_id, refunded_by_id FROM transactions WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Transaction not found.', 404);
    if (current.transfer_id) throw AppError('This transaction is part of a transfer. Use the Transfer Money page to edit it.', 400);
    if (current.cleared_at) throw AppError('Cleared transactions cannot be changed.', 400);
    if (current.refunded_by_id) throw AppError('This transaction has been refunded and cannot be changed. Delete the refund first.', 400);
    if (current.refund_of_id) throw AppError('Refund transactions cannot be edited. Delete and re-create the refund instead.', 400);

    const data = updateTxnSchema.parse(req.body);

    // Transfers cannot be marked as pending
    if (data.pending === true && current.transfer_id) {
      throw AppError('Transfers cannot be marked as pending.', 400);
    }

    // If categories are being updated, validate sum
    if (data.categories) {
      const newAmount = data.amount ?? current.amount;
      const catTotal  = data.categories.reduce((s, c) => s + c.amount, 0);
      if (Math.abs(catTotal - newAmount) > 0.001) {
        throw AppError(`Category amounts (${catTotal.toFixed(2)}) must equal transaction amount (${newAmount.toFixed(2)}).`, 400);
      }
    }

    const fields = [];
    const values = [];
    let i = 1;
    if (data.account_id     !== undefined) { fields.push(`account_id = $${i++}`);     values.push(data.account_id); }
    if (data.date           !== undefined) { fields.push(`date = $${i++}::date`);     values.push(data.date); }
    if (data.type           !== undefined) { fields.push(`type = $${i++}`);           values.push(data.type); }
    if (data.from_to        !== undefined) { fields.push(`from_to = $${i++}`);        values.push(data.from_to); }
    if (data.amount         !== undefined) { fields.push(`amount = $${i++}::numeric`);values.push(data.amount); }
    if (data.payment_method !== undefined) { fields.push(`payment_method = $${i++}`); values.push(data.payment_method); }
    if (data.payment_ref    !== undefined) { fields.push(`payment_ref = $${i++}`);    values.push(data.payment_ref); }
    if (data.detail         !== undefined) { fields.push(`detail = $${i++}`);         values.push(data.detail); }
    if (data.remarks        !== undefined) { fields.push(`remarks = $${i++}`);        values.push(data.remarks); }
    if (data.member_id_1    !== undefined) { fields.push(`member_id_1 = $${i++}`);    values.push(data.member_id_1); }
    if (data.member_id_2    !== undefined) { fields.push(`member_id_2 = $${i++}`);    values.push(data.member_id_2); }
    if (data.group_id       !== undefined) { fields.push(`group_id = $${i++}`);       values.push(data.group_id); }
    if (data.event_id       !== undefined) { fields.push(`event_id = $${i++}`);       values.push(data.event_id); }
    if (data.batch_id       !== undefined) { fields.push(`batch_id = $${i++}`);       values.push(data.batch_id); }
    if (data.pending        !== undefined) { fields.push(`pending = $${i++}`);        values.push(data.pending); }
    if (data.gift_aid_amount   !== undefined) { fields.push(`gift_aid_amount = $${i++}::numeric`);   values.push(data.gift_aid_amount); }
    if (data.gift_aid_amount_2 !== undefined) { fields.push(`gift_aid_amount_2 = $${i++}::numeric`); values.push(data.gift_aid_amount_2); }

    if (fields.length > 0) {
      fields.push(`updated_at = now()`);
      values.push(req.params.id);
      await tenantQuery(
        req.user.tenantSlug,
        `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${i}`,
        values,
      );
    }

    if (data.categories) {
      await tenantQuery(
        req.user.tenantSlug,
        `DELETE FROM transaction_categories WHERE transaction_id = $1`,
        [req.params.id],
      );
      for (const cat of data.categories) {
        await tenantQuery(
          req.user.tenantSlug,
          `INSERT INTO transaction_categories (transaction_id, category_id, amount) VALUES ($1, $2, $3::numeric)`,
          [req.params.id, cat.category_id, cat.amount],
        );
      }
    }

    res.json({ message: 'Transaction updated.' });
  } catch (err) { next(err); }
});

// DELETE /finance/transactions/:id
router.delete('/transactions/:id', requirePrivilege('finance_transactions', 'delete'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT cleared_at, transfer_id, refund_of_id, refunded_by_id FROM transactions WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Transaction not found.', 404);
    if (current.transfer_id) throw AppError('This transaction is part of a transfer. Use the Transfer Money page to delete it.', 400);
    if (current.cleared_at) throw AppError('Cleared transactions cannot be deleted.', 400);
    if (current.refunded_by_id) throw AppError('This transaction has been refunded. Delete the refund transaction first.', 400);

    // If this is a refund transaction, clear the refunded_by_id on the original
    if (current.refund_of_id) {
      await tenantQuery(
        req.user.tenantSlug,
        `UPDATE transactions SET refunded_by_id = NULL, updated_at = now() WHERE id = $1`,
        [current.refund_of_id],
      );
    }

    await tenantQuery(req.user.tenantSlug, `DELETE FROM transactions WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Transaction deleted.' });
  } catch (err) { next(err); }
});

// ─── REFUNDS (doc 7.10.7) ─────────────────────────────────────────────────

const refundSchema = z.object({
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.string().optional().nullable(),
  payment_ref:    z.string().optional().nullable(),
  detail:         z.string().optional().nullable(),
  remarks:        z.string().optional().nullable(),
  categories:     z.array(z.object({
    category_id: z.string().min(1),
    amount:      z.number().min(0),
  })).min(1),
});

router.post('/transactions/:id/refund', requirePrivilege('finance_transactions', 'create'), async (req, res, next) => {
  try {
    const data = refundSchema.parse(req.body);

    // Load the original transaction
    const [orig] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT t.id, t.transaction_number, t.account_id, t.date, t.type, t.from_to,
              t.amount::float, t.cleared_at, t.transfer_id, t.refund_of_id, t.refunded_by_id,
              t.member_id_1, t.member_id_2, t.group_id,
              t.gift_aid_claimed_at,
              fa.enable_refunds
       FROM transactions t
       JOIN finance_accounts fa ON fa.id = t.account_id
       WHERE t.id = $1`,
      [req.params.id],
    );
    if (!orig) throw AppError('Transaction not found.', 404);
    if (!orig.enable_refunds) throw AppError('Refunds are not enabled for this account.', 400);
    if (orig.cleared_at) throw AppError('Cleared transactions cannot be refunded. Un-clear it first.', 400);
    if (orig.transfer_id) throw AppError('Transfer transactions cannot be refunded.', 400);
    if (orig.refund_of_id) throw AppError('A refund transaction cannot itself be refunded.', 400);
    if (orig.refunded_by_id) throw AppError('This transaction has already been refunded.', 400);
    if (orig.gift_aid_claimed_at) throw AppError('Transactions with claimed Gift Aid cannot be refunded.', 400);

    // Validate refund date: must be after original date
    if (data.date <= orig.date) {
      throw AppError('Refund date must be after the original transaction date.', 400);
    }

    // Validate refund date is in the same financial year as the original
    const [settings] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT year_start_month, year_start_day FROM tenant_settings WHERE id = 'singleton'`,
    );
    const sm = settings.year_start_month;
    const sd = settings.year_start_day;

    // Find which financial year the original transaction belongs to
    const origDate = new Date(orig.date + 'T00:00:00Z');
    let origYear = origDate.getUTCFullYear();
    const fyStartOrig = new Date(Date.UTC(origYear, sm - 1, sd));
    if (origDate < fyStartOrig) origYear--;
    const { yearStart: fyStart, yearEnd: fyEnd } = computeYearBounds(origYear, sm, sd);

    if (data.date < fyStart || data.date > fyEnd) {
      throw AppError('Refund date must be in the same financial year as the original transaction.', 400);
    }

    // Validate refund category amounts
    const refundTotal = data.categories.reduce((s, c) => s + c.amount, 0);
    if (refundTotal <= 0) throw AppError('Refund amount must be positive.', 400);
    if (refundTotal > orig.amount) throw AppError('Refund total cannot exceed the original transaction amount.', 400);

    // Load original category amounts to validate per-category limits
    const origCats = await tenantQuery(
      req.user.tenantSlug,
      `SELECT category_id, amount::float FROM transaction_categories WHERE transaction_id = $1`,
      [orig.id],
    );
    const origCatMap = {};
    for (const oc of origCats) origCatMap[oc.category_id] = oc.amount;

    for (const rc of data.categories) {
      if (rc.amount === 0) continue;
      const origAmt = origCatMap[rc.category_id];
      if (origAmt === undefined) throw AppError(`Category not found on original transaction.`, 400);
      if (rc.amount > origAmt + 0.001) throw AppError(`Refund for category exceeds original amount.`, 400);
    }

    // Create the refund transaction (opposite type)
    const refundType = orig.type === 'in' ? 'out' : 'in';
    const [refundTxn] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO transactions
         (account_id, date, type, from_to, amount, payment_method, payment_ref, detail, remarks,
          member_id_1, member_id_2, group_id, pending, refund_of_id)
       VALUES ($1, $2::date, $3, $4, $5::numeric, $6, $7, $8, $9, $10, $11, $12, false, $13)
       RETURNING id, transaction_number`,
      [
        orig.account_id, data.date, refundType, orig.from_to,
        refundTotal,
        data.payment_method ?? null, data.payment_ref ?? null,
        data.detail ?? null, data.remarks ?? null,
        orig.member_id_1, orig.member_id_2, orig.group_id,
        orig.id,
      ],
    );

    // Insert refund category splits (only non-zero amounts)
    for (const cat of data.categories) {
      if (cat.amount === 0) continue;
      await tenantQuery(
        req.user.tenantSlug,
        `INSERT INTO transaction_categories (transaction_id, category_id, amount) VALUES ($1, $2, $3::numeric)`,
        [refundTxn.id, cat.category_id, cat.amount],
      );
    }

    // Link original to refund
    await tenantQuery(
      req.user.tenantSlug,
      `UPDATE transactions SET refunded_by_id = $1, updated_at = now() WHERE id = $2`,
      [refundTxn.id, orig.id],
    );

    logAudit(req.user.tenantSlug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'create', entityType: 'transaction', entityId: refundTxn.id,
      entityName: `Refund #${refundTxn.transaction_number} of #${orig.transaction_number}`,
    });

    res.status(201).json({ id: refundTxn.id, transaction_number: refundTxn.transaction_number });
  } catch (err) { next(err); }
});

export default router;
