// beacon2026/backend/src/utils/resolveTenant.js
// Shared tenant-from-slug resolution middleware.
//
// Extracted from routes/public/index.js so the public pages and the public
// read API (/api/v1) cannot drift apart. The slug guard here must stay
// byte-identical to the one in utils/db.js: a slug the edge accepts but
// tenantQuery rejects would surface as a 500 instead of a 400.

import { prisma } from './db.js';

/** The one true slug shape. Schema names cannot contain `-`. */
export const SLUG_RE = /^[a-z0-9_]+$/;

/**
 * Express middleware factory. Resolves `:slug` to an active tenant and
 * attaches `req.tenant` / `req.tenantSlug`.
 *
 * @param {(res: import('express').Response, status: number, code: string, message: string) => void} [respond]
 *   Optional error responder, so callers can choose their error envelope.
 *   Defaults to the `{ error: '...' }` shape used by the public pages.
 */
export function makeResolveTenant(respond) {
  const fail =
    respond ?? ((res, status, _code, message) => res.status(status).json({ error: message }));

  return async function resolveTenant(req, res, next) {
    const { slug } = req.params;
    if (!slug || !SLUG_RE.test(slug)) {
      return fail(res, 400, 'invalid_slug', 'Invalid tenant slug.');
    }
    try {
      const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.active) {
        return fail(res, 404, 'not_found', 'Organisation not found.');
      }
      req.tenant = tenant;
      req.tenantSlug = slug;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Default instance, matching the historic public-pages behaviour. */
export const resolveTenant = makeResolveTenant();
