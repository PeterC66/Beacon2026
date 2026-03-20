// beacon2/backend/src/routes/finance.js
// Finance accounts, categories, transactions, transfers, reconciliation, statements.

import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

// ─── FINANCE ACCOUNTS ─────────────────────────────────────────────────────

router.get('/accounts', requirePrivilege('finance_accounts', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, active, locked, sort_order,
              balance_brought_forward::float,
              pending_config, pending_types, enable_refunds, created_at
       FROM finance_accounts ORDER BY sort_order, name`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

const accountSchema = z.object({
  name:                    z.string().min(1).max(100),
  active:                  z.boolean().optional(),
  sort_order:              z.number().int().optional(),
  balance_brought_forward: z.number().optional(),
});

router.post('/accounts', requirePrivilege('finance_accounts', 'create'), async (req, res, next) => {
  try {
    const data = accountSchema.parse(req.body);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO finance_accounts (name, active, sort_order, balance_brought_forward)
       VALUES ($1, $2, $3, $4::numeric)
       RETURNING id, name, active, locked, sort_order, balance_brought_forward::float`,
      [data.name, data.active ?? true, data.sort_order ?? 0, data.balance_brought_forward ?? 0],
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.patch('/accounts/:id', requirePrivilege('finance_accounts', 'change'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT locked FROM finance_accounts WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Account not found.', 404);

    const data = accountSchema.partial().parse(req.body);

    // Locked accounts only allow balance_brought_forward to be changed
    const onlyBF = Object.keys(data).every((k) => k === 'balance_brought_forward');
    if (current.locked && !onlyBF) throw AppError('This account is locked — only the balance brought forward can be changed.', 400);

    const fields = [];
    const values = [];
    let i = 1;
    if (data.name                    !== undefined) { fields.push(`name = $${i++}`);                          values.push(data.name); }
    if (data.active                  !== undefined) { fields.push(`active = $${i++}`);                        values.push(data.active); }
    if (data.sort_order              !== undefined) { fields.push(`sort_order = $${i++}`);                    values.push(data.sort_order); }
    if (data.balance_brought_forward !== undefined) { fields.push(`balance_brought_forward = $${i++}::numeric`); values.push(data.balance_brought_forward); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    fields.push(`updated_at = now()`);
    values.push(req.params.id);

    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE finance_accounts SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, active, locked, sort_order, balance_brought_forward::float`,
      values,
    );
    res.json(row);
  } catch (err) { next(err); }
});

// PATCH /finance/accounts/:id/config — configure pending and refund settings.
// Name is also editable here for unlocked accounts.
const PENDING_TYPES = ['Cheque', 'Cash', 'PayPal', 'Standing Order', 'Direct Debit',
                       'BACS', 'Debit card', 'Account transfer', 'Credit card'];

const configSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  pending_config: z.enum(['disabled', 'optional', 'by_type']),
  pending_types:  z.array(z.enum(PENDING_TYPES)).optional().default([]),
  enable_refunds: z.boolean(),
});

router.patch('/accounts/:id/config', requirePrivilege('finance_accounts', 'change'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, locked FROM finance_accounts WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Account not found.', 404);

    const data = configSchema.parse(req.body);

    // Name change blocked for locked accounts
    if (data.name !== undefined && current.locked) {
      throw AppError('This account is locked and cannot be renamed.', 400);
    }

    const fields = [];
    const values = [];
    let i = 1;
    if (data.name !== undefined && !current.locked) { fields.push(`name = $${i++}`); values.push(data.name); }
    fields.push(`pending_config = $${i++}`); values.push(data.pending_config);
    fields.push(`pending_types  = $${i++}`); values.push(data.pending_config === 'by_type' ? data.pending_types : []);
    fields.push(`enable_refunds = $${i++}`); values.push(data.enable_refunds);
    fields.push(`updated_at = now()`);
    values.push(req.params.id);

    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE finance_accounts SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, name, active, locked, sort_order, pending_config, pending_types, enable_refunds`,
      values,
    );
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/accounts/:id', requirePrivilege('finance_accounts', 'delete'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT locked FROM finance_accounts WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Account not found.', 404);
    if (current.locked) throw AppError('This account is locked and cannot be deleted.', 400);

    const [txnCheck] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id FROM transactions WHERE account_id = $1 LIMIT 1`,
      [req.params.id],
    );
    if (txnCheck) throw AppError('Cannot delete an account that has transactions. Make it inactive instead.', 400);

    await tenantQuery(req.user.tenantSlug, `DELETE FROM finance_accounts WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Account deleted.' });
  } catch (err) { next(err); }
});

