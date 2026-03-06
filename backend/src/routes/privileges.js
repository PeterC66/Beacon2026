// beacon2/backend/src/routes/privileges.js
// Returns the list of all available privilege resources (for building the role editor UI)

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';

const router = Router();
router.use(requireAuth);

router.get('/resources', requirePrivilege('role_record', 'view'), async (req, res, next) => {
  try {
    const resources = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, code, label, actions FROM privilege_resources ORDER BY label`,
    );
    res.json(resources);
  } catch (err) {
    next(err);
  }
});

export default router;
