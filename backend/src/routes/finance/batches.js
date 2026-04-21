// beacon2/backend/src/routes/finance/batches.js
// Credit batch CRUD and transaction management.

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../utils/audit.js';

const router = Router();
router.use(requireFeature('creditBatches'));

// ─── CREDIT BATCHES (doc 7.4) ─────────────────────────────────────────────

// GET /finance/batches?accountId=&mode=uncleared|since&date=
router.get('/batches', requirePrivilege('finance_batches', 'view'), async (req, res, next) => {
  try {
    const { accountId, mode, date } = req.query;
    if (!accountId) throw AppError('accountId is required.', 400);

    let whereClause;
    let params;

    if (mode === 'since' && date) {
      // All batches with batch_date since a given date
      whereClause = `cb.account_id = $1 AND COALESCE(cb.batch_date, cb.created_at::date) >= $2::date`;
      params = [accountId, date];
    } else {
      // Default: uncleared batches (at least one uncleared transaction)
      whereClause = `cb.account_id = $1
        AND EXISTS (SELECT 1 FROM transactions t WHERE t.batch_id = cb.id AND t.cleared_at IS NULL)`;
      params = [accountId];
    }

    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT cb.id, cb.batch_ref, cb.description, cb.account_id, cb.created_at,
              COALESCE(cb.batch_date, cb.created_at::date) AS batch_date,
              COUNT(t.id)::int AS txn_count,
              COALESCE(SUM(t.amount), 0)::float AS total_amount,
              COUNT(t.id) FILTER (WHERE t.cleared_at IS NOT NULL)::int AS cleared_count,
              MIN(t.date) AS earliest_date,
              MAX(t.date) AS latest_date
       FROM credit_batches cb
       LEFT JOIN transactions t ON t.batch_id = cb.id
       WHERE ${whereClause}
       GROUP BY cb.id, cb.batch_ref, cb.description, cb.account_id, cb.created_at, cb.batch_date
       ORDER BY COALESCE(cb.batch_date, cb.created_at::date) DESC`,
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
      `SELECT cb.id, cb.batch_ref, cb.description, cb.account_id, cb.created_at,
              COALESCE(cb.batch_date, cb.created_at::date) AS batch_date,
              (SELECT COUNT(*)::int FROM credit_batches cb2
               WHERE cb2.account_id = cb.account_id
                 AND COALESCE(cb2.batch_date, cb2.created_at::date) <= COALESCE(cb.batch_date, cb.created_at::date)
                 AND (COALESCE(cb2.batch_date, cb2.created_at::date) < COALESCE(cb.batch_date, cb.created_at::date)
                      OR cb2.id <= cb.id)) AS batch_number
       FROM credit_batches cb WHERE cb.id = $1`,
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
  description:    z.string().nullable().optional(),
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
      `INSERT INTO credit_batches (batch_ref, description, account_id, batch_date) VALUES ($1, $2, $3, CURRENT_DATE)
       RETURNING id, batch_ref, description, account_id, created_at, batch_date`,
      [data.batch_ref, data.description ?? null, data.account_id],
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

// PATCH /finance/batches/:id — update batch ref, description, and/or date
const updateBatchSchema = z.object({
  batch_ref:   z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  batch_date:  z.string().optional(),
});

router.patch('/batches/:id', requirePrivilege('finance_batches', 'create'), async (req, res, next) => {
  try {
    const data = updateBatchSchema.parse(req.body);

    const sets = [];
    const params = [];
    let idx = 1;

    if (data.batch_ref !== undefined) { sets.push(`batch_ref = $${idx++}`); params.push(data.batch_ref); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description ?? null); }
    if (data.batch_date !== undefined) { sets.push(`batch_date = $${idx++}::date`); params.push(data.batch_date); }

    if (sets.length === 0) throw AppError('No fields to update.', 400);

    // If batch_ref changed, check uniqueness before updating
    if (data.batch_ref !== undefined) {
      const [current] = await tenantQuery(
        req.user.tenantSlug,
        `SELECT account_id FROM credit_batches WHERE id = $1`,
        [req.params.id],
      );
      if (!current) throw AppError('Batch not found.', 404);
      const [dup] = await tenantQuery(
        req.user.tenantSlug,
        `SELECT id FROM credit_batches WHERE account_id = $1 AND batch_ref = $2 AND id != $3`,
        [current.account_id, data.batch_ref, req.params.id],
      );
      if (dup) throw AppError('A batch with that reference already exists for this account.', 409);
    }

    params.push(req.params.id);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE credit_batches SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, batch_ref, description, account_id, created_at, batch_date`,
      params,
    );
    if (!row) throw AppError('Batch not found.', 404);

    res.json(row);
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
