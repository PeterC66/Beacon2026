// beacon2026/backend/src/routes/portal/index.js
// Authenticated Members Portal routes (docs 10.2.1–10.2.5).
// All routes require a valid portal JWT (isPortal: true) and the portal feature
// toggle. Mounted at /public/:slug/portal/app/* via the public router.
//
// This parent router owns the portal-auth middleware and feature gate, then
// mounts the concern-specific sub-routers (profile, groups, calendar, renewals).

import { Router } from 'express';
import { verifyAccessToken } from '../../utils/jwt.js';
import { isSessionInvalidated } from '../../utils/redis.js';
import { isFeatureEnabled } from '../../middleware/requireFeature.js';
import profileRouter from './profile.js';
import groupsRouter from './groups.js';
import calendarRouter from './calendar.js';
import renewalsRouter from './renewals.js';

const router = Router({ mergeParams: true });

// ─── Portal auth middleware ──────────────────────────────────────────────────

async function requirePortalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }
  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload.isPortal) {
      return res.status(403).json({ error: 'Not a portal token.' });
    }
    if (payload.tenantSlug !== req.params.slug) {
      return res.status(403).json({ error: 'Token does not match this organisation.' });
    }
    // Honour session invalidation (e.g. portal password change/reset) the same
    // way requireAuth does for tenant users, keyed on the member id.
    const invalidated = await isSessionInvalidated(
      payload.tenantSlug,
      payload.memberId,
      payload.iat,
    );
    if (invalidated) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    req.portal = payload; // { memberId, tenantSlug, name, isPortal }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

router.use(requirePortalAuth);

// Gate all portal routes on the portal feature toggle
router.use(async (req, res, next) => {
  try {
    if (!(await isFeatureEnabled(req.portal.tenantSlug, 'portal'))) {
      return res
        .status(403)
        .json({ error: 'The Members Portal is not enabled for this organisation.' });
    }
    next();
  } catch (err) {
    next(err);
  }
});

router.use('/', profileRouter);
router.use('/', groupsRouter);
router.use('/', calendarRouter);
router.use('/', renewalsRouter);

export default router;
