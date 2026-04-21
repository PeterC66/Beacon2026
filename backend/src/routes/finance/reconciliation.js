// beacon2/backend/src/routes/finance/reconciliation.js
// Account reconciliation.

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();
router.use(requireFeature('reconciliation'));

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

export default router;
