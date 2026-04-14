// beacon2/backend/src/routes/finance/accounts.js
// Finance accounts, group B/F setting, and payment method defaults.

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../utils/audit.js';
import { FINANCE_PAYMENT_METHODS } from '../../../../shared/constants.js';

const router = Router();

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
const configSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  pending_config: z.enum(['disabled', 'optional', 'by_type']),
  pending_types:  z.array(z.enum(FINANCE_PAYMENT_METHODS)).optional().default([]),
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

// ─── GROUP B/F SETTING ────────────────────────────────────────────────────

router.get('/group-bf-setting', requirePrivilege('finance_accounts', 'view'), async (req, res, next) => {
  try {
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT group_bf_enabled FROM tenant_settings WHERE id = 'singleton'`,
    );
    res.json({ groupBfEnabled: row?.group_bf_enabled ?? false });
  } catch (err) { next(err); }
});

router.patch('/group-bf-setting', requirePrivilege('finance_accounts', 'change'), async (req, res, next) => {
  try {
    const body = z.object({ groupBfEnabled: z.boolean() }).parse(req.body);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE tenant_settings SET group_bf_enabled = $1, updated_at = now()
       WHERE id = 'singleton' RETURNING group_bf_enabled`,
      [body.groupBfEnabled],
    );
    logAudit(req.user.tenantSlug, { userId: req.user.userId, userName: req.user.name, action: 'update', entityType: 'setting', entityId: 'singleton', entityName: 'Group B/F enabled' });
    res.json({ groupBfEnabled: row.group_bf_enabled });
  } catch (err) { next(err); }
});

// ─── PAYMENT METHOD DEFAULTS (doc 8.6c) ──────────────────────────────────


// GET /finance/payment-method-defaults — returns default method + per-type account mappings.
router.get('/payment-method-defaults', requirePrivilege('finance_accounts', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const rows = await tenantQuery(slug, `SELECT payment_method, account_id FROM payment_method_defaults`);
    const defaultMethodRow = rows.find((r) => r.payment_method === '_default_method');
    const mappings = {};
    for (const r of rows) {
      if (r.payment_method !== '_default_method') mappings[r.payment_method] = r.account_id;
    }
    res.json({ defaultMethod: defaultMethodRow?.account_id || '', mappings });
  } catch (err) { next(err); }
});

// PUT /finance/payment-method-defaults — save default method + per-type account mappings.
const paymentMethodDefaultsSchema = z.object({
  defaultMethod: z.string(),
  mappings: z.record(z.string(), z.string()),  // { paymentMethod: accountId }
});

router.put('/payment-method-defaults', requirePrivilege('finance_accounts', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = paymentMethodDefaultsSchema.parse(req.body);

    // Validate that referenced accounts exist
    if (data.defaultMethod && !FINANCE_PAYMENT_METHODS.includes(data.defaultMethod)) {
      throw new AppError(`Invalid default payment method: ${data.defaultMethod}`, 400);
    }
    const accountIds = Object.values(data.mappings).filter(Boolean);
    if (accountIds.length > 0) {
      const accs = await tenantQuery(slug, `SELECT id FROM finance_accounts WHERE id = ANY($1::text[])`, [accountIds]);
      const validIds = new Set(accs.map((a) => a.id));
      for (const aid of accountIds) {
        if (!validIds.has(aid)) throw new AppError(`Account not found: ${aid}`, 400);
      }
    }

    // Upsert default method
    await tenantQuery(slug,
      `INSERT INTO payment_method_defaults (payment_method, account_id, updated_at)
       VALUES ('_default_method', $1, now())
       ON CONFLICT (payment_method) DO UPDATE SET account_id = $1, updated_at = now()`,
      [data.defaultMethod || null]);

    // Upsert each payment type mapping
    for (const pm of FINANCE_PAYMENT_METHODS) {
      const accId = data.mappings[pm] || null;
      await tenantQuery(slug,
        `INSERT INTO payment_method_defaults (payment_method, account_id, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (payment_method) DO UPDATE SET account_id = $2, updated_at = now()`,
        [pm, accId]);
    }

    logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'update',
      entityType: 'setting', entityId: 'payment_method_defaults', entityName: 'Payment method defaults' });

    res.json({ defaultMethod: data.defaultMethod, mappings: data.mappings });
  } catch (err) { next(err); }
});

export default router;
