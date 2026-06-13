// beacon2/backend/src/routes/public/index.js
// Public (unauthenticated) routes for online joining and the Members Portal.
// All routes are tenant-scoped via the :slug path parameter.
//
// This parent router owns the tenant-resolution middleware, then mounts the
// concern-specific sub-routers (joining/payment, portal auth, public info
// pages) and the authenticated portal app router.

import { Router } from 'express';
import { prisma } from '../../utils/db.js';
import joinRouter from './join.js';
import portalAuthRouter from './portalAuth.js';
import readRouter from './read.js';
import portalRoutes from '../portal/index.js';

const router = Router();

// ─── Middleware: resolve tenant from slug ────────────────────────────────

async function resolveTenant(req, res, next) {
  const { slug } = req.params;
  // Keep this identical to the guard in utils/db.js so a slug that the edge
  // accepts can never 500 inside tenantQuery (schema names cannot contain `-`).
  if (!slug || !/^[a-z0-9_]+$/.test(slug)) {
    return res.status(400).json({ error: 'Invalid tenant slug.' });
  }
  try {
    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    if (!tenant || !tenant.active) {
      return res.status(404).json({ error: 'Organisation not found.' });
    }
    req.tenant = tenant;
    req.tenantSlug = slug;
    next();
  } catch (err) {
    next(err);
  }
}

router.use('/:slug', resolveTenant);

// Online joining / payment flow and public information pages.
router.use('/', joinRouter);
router.use('/', portalAuthRouter);
router.use('/', readRouter);

// ─── Members Portal authenticated routes (10.2.2–10.2.5) ─────────────────

router.use('/:slug/portal/app', portalRoutes);

export default router;
