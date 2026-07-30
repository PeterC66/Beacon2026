// beacon2026/backend/src/routes/backup/index.js
// Parent router for data export/backup. Mounts the export sub-router and
// re-exports the restore helpers used by system.js and the test suite.

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import exportRouter from './export.js';

const router = Router();
router.use(requireAuth);
router.use('/', exportRouter);

export {
  clearTenantData,
  resetSequences,
  restorebeacon2026,
  restoreBeacon,
  BEACON_DEFAULT_PASSWORD,
} from './restore.js';

export default router;
