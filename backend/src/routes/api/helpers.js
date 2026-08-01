// beacon2026/backend/src/routes/api/helpers.js
// Shared machinery for the public read API (/api/v1). See docs/API-design.md.
//
// Every field-visibility decision for the anonymous tier lives in this file
// and in the per-resource projection functions that use `visible()`. Keeping
// them in one place is deliberate: it means there is exactly one thing to
// review when asking "can this leak?", and exactly one thing to test.

import { z } from 'zod';
import { tenantQuery } from '../../utils/db.js';
import { FEATURE_DEPS, isOn } from '../../../../shared/constants.js';

// ─── Error envelope ───────────────────────────────────────────────────────

/** Public-API errors are `{ error: { code, message } }`, not the internal shape. */
export function apiFail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

/** Router-level error handler, mounted at the end of the v1 router. */
export function apiErrorHandler(err, req, res, _next) {
  if (err?.name === 'ZodError') {
    return apiFail(res, 400, 'invalid_query', err.errors.map((e) => e.message).join('; '));
  }
  if (err?.status && err?.message) {
    return apiFail(res, err.status, err.code ?? 'error', err.message);
  }
  // Deliberately opaque: this surface is public, so it never leaks internals.
  req.log?.error?.(err);
  return apiFail(res, 500, 'internal_error', 'An unexpected error occurred.');
}

// ─── Success envelope ─────────────────────────────────────────────────────

const MAX_AGE_SECONDS = 300;

/**
 * Send a cacheable public response. Express generates the ETag and answers
 * a matching `If-None-Match` with a 304 by itself; all we add is the
 * caching policy that makes integrators' caches actually work.
 */
function sendPublic(res, payload) {
  res.set('Cache-Control', `public, max-age=${MAX_AGE_SECONDS}`);
  return res.json(payload);
}

/** Collection response: `{ data: [...], meta: { total, limit, offset } }`. */
export function sendCollection(res, rows, { total, limit, offset }) {
  return sendPublic(res, { data: rows, meta: { total, limit, offset } });
}

/** Single-resource response: `{ data: {...} }`. */
export function sendOne(res, row) {
  return sendPublic(res, { data: row });
}

// ─── Pagination ───────────────────────────────────────────────────────────

export const MAX_LIMIT = 200;
export const DEFAULT_LIMIT = 50;

const paginationSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be between 1 and 200')
    .max(MAX_LIMIT, 'limit must be between 1 and 200')
    .default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0, 'offset must be 0 or greater').default(0),
});

/** Parse and validate `?limit=&offset=`. Throws ZodError on bad input. */
export function pagination(query) {
  return paginationSchema.parse({
    limit: query.limit ?? undefined,
    offset: query.offset ?? undefined,
  });
}

// ─── Feature gating ───────────────────────────────────────────────────────

/**
 * Load a tenant's feature_config once per request. Cached on `req` so a
 * handler that checks two features does not make two round trips.
 */
export async function featureConfig(req) {
  if (!req._featureConfig) {
    const [row] = await tenantQuery(
      req.tenantSlug,
      `SELECT feature_config FROM tenant_settings WHERE id = 'singleton'`,
    );
    req._featureConfig = row?.feature_config ?? {};
  }
  return req._featureConfig;
}

/** Is a feature on for this tenant, honouring its master-toggle dependency? */
export function featureOn(config, key) {
  const parent = FEATURE_DEPS[key];
  return isOn(config, key) && (!parent || isOn(config, parent));
}

/**
 * Guard a resource behind a feature toggle. Returns true if the caller may
 * proceed; otherwise it has already sent a 404.
 *
 * 404 rather than 403 is deliberate. To an anonymous caller, a resource a
 * u3a has not enabled should be indistinguishable from one that does not
 * exist — a 403 would confirm the u3a exists and merely declined.
 */
export async function requireFeatures(req, res, keys) {
  const config = await featureConfig(req);
  for (const key of keys) {
    if (!featureOn(config, key)) {
      apiFail(res, 404, 'not_found', 'Not found.');
      return false;
    }
  }
  return true;
}

// ─── Field visibility ─────────────────────────────────────────────────────

/**
 * Load the tenant's public-field configuration.
 *
 * This is the same `group_info_config` / `calendar_config` that drives the
 * public Groups and Calendar pages. Reusing it is the core of the design:
 * the anonymous API can never expose a field the u3a has not already chosen
 * to publish on the open web.
 */
export async function visibility(req) {
  if (!req._visibility) {
    const [row] = await tenantQuery(
      req.tenantSlug,
      `SELECT group_info_config, calendar_config FROM tenant_settings WHERE id = 'singleton'`,
    );
    req._visibility = {
      group: row?.group_info_config ?? {},
      calendar: row?.calendar_config ?? {},
    };
  }
  return req._visibility;
}

/**
 * Is one configured field public? Everything defaults to *not* public, so a
 * u3a that has never opened the Public Links page publishes nothing beyond
 * the always-visible identity fields.
 */
export function visible(config, field) {
  return config?.[field]?.public === true;
}

// ─── Deprecation signalling ───────────────────────────────────────────────

/**
 * The Third Age Trust owns this interface and has committed to six months'
 * notice before any v1 field or endpoint changes meaning or is withdrawn
 * (docs/API-design.md). Notice is signalled in-band with RFC 8594 headers as
 * well as on the published documentation page, because anonymous access
 * means we have no list of integrators to email.
 *
 * Inert until `API_V1_SUNSET` is set to an ISO date, which is the intended
 * steady state: v1 is not deprecated.
 */
export function deprecationHeaders(_req, res, next) {
  const sunset = process.env.API_V1_SUNSET;
  if (sunset) {
    const date = new Date(sunset);
    if (!Number.isNaN(date.getTime())) {
      res.set('Deprecation', 'true');
      res.set('Sunset', date.toUTCString());
      if (process.env.API_V1_SUNSET_LINK) {
        res.set('Link', `<${process.env.API_V1_SUNSET_LINK}>; rel="sunset"`);
      }
    }
  }
  next();
}
