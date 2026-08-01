// beacon2026/backend/src/routes/public/index.js
// Public (unauthenticated) routes for online joining and the Members Portal.
// All routes are tenant-scoped via the :slug path parameter.
//
// This parent router owns the tenant-resolution middleware, then mounts the
// concern-specific sub-routers (joining/payment, portal auth, public info
// pages) and the authenticated portal app router.

import { Router } from 'express';
import { resolveTenant } from '../../utils/resolveTenant.js';
import joinRouter from './join.js';
import portalAuthRouter from './portalAuth.js';
import readRouter from './read.js';
import portalRoutes from '../portal/index.js';

const router = Router();

// ─── Middleware: resolve tenant from slug ────────────────────────────────
// Shared with /api/v1 via utils/resolveTenant.js — see the note there about
// keeping the slug guard identical to utils/db.js.

router.use('/:slug', resolveTenant);

// Online joining / payment flow and public information pages.
router.use('/', joinRouter);
router.use('/', portalAuthRouter);
router.use('/', readRouter);

// ─── Members Portal authenticated routes (10.2.2–10.2.5) ─────────────────

router.use('/:slug/portal/app', portalRoutes);

export default router;
