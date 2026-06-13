// beacon2/backend/src/routes/members/index.js
// Parent router for member routes. Mounts the listing, lifecycle, and CRUD
// sub-routers. Order matters: the literal-path routers (list, lifecycle) are
// mounted before the CRUD router so their paths are matched ahead of `/:id`.

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import listRouter from './list.js';
import lifecycleRouter from './lifecycle.js';
import crudRouter from './crud.js';

const router = Router();
router.use(requireAuth);
router.use('/', listRouter);
router.use('/', lifecycleRouter);
router.use('/', crudRouter);

export default router;
