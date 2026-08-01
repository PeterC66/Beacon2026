// beacon2026/backend/src/routes/api/index.js
// The public read API, version 1. See docs/API-design.md.
//
// This is a *published* interface owned by the Third Age Trust, with a
// six-month deprecation notice period. It is not the internal API the React
// frontend uses: routes here are versioned and additive-only, and nothing in
// v1 changes meaning without notice. Adding a field is free; changing or
// removing one is a commitment measured in months.
//
// Read-only, anonymous, and opt-in per u3a via the `publicApi` feature.

import { Router } from 'express';
import { createRequire } from 'module';
import { makeResolveTenant } from '../../utils/resolveTenant.js';
import {
  apiFail,
  apiErrorHandler,
  deprecationHeaders,
  featureConfig,
  featureOn,
} from './helpers.js';
import orgRoutes from './org.js';
import facultyRoutes from './faculties.js';
import venueRoutes from './venues.js';
import groupRoutes from './groups.js';
import eventRoutes from './events.js';
import icsRoutes from './ics.js';

const require = createRequire(import.meta.url);
const openapi = require('./openapi.json');

const router = Router();

router.use(deprecationHeaders);

// ─── Specification ────────────────────────────────────────────────────────
// Declared before the `/:slug` middleware so it is never mistaken for a
// tenant slug. (It would be rejected by the slug guard anyway, but a 400 on
// the documentation URL would be a poor first impression.)

router.get('/openapi.json', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(openapi);
});

// ─── Tenant resolution ────────────────────────────────────────────────────
// Shared with the public pages via utils/resolveTenant.js, with this API's
// own error envelope substituted.

router.use('/:slug', makeResolveTenant(apiFail));

// ─── Feature gate ─────────────────────────────────────────────────────────

router.use('/:slug', async (req, res, next) => {
  try {
    const config = await featureConfig(req);
    if (!featureOn(config, 'publicApi')) {
      // 404, not 403: to an anonymous caller a u3a that has not opted in
      // should look no different from one that does not exist.
      return apiFail(res, 404, 'not_found', 'Not found.');
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Resources ────────────────────────────────────────────────────────────

router.use('/', orgRoutes);
router.use('/', facultyRoutes);
router.use('/', venueRoutes);
router.use('/', groupRoutes);
router.use('/', eventRoutes);
router.use('/', icsRoutes);

// ─── Fallbacks ────────────────────────────────────────────────────────────

router.use((_req, res) => apiFail(res, 404, 'not_found', 'Not found.'));
router.use(apiErrorHandler);

export default router;