// ─── FINANCE CATEGORIES ───────────────────────────────────────────────────

router.get('/categories', requirePrivilege('finance_categories', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, active, locked, sort_order, created_at
       FROM finance_categories ORDER BY sort_order, name`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

const categorySchema = z.object({
  name:       z.string().min(1).max(100),
  active:     z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

router.post('/categories', requirePrivilege('finance_categories', 'create'), async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO finance_categories (name, active, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, name, active, locked, sort_order`,
      [data.name, data.active ?? true, data.sort_order ?? 0],
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.patch('/categories/:id', requirePrivilege('finance_categories', 'change'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT locked FROM finance_categories WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Category not found.', 404);
    if (current.locked) throw AppError('This category is locked and cannot be changed.', 400);

    const data = categorySchema.partial().parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;
    if (data.name       !== undefined) { fields.push(`name = $${i++}`);       values.push(data.name); }
    if (data.active     !== undefined) { fields.push(`active = $${i++}`);     values.push(data.active); }
    if (data.sort_order !== undefined) { fields.push(`sort_order = $${i++}`); values.push(data.sort_order); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    fields.push(`updated_at = now()`);
    values.push(req.params.id);

    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE finance_categories SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, active, locked, sort_order`,
      values,
    );
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/categories/:id', requirePrivilege('finance_categories', 'delete'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT locked FROM finance_categories WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Category not found.', 404);
    if (current.locked) throw AppError('This category is locked and cannot be deleted.', 400);

    const [used] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT transaction_id FROM transaction_categories WHERE category_id = $1 LIMIT 1`,
      [req.params.id],
    );
    if (used) throw AppError('Cannot delete a category that has transactions. Make it inactive instead.', 400);

    await tenantQuery(req.user.tenantSlug, `DELETE FROM finance_categories WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Category deleted.' });
  } catch (err) { next(err); }
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────

// GET /finance/transactions?accountId=&categoryId=&groupId=&memberId=&year=
router.get('/transactions', requirePrivilege('finance_ledger', 'view'), async (req, res, next) => {
  try {
    const { accountId, categoryId, groupId, memberId, year } = req.query;
    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    const yearStart = `${yearNum}-01-01`;
    const yearEnd   = `${yearNum}-12-31`;

    let sql, params;

    if (memberId) {
      sql = `
        SELECT t.id, t.transaction_number, t.account_id, t.date, t.type,
               t.from_to, t.amount::float, t.payment_method, t.payment_ref,
               t.detail, t.remarks, t.cleared_at,
               t.member_id_1, t.member_id_2, t.group_id,
               m1.forenames || ' ' || m1.surname AS member_1_name,
               m2.forenames || ' ' || m2.surname AS member_2_name,
               g.name AS group_name,
               fa.name AS account_name,
               COALESCE(
                 json_agg(json_build_object('category_id', tc.category_id, 'name', fc.name, 'amount', tc.amount::float))
                   FILTER (WHERE tc.id IS NOT NULL), '[]'
               ) AS categories
        FROM transactions t
        LEFT JOIN members m1 ON m1.id = t.member_id_1
        LEFT JOIN members m2 ON m2.id = t.member_id_2
        LEFT JOIN groups g   ON g.id  = t.group_id
        LEFT JOIN finance_accounts fa ON fa.id = t.account_id
        LEFT JOIN transaction_categories tc ON tc.transaction_id = t.id
        LEFT JOIN finance_categories fc ON fc.id = tc.category_id
        WHERE (t.member_id_1 = $1 OR t.member_id_2 = $1)
        GROUP BY t.id, m1.forenames, m1.surname, m2.forenames, m2.surname, g.name, fa.name
        ORDER BY t.date, t.transaction_number`;
      params = [memberId];

    } else if (accountId) {
      sql = `
        SELECT t.id, t.transaction_number, t.account_id, t.date, t.type,
               t.from_to, t.amount::float, t.payment_method, t.payment_ref,
               t.detail, t.remarks, t.cleared_at,
               t.member_id_1, t.member_id_2, t.group_id,
               m1.forenames || ' ' || m1.surname AS member_1_name,
               m2.forenames || ' ' || m2.surname AS member_2_name,
               g.name AS group_name,
               COALESCE(
                 json_agg(json_build_object('category_id', tc.category_id, 'name', fc.name, 'amount', tc.amount::float))
                   FILTER (WHERE tc.id IS NOT NULL), '[]'
               ) AS categories
        FROM transactions t
        LEFT JOIN members m1 ON m1.id = t.member_id_1
        LEFT JOIN members m2 ON m2.id = t.member_id_2
        LEFT JOIN groups g   ON g.id  = t.group_id
        LEFT JOIN transaction_categories tc ON tc.transaction_id = t.id
        LEFT JOIN finance_categories fc ON fc.id = tc.category_id
        WHERE t.account_id = $1 AND t.date BETWEEN $2::date AND $3::date
        GROUP BY t.id, m1.forenames, m1.surname, m2.forenames, m2.surname, g.name
        ORDER BY t.date, t.transaction_number`;
      params = [accountId, yearStart, yearEnd];

    } else if (categoryId) {
      sql = `
        SELECT t.id, t.transaction_number, t.account_id, t.date, t.type,
               t.from_to, t.amount::float, t.payment_method, t.payment_ref,
               t.detail, t.remarks, t.cleared_at,
               t.member_id_1, t.member_id_2, t.group_id,
               m1.forenames || ' ' || m1.surname AS member_1_name,
               m2.forenames || ' ' || m2.surname AS member_2_name,
               g.name AS group_name,
               tc_this.amount::float AS category_amount,
               COALESCE(
                 json_agg(json_build_object('category_id', tc.category_id, 'name', fc.name, 'amount', tc.amount::float))
                   FILTER (WHERE tc.id IS NOT NULL), '[]'
               ) AS categories
        FROM transactions t
        JOIN transaction_categories tc_this ON tc_this.transaction_id = t.id AND tc_this.category_id = $1
        LEFT JOIN members m1 ON m1.id = t.member_id_1
        LEFT JOIN members m2 ON m2.id = t.member_id_2
        LEFT JOIN groups g   ON g.id  = t.group_id
        LEFT JOIN transaction_categories tc ON tc.transaction_id = t.id
        LEFT JOIN finance_categories fc ON fc.id = tc.category_id
        WHERE t.date BETWEEN $2::date AND $3::date
        GROUP BY t.id, m1.forenames, m1.surname, m2.forenames, m2.surname, g.name, tc_this.amount
        ORDER BY t.date, t.transaction_number`;
      params = [categoryId, yearStart, yearEnd];

    } else if (groupId) {
      sql = `
        SELECT t.id, t.transaction_number, t.account_id, t.date, t.type,
               t.from_to, t.amount::float, t.payment_method, t.payment_ref,
               t.detail, t.remarks, t.cleared_at,
               t.member_id_1, t.member_id_2, t.group_id,
               m1.forenames || ' ' || m1.surname AS member_1_name,
               m2.forenames || ' ' || m2.surname AS member_2_name,
               COALESCE(
                 json_agg(json_build_object('category_id', tc.category_id, 'name', fc.name, 'amount', tc.amount::float))
                   FILTER (WHERE tc.id IS NOT NULL), '[]'
               ) AS categories
        FROM transactions t
        LEFT JOIN members m1 ON m1.id = t.member_id_1
        LEFT JOIN members m2 ON m2.id = t.member_id_2
        LEFT JOIN transaction_categories tc ON tc.transaction_id = t.id
        LEFT JOIN finance_categories fc ON fc.id = tc.category_id
        WHERE ($1 = 'all' OR t.group_id = $1) AND t.date BETWEEN $2::date AND $3::date
        GROUP BY t.id, m1.forenames, m1.surname, m2.forenames, m2.surname
        ORDER BY t.date, t.transaction_number`;
      params = [groupId, yearStart, yearEnd];

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
         FROM transactions WHERE account_id = $1 AND date < $2::date`,
        [accountId, yearStart],
      );
      const openingBalance = bf + (priorNet?.net ?? 0);
      return res.json({ transactions: rows, openingBalance });
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
              t.detail, t.remarks, t.cleared_at,
              t.member_id_1, t.member_id_2, t.group_id,
              t.batch_id, cb.batch_ref,
              m1.forenames || ' ' || m1.surname AS member_1_name,
              m2.forenames || ' ' || m2.surname AS member_2_name,
              g.name AS group_name,
              fa.name AS account_name,
              COALESCE(
                json_agg(json_build_object('category_id', tc.category_id, 'name', fc.name, 'amount', tc.amount::float))
                  FILTER (WHERE tc.id IS NOT NULL), '[]'
              ) AS categories
       FROM transactions t
       LEFT JOIN members m1 ON m1.id = t.member_id_1
       LEFT JOIN members m2 ON m2.id = t.member_id_2
       LEFT JOIN groups g   ON g.id  = t.group_id
       LEFT JOIN finance_accounts fa ON fa.id = t.account_id
       LEFT JOIN credit_batches cb ON cb.id = t.batch_id
       LEFT JOIN transaction_categories tc ON tc.transaction_id = t.id
       LEFT JOIN finance_categories fc ON fc.id = tc.category_id
       WHERE t.id = $1
       GROUP BY t.id, m1.forenames, m1.surname, m2.forenames, m2.surname, g.name, fa.name, cb.batch_ref`,
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
  member_id_1:    z.string().optional().nullable(),
  member_id_2:    z.string().optional().nullable(),
  group_id:       z.string().optional().nullable(),
  categories:     z.array(txnCategorySchema).min(1),
});

router.post('/transactions', requirePrivilege('finance_transactions', 'create'), async (req, res, next) => {
  try {
    const data = createTxnSchema.parse(req.body);

    // Validate category amounts sum to transaction amount
    const catTotal = data.categories.reduce((s, c) => s + c.amount, 0);
    if (Math.abs(catTotal - data.amount) > 0.001) {
      throw AppError(`Category amounts (${catTotal.toFixed(2)}) must equal transaction amount (${data.amount.toFixed(2)}).`, 400);
    }

    const [txn] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO transactions
         (account_id, date, type, from_to, amount, payment_method, payment_ref, detail, remarks, member_id_1, member_id_2, group_id)
       VALUES ($1, $2::date, $3, $4, $5::numeric, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, transaction_number`,
      [
        data.account_id, data.date, data.type,
        data.from_to ?? null, data.amount,
        data.payment_method ?? null, data.payment_ref ?? null,
        data.detail ?? null, data.remarks ?? null,
        data.member_id_1 ?? null, data.member_id_2 ?? null, data.group_id ?? null,
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

// PATCH /finance/transactions/:id
const updateTxnSchema = createTxnSchema.partial().extend({
  categories: z.array(txnCategorySchema).min(1).optional(),
  batch_id:   z.string().nullable().optional(),
});

router.patch('/transactions/:id', requirePrivilege('finance_transactions', 'change'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, amount::float AS amount, cleared_at, transfer_id FROM transactions WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Transaction not found.', 404);
    if (current.transfer_id) throw AppError('This transaction is part of a transfer. Use the Transfer Money page to edit it.', 400);
    if (current.cleared_at) throw AppError('Cleared transactions cannot be changed.', 400);

    const data = updateTxnSchema.parse(req.body);

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
    if (data.batch_id       !== undefined) { fields.push(`batch_id = $${i++}`);       values.push(data.batch_id); }

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
      `SELECT cleared_at, transfer_id FROM transactions WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Transaction not found.', 404);
    if (current.transfer_id) throw AppError('This transaction is part of a transfer. Use the Transfer Money page to delete it.', 400);
    if (current.cleared_at) throw AppError('Cleared transactions cannot be deleted.', 400);

    await tenantQuery(req.user.tenantSlug, `DELETE FROM transactions WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Transaction deleted.' });
  } catch (err) { next(err); }
});

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
              t_out.group_id, g.name AS group_name,
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

// ─── RECONCILE ACCOUNT ────────────────────────────────────────────────────

// GET /finance/reconcile?accountId= — return cleared balance + uncleared transactions
router.get('/reconcile', requirePrivilege('finance_reconcile', 'view'), async (req, res, next) => {
  try {
    const { accountId } = req.query;
    if (!accountId) throw AppError('accountId is required.', 400);

    const [account] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, balance_brought_forward::float FROM finance_accounts WHERE id = $1`,
      [accountId],
    );
    if (!account) throw AppError('Account not found.', 404);

    const [bal] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE -amount END), 0)::float AS net
       FROM transactions WHERE account_id = $1 AND cleared_at IS NOT NULL`,
      [accountId],
    );
    const clearedBalance = account.balance_brought_forward + (bal?.net ?? 0);

    // Uncleared transactions NOT in a batch
    const unbatched = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, transaction_number, date, type, from_to,
              amount::float, payment_method, payment_ref, detail, transfer_id, batch_id,
              CASE WHEN transfer_id IS NOT NULL THEN true ELSE false END AS is_transfer,
              false AS is_batch
       FROM transactions
       WHERE account_id = $1 AND cleared_at IS NULL AND batch_id IS NULL
       ORDER BY date, transaction_number`,
      [accountId],
    );

    // Uncleared batches (all member transactions uncleared)
    const batches = await tenantQuery(
      req.user.tenantSlug,
      `SELECT cb.id, cb.batch_ref,
              COUNT(t.id)::int AS txn_count,
              SUM(t.amount)::float AS total_amount,
              MIN(t.date) AS earliest_date,
              MAX(t.date) AS latest_date
       FROM credit_batches cb
       JOIN transactions t ON t.batch_id = cb.id
       WHERE cb.account_id = $1 AND t.cleared_at IS NULL
       GROUP BY cb.id, cb.batch_ref
       HAVING COUNT(t.id) > 0
       ORDER BY MIN(t.date)`,
      [accountId],
    );

    // Build combined uncleared list: individual transactions + batch summary rows
    const batchRows = batches.map((b) => ({
      id: b.id,
      batch_ref: b.batch_ref,
      date: b.earliest_date,
      type: 'in',
      from_to: `Batch: ${b.batch_ref}`,
      amount: b.total_amount,
      txn_count: b.txn_count,
      is_batch: true,
      is_transfer: false,
    }));

    const uncleared = [...unbatched, ...batchRows].sort((a, b) => {
      const da = String(a.date || '').localeCompare(String(b.date || ''));
      return da !== 0 ? da : (a.transaction_number ?? 0) - (b.transaction_number ?? 0);
    });

    res.json({ account, clearedBalance, uncleared });
  } catch (err) { next(err); }
});

const reconcileSchema = z.object({
  accountId:      z.string().min(1),
  statementDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transactionIds: z.array(z.string()),
  batchIds:       z.array(z.string()).optional(),
});

// POST /finance/reconcile — mark selected transactions (and batches) as cleared
router.post('/reconcile', requirePrivilege('finance_reconcile', 'reconcile'), async (req, res, next) => {
  try {
    const data = reconcileSchema.parse(req.body);

    // Clear individual transactions
    if (data.transactionIds.length > 0) {
      await tenantQuery(
        req.user.tenantSlug,
        `UPDATE transactions SET cleared_at = $1::date, updated_at = now()
         WHERE id = ANY($2::text[]) AND account_id = $3 AND cleared_at IS NULL`,
        [data.statementDate, data.transactionIds, data.accountId],
      );
    }

    // Clear all transactions in selected batches
    if (data.batchIds?.length > 0) {
      await tenantQuery(
        req.user.tenantSlug,
        `UPDATE transactions SET cleared_at = $1::date, updated_at = now()
         WHERE batch_id = ANY($2::text[]) AND account_id = $3 AND cleared_at IS NULL`,
        [data.statementDate, data.batchIds, data.accountId],
      );
    }

    res.json({ message: 'Reconciliation saved.' });
  } catch (err) { next(err); }
});

// ─── FINANCIAL STATEMENT ──────────────────────────────────────────────────

/** Compute financial year start and end date strings for a given named year. */
function computeYearBounds(yearNum, startMonth, startDay) {
  const m = String(startMonth).padStart(2, '0');
  const d = String(startDay).padStart(2, '0');
  const yearStart = `${yearNum}-${m}-${d}`;
  // End = one day before next year's start
  const next = new Date(Date.UTC(yearNum + 1, startMonth - 1, startDay));
  next.setUTCDate(next.getUTCDate() - 1);
  const yearEnd = next.toISOString().slice(0, 10);
  return { yearStart, yearEnd };
}

/** Fetch all data needed for the financial statement. */
async function getStatementData(tenantSlug, accountId, yearNum) {
  const [settings] = await tenantQuery(
    tenantSlug,
    `SELECT year_start_month, year_start_day FROM tenant_settings WHERE id = 'singleton'`,
  );
  const { yearStart, yearEnd } = computeYearBounds(
    yearNum, settings.year_start_month, settings.year_start_day,
  );

  const isAll = accountId === 'all';
  const accounts = isAll
    ? await tenantQuery(tenantSlug, `SELECT id, name, balance_brought_forward::float FROM finance_accounts WHERE active = true ORDER BY sort_order, name`)
    : await tenantQuery(tenantSlug, `SELECT id, name, balance_brought_forward::float FROM finance_accounts WHERE id = $1`, [accountId]);

  if (!isAll && accounts.length === 0) throw AppError('Account not found.', 404);

  const accountIds = accounts.map((a) => a.id);
  const totalBF    = accounts.reduce((s, a) => s + a.balance_brought_forward, 0);

  // Opening balance = BF + net of all transactions before year start
  const [priorNet] = await tenantQuery(
    tenantSlug,
    `SELECT COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE -amount END), 0)::float AS net
     FROM transactions WHERE account_id = ANY($1::text[]) AND date < $2::date`,
    [accountIds, yearStart],
  );
  const openingBalance = totalBF + (priorNet?.net ?? 0);

  // Category breakdown for this year
  const categoryRows = await tenantQuery(
    tenantSlug,
    `SELECT fc.name AS category, t.type, SUM(tc.amount)::float AS total
     FROM transaction_categories tc
     JOIN transactions t ON t.id = tc.transaction_id
     JOIN finance_categories fc ON fc.id = tc.category_id
     WHERE t.account_id = ANY($1::text[]) AND t.date BETWEEN $2::date AND $3::date
     GROUP BY fc.name, t.type
     ORDER BY fc.name, t.type`,
    [accountIds, yearStart, yearEnd],
  );

  // Year totals (all transactions, including uncategorized transfers)
  const [yearTotals] = await tenantQuery(
    tenantSlug,
    `SELECT COALESCE(SUM(CASE WHEN type='in'  THEN amount ELSE 0 END), 0)::float AS total_in,
            COALESCE(SUM(CASE WHEN type='out' THEN amount ELSE 0 END), 0)::float AS total_out
     FROM transactions WHERE account_id = ANY($1::text[]) AND date BETWEEN $2::date AND $3::date`,
    [accountIds, yearStart, yearEnd],
  );

  const totalIn       = yearTotals?.total_in  ?? 0;
  const totalOut      = yearTotals?.total_out ?? 0;
  const closingBalance = openingBalance + totalIn - totalOut;

  const accountLabel = isAll ? 'All Accounts' : accounts[0]?.name ?? '';

  return { yearNum, yearStart, yearEnd, accountLabel, openingBalance, totalIn, totalOut, closingBalance, categoryRows };
}

// GET /finance/statement?accountId=&year= — JSON data for on-screen display
router.get('/statement', requirePrivilege('finance_statement', 'view'), async (req, res, next) => {
  try {
    const { accountId, year } = req.query;
    if (!accountId) throw AppError('accountId is required.', 400);
    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    const data = await getStatementData(req.user.tenantSlug, accountId, yearNum);
    res.json(data);
  } catch (err) { next(err); }
});

// GET /finance/statement/download?accountId=&year=&format=xlsx — download Excel
router.get('/statement/download', requirePrivilege('finance_statement', 'download'), async (req, res, next) => {
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
    `SELECT g.id, g.name, g.status,
            COALESCE(SUM(e.money_in),  0)::float AS total_in,
            COALESCE(SUM(e.money_out), 0)::float AS total_out,
            COALESCE(SUM(e.money_in), 0)::float - COALESCE(SUM(e.money_out), 0)::float AS balance
     FROM groups g
     LEFT JOIN group_ledger_entries e ON e.group_id = g.id
       AND e.entry_date BETWEEN $1::date AND $2::date
     GROUP BY g.id, g.name, g.status
     ORDER BY g.name`,
    [from, to],
  );
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
router.get('/groups-statement', requirePrivilege('group_statement', 'view'), async (req, res, next) => {
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
router.get('/groups-statement/download', requirePrivilege('group_statement', 'download'), async (req, res, next) => {
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
    ws.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 15 }];

    ws.addRow([`Groups Statement — ${from} to ${to}`]).font = { bold: true, size: 13 };
    ws.addRow([]);

    const hdr = ws.addRow(['Group', 'Status', 'In (£)', 'Out (£)', 'Balance (£)']);
    hdr.font = { bold: true };

    for (const g of groups) {
      const gRow = ws.addRow([g.name, g.status, Number(g.total_in).toFixed(2), Number(g.total_out).toFixed(2), Number(g.balance).toFixed(2)]);
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
    const totIn  = groups.reduce((s, g) => s + g.total_in,  0);
    const totOut = groups.reduce((s, g) => s + g.total_out, 0);
    const totRow = ws.addRow(['TOTAL', '', Number(totIn).toFixed(2), Number(totOut).toFixed(2), Number(totIn - totOut).toFixed(2)]);
    totRow.font = { bold: true };

    const tenantPart = req.user.tenantSlug.replace(/^u3a_/, '');
    const filename   = `${tenantPart}_groups_statement_${from}_to_${to}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// ─── CREDIT BATCHES (doc 7.4) ─────────────────────────────────────────────

// GET /finance/batches?accountId=&mode=uncleared|since&date=
router.get('/batches', requirePrivilege('finance_batches', 'view'), async (req, res, next) => {
  try {
    const { accountId, mode, date } = req.query;
    if (!accountId) throw AppError('accountId is required.', 400);

    let whereClause;
    let params;

    if (mode === 'since' && date) {
      // All batches created since a given date
      whereClause = `cb.account_id = $1 AND cb.created_at >= $2::date`;
      params = [accountId, date];
    } else {
      // Default: uncleared batches (at least one uncleared transaction)
      whereClause = `cb.account_id = $1
        AND EXISTS (SELECT 1 FROM transactions t WHERE t.batch_id = cb.id AND t.cleared_at IS NULL)`;
      params = [accountId];
    }

    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT cb.id, cb.batch_ref, cb.account_id, cb.created_at,
              COUNT(t.id)::int AS txn_count,
              COALESCE(SUM(t.amount), 0)::float AS total_amount,
              COUNT(t.id) FILTER (WHERE t.cleared_at IS NOT NULL)::int AS cleared_count,
              MIN(t.date) AS earliest_date,
              MAX(t.date) AS latest_date
       FROM credit_batches cb
       LEFT JOIN transactions t ON t.batch_id = cb.id
       WHERE ${whereClause}
       GROUP BY cb.id, cb.batch_ref, cb.account_id, cb.created_at
       ORDER BY cb.created_at DESC`,
      params,
    );

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /finance/batches/unbatched?accountId= — uncleared 'in' transactions not in any batch
// (must be before /:id to avoid "unbatched" being matched as an id)
router.get('/batches/unbatched', requirePrivilege('finance_batches', 'view'), async (req, res, next) => {
  try {
    const { accountId } = req.query;
    if (!accountId) throw AppError('accountId is required.', 400);

    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT t.id, t.transaction_number, t.date, t.type, t.from_to,
              t.amount::float, t.payment_method, t.payment_ref, t.detail,
              t.transfer_id,
              CASE WHEN t.transfer_id IS NOT NULL THEN true ELSE false END AS is_transfer
       FROM transactions t
       WHERE t.account_id = $1
         AND t.type = 'in'
         AND t.cleared_at IS NULL
         AND t.batch_id IS NULL
       ORDER BY t.date, t.transaction_number`,
      [accountId],
    );

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /finance/batches/:id — batch detail with member transactions
router.get('/batches/:id', requirePrivilege('finance_batches', 'view'), async (req, res, next) => {
  try {
    const [batch] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, batch_ref, account_id, created_at FROM credit_batches WHERE id = $1`,
      [req.params.id],
    );
    if (!batch) throw AppError('Batch not found.', 404);

    const transactions = await tenantQuery(
      req.user.tenantSlug,
      `SELECT t.id, t.transaction_number, t.date, t.type, t.from_to,
              t.amount::float, t.payment_method, t.payment_ref, t.detail,
              t.cleared_at, t.transfer_id,
              CASE WHEN t.transfer_id IS NOT NULL THEN true ELSE false END AS is_transfer
       FROM transactions t
       WHERE t.batch_id = $1
       ORDER BY t.date, t.transaction_number`,
      [req.params.id],
    );

    res.json({ ...batch, transactions });
  } catch (err) { next(err); }
});

// POST /finance/batches — create a new batch with selected transactions
const createBatchSchema = z.object({
  account_id:     z.string().min(1),
  batch_ref:      z.string().min(1).max(100),
  transactionIds: z.array(z.string().min(1)).min(1),
});

router.post('/batches', requirePrivilege('finance_batches', 'create'), async (req, res, next) => {
  try {
    const data = createBatchSchema.parse(req.body);

    // Ensure batch_ref is unique per account
    const [existing] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id FROM credit_batches WHERE account_id = $1 AND batch_ref = $2`,
      [data.account_id, data.batch_ref],
    );
    if (existing) throw AppError('A batch with that reference already exists for this account.', 409);

    const [batch] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO credit_batches (batch_ref, account_id) VALUES ($1, $2) RETURNING id, batch_ref, account_id, created_at`,
      [data.batch_ref, data.account_id],
    );

    // Assign transactions to the batch
    await tenantQuery(
      req.user.tenantSlug,
      `UPDATE transactions SET batch_id = $1, updated_at = now()
       WHERE id = ANY($2::text[]) AND account_id = $3 AND cleared_at IS NULL AND batch_id IS NULL`,
      [batch.id, data.transactionIds, data.account_id],
    );

    logAudit(req.user.tenantSlug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'create', entityType: 'credit_batch', entityId: batch.id,
      detail: JSON.stringify({ batch_ref: data.batch_ref, txnCount: data.transactionIds.length }),
    });

    res.status(201).json(batch);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(422).json({ error: 'Validation failed.', issues: err.issues });
    next(err);
  }
});

// POST /finance/batches/:id/transactions — add transactions to an existing batch
const addToBatchSchema = z.object({
  transactionIds: z.array(z.string().min(1)).min(1),
});

router.post('/batches/:id/transactions', requirePrivilege('finance_batches', 'create'), async (req, res, next) => {
  try {
    const data = addToBatchSchema.parse(req.body);
    const [batch] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, account_id FROM credit_batches WHERE id = $1`,
      [req.params.id],
    );
    if (!batch) throw AppError('Batch not found.', 404);

    const result = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE transactions SET batch_id = $1, updated_at = now()
       WHERE id = ANY($2::text[]) AND account_id = $3 AND cleared_at IS NULL AND batch_id IS NULL
       RETURNING id`,
      [batch.id, data.transactionIds, batch.account_id],
    );

    res.json({ added: result.length });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(422).json({ error: 'Validation failed.', issues: err.issues });
    next(err);
  }
});

// DELETE /finance/batches/:id/transactions — remove transactions from a batch
const removeTxnsSchema = z.object({
  transactionIds: z.array(z.string().min(1)).min(1),
});

router.delete('/batches/:id/transactions', requirePrivilege('finance_batches', 'create'), async (req, res, next) => {
  try {
    const data = removeTxnsSchema.parse(req.body);
    const result = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE transactions SET batch_id = NULL, updated_at = now()
       WHERE id = ANY($1::text[]) AND batch_id = $2
       RETURNING id`,
      [data.transactionIds, req.params.id],
    );
    res.json({ removed: result.length });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(422).json({ error: 'Validation failed.', issues: err.issues });
    next(err);
  }
});

// DELETE /finance/batches/:id — delete an empty uncleared batch
router.delete('/batches/:id', requirePrivilege('finance_batches', 'delete'), async (req, res, next) => {
  try {
    const [batch] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT cb.id,
              COUNT(t.id)::int AS txn_count,
              COUNT(t.id) FILTER (WHERE t.cleared_at IS NOT NULL)::int AS cleared_count
       FROM credit_batches cb
       LEFT JOIN transactions t ON t.batch_id = cb.id
       WHERE cb.id = $1
       GROUP BY cb.id`,
      [req.params.id],
    );
    if (!batch) throw AppError('Batch not found.', 404);
    if (batch.txn_count > 0) throw AppError('Cannot delete a batch that still contains transactions. Remove all transactions first.', 400);

    await tenantQuery(
      req.user.tenantSlug,
      `DELETE FROM credit_batches WHERE id = $1`,
      [req.params.id],
    );

    logAudit(req.user.tenantSlug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'delete', entityType: 'credit_batch', entityId: req.params.id,
    });

    res.json({ message: 'Batch deleted.' });
  } catch (err) { next(err); }
});

export default router;
