// beacon2/backend/src/routes/finance/index.js
// Parent router that mounts all finance sub-route files.

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import accountsRouter from './accounts.js';
import categoriesRouter from './categories.js';
import transactionsRouter from './transactions.js';
import transfersRouter from './transfers.js';
import reconciliationRouter from './reconciliation.js';
import statementsRouter from './statements.js';
import batchesRouter from './batches.js';

const router = Router();
router.use(requireAuth);
router.use('/', accountsRouter);
router.use('/', categoriesRouter);
router.use('/', transactionsRouter);
router.use('/', transfersRouter);
router.use('/', reconciliationRouter);
router.use('/', statementsRouter);
router.use('/', batchesRouter);

export default router;
