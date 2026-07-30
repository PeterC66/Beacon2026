// beacon2026/backend/src/routes/groups/index.js
// Parent router for group routes. Owns the shared middleware (requireAuth +
// the `groups` feature gate), then mounts the concern-specific sub-routers.
// Order matters: the list router owns the literal `/download` path, so it is
// mounted before the CRUD router whose `/:id` would otherwise shadow it.

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import listRouter from './list.js';
import crudRouter from './crud.js';
import membersRouter from './members.js';
import eventsRouter from './events.js';
import ledgerRouter from './ledger.js';

const router = Router();
router.use(requireAuth);
router.use(requireFeature('groups'));

router.use('/', listRouter);
router.use('/', crudRouter);
router.use('/', membersRouter);
router.use('/', eventsRouter);
router.use('/', ledgerRouter);

export default router;
