// beacon2026/backend/src/routes/api/org.js
// GET /api/v1/:slug/org — the u3a's own public identity and contact details.
//
// Field parity: these are exactly the fields already served unauthenticated
// by GET /public/:slug/info, which the Members Portal sign-in and online
// joining pages show to prospective members.

import { Router } from 'express';
import { tenantQuery } from '../../utils/db.js';
import { sendOne } from './helpers.js';

const router = Router();

router.get('/:slug/org', async (req, res, next) => {
  try {
    const [settings] = await tenantQuery(
      req.tenantSlug,
      `SELECT public_phone, public_email, home_page
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    return sendOne(res, {
      slug: req.tenantSlug,
      name: req.tenant.name || req.tenantSlug,
      phone: settings?.public_phone || null,
      email: settings?.public_email || null,
      homePage: settings?.home_page || null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
