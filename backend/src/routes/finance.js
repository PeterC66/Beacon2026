// beacon2/backend/src/routes/finance.js
// Finance accounts, categories, and transactions.

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// ─── FINANCE ACCOUNTS ─────────────────────────────────────────────────────

router.get('/accounts', requirePrivilege('finance_accounts', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, active, locked, sort_order, created_at
       FROM finance_accounts ORDER BY sort_order, name`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

const accountSchema = z.object({
  name:       z.string().min(1).max(100),
  active:     z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

router.post('/accounts', requirePrivilege('finance_accounts', 'create'), async (req, res, next) => {
  try {
    const data = accountSchema.parse(req.body);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO finance_accounts (name, active, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, name, active, locked, sort_order`,
      [data.name, data.active ?? true, data.sort_order ?? 0],
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
    if (current.locked) throw AppError('This account is locked and cannot be changed.', 400);

    const data = accountSchema.partial().parse(req.body);
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
      `UPDATE finance_accounts SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, active, locked, sort_order`,
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

// GET /finance/transactions?accountId=&categoryId=&groupId=&year=
router.get('/transactions', requirePrivilege('finance_ledger', 'view'), async (req, res, next) => {
  try {
    const { accountId, categoryId, groupId, year } = req.query;
    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    const yearStart = `${yearNum}-01-01`;
    const yearEnd   = `${yearNum}-12-31`;

    let sql, params;

    if (accountId) {
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
        WHERE t.account_id = $1 AND t.date BETWEEN $2 AND $3
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
        WHERE t.date BETWEEN $2 AND $3
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
        WHERE ($1 = 'all' OR t.group_id = $1) AND t.date BETWEEN $2 AND $3
        GROUP BY t.id, m1.forenames, m1.surname, m2.forenames, m2.surname
        ORDER BY t.date, t.transaction_number`;
      params = [groupId, yearStart, yearEnd];

    } else {
      return res.json([]);
    }

    const rows = await tenantQuery(req.user.tenantSlug, sql, params);
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
       WHERE t.id = $1
       GROUP BY t.id, m1.forenames, m1.surname, m2.forenames, m2.surname, g.name, fa.name`,
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
});

router.patch('/transactions/:id', requirePrivilege('finance_transactions', 'change'), async (req, res, next) => {
  try {
    const [current] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, amount::float AS amount, cleared_at FROM transactions WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Transaction not found.', 404);
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
      `SELECT cleared_at FROM transactions WHERE id = $1`,
      [req.params.id],
    );
    if (!current) throw AppError('Transaction not found.', 404);
    if (current.cleared_at) throw AppError('Cleared transactions cannot be deleted.', 400);

    await tenantQuery(req.user.tenantSlug, `DELETE FROM transactions WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Transaction deleted.' });
  } catch (err) { next(err); }
});

export default router;
