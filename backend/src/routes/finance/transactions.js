// beacon2/backend/src/routes/finance/transactions.js
// Thin controllers for transaction list, single, create, bulk-pending, update,
// delete, and refund. Input is validated here (Zod) at the route boundary; the
// business logic and data access live in services/transactionService.js.

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import {
  listTransactions,
  getTransaction,
  createTransaction,
  bulkSetPending,
  updateTransaction,
  deleteTransaction,
  refundTransaction,
} from '../../services/transactionService.js';

const router = Router();

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────

// GET /finance/transactions?accountId=&categoryId=&groupId=&memberId=&eventId=&year=
router.get('/transactions', requirePrivilege('finance_ledger', 'view'), async (req, res, next) => {
  try {
    const result = await listTransactions(req.user.tenantSlug, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /finance/transactions/:id
router.get(
  '/transactions/:id',
  requirePrivilege('finance_transactions', 'view'),
  async (req, res, next) => {
    try {
      const txn = await getTransaction(req.user.tenantSlug, req.params.id);
      res.json(txn);
    } catch (err) {
      next(err);
    }
  },
);

// POST /finance/transactions
const txnCategorySchema = z.object({
  category_id: z.string().min(1),
  amount: z.number().positive(),
});

const createTxnSchema = z.object({
  account_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['in', 'out']),
  from_to: z.string().optional().nullable(),
  amount: z.number().positive(),
  payment_method: z.string().optional().nullable(),
  payment_ref: z.string().optional().nullable(),
  detail: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  member_id_1: z.string().optional().nullable(),
  member_id_2: z.string().optional().nullable(),
  group_id: z.string().optional().nullable(),
  event_id: z.string().optional().nullable(),
  pending: z.boolean().optional(),
  gift_aid_amount: z.number().min(0).optional().nullable(),
  gift_aid_amount_2: z.number().min(0).optional().nullable(),
  categories: z.array(txnCategorySchema).min(1),
});

router.post(
  '/transactions',
  requirePrivilege('finance_transactions', 'create'),
  async (req, res, next) => {
    try {
      const data = createTxnSchema.parse(req.body);
      const result = await createTransaction(req.user.tenantSlug, data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── BULK PENDING ────────────────────────────────────────────────────────
// Must be defined BEFORE /transactions/:id to avoid Express matching 'bulk-pending' as :id.

const bulkPendingSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  pending: z.boolean(),
});

router.patch(
  '/transactions/bulk-pending',
  requirePrivilege('finance_transactions', 'change'),
  async (req, res, next) => {
    try {
      const { ids, pending } = bulkPendingSchema.parse(req.body);
      const result = await bulkSetPending(req.user.tenantSlug, ids, pending);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /finance/transactions/:id
const updateTxnSchema = createTxnSchema.partial().extend({
  categories: z.array(txnCategorySchema).min(1).optional(),
  batch_id: z.string().nullable().optional(),
  pending: z.boolean().optional(),
});

router.patch(
  '/transactions/:id',
  requirePrivilege('finance_transactions', 'change'),
  async (req, res, next) => {
    try {
      const data = updateTxnSchema.parse(req.body);
      const result = await updateTransaction(req.user.tenantSlug, req.params.id, data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /finance/transactions/:id
router.delete(
  '/transactions/:id',
  requirePrivilege('finance_transactions', 'delete'),
  async (req, res, next) => {
    try {
      const result = await deleteTransaction(req.user.tenantSlug, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── REFUNDS (doc 7.10.7) ─────────────────────────────────────────────────

const refundSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.string().optional().nullable(),
  payment_ref: z.string().optional().nullable(),
  detail: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  categories: z
    .array(
      z.object({
        category_id: z.string().min(1),
        amount: z.number().min(0),
      }),
    )
    .min(1),
});

router.post(
  '/transactions/:id/refund',
  requirePrivilege('finance_transactions', 'create'),
  async (req, res, next) => {
    try {
      const data = refundSchema.parse(req.body);
      const result = await refundTransaction(req.user.tenantSlug, req.params.id, data, {
        userId: req.user.userId,
        name: req.user.name,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
