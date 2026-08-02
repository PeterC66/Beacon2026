// beacon2026/backend/src/utils/redis.js
// Redis client — used for refresh token revocation and session invalidation.
// Set USE_REDIS=false in environment to run without Redis (POC / free hosting).
//
// In production we refuse to start when REDIS_URL is missing unless the
// operator has explicitly opted out with USE_REDIS=false. When Redis is
// disabled, the session-invalidation marker falls back to the per-tenant
// `session_invalidations` table in Postgres, so revoked roles/passwords still
// take effect on the next access-token check rather than only after the token
// expires. (The fallback adds one indexed primary-key lookup per request.)

import { createClient } from 'redis';
import { logger } from './logger.js';
import { tenantQuery } from './db.js';

const USE_REDIS = process.env.USE_REDIS !== 'false' && !!process.env.REDIS_URL;
const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD && process.env.USE_REDIS !== 'false' && !process.env.REDIS_URL) {
  throw new Error(
    'REDIS_URL is required in production. Set it, or set USE_REDIS=false to ' +
      'explicitly run without session invalidation (not recommended).',
  );
}

if (IS_PROD && process.env.USE_REDIS === 'false') {
  logger.warn(
    '⚠ Redis is disabled in production (USE_REDIS=false). Session invalidation ' +
      'falls back to the Postgres session_invalidations table — functional, but ' +
      'Redis is recommended for scale.',
  );
}

let client = null;

// Wrapped in a function to avoid top-level await (compatibility with all Node versions)
async function connectRedis() {
  if (!USE_REDIS) {
    logger.info('Redis disabled — running without session invalidation (POC mode).');
    return;
  }
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => logger.error('Redis error', { message: err.message }));
  await client.connect();
  logger.info('Redis connected.');
}

// Fire and forget on startup — errors are logged but do not crash the app
connectRedis().catch((err) => logger.error('Redis connection failed', { message: err.message }));

export default client;

export async function invalidateUserSessions(tenantSlug, userId) {
  if (client) {
    const key = `invalidated:${tenantSlug}:${userId}`;
    await client.set(key, Date.now().toString(), { EX: 60 * 60 * 24 * 31 });
    return;
  }
  // Redis configured but momentarily unavailable — skip rather than write a
  // marker the read path (Redis) would never see.
  if (USE_REDIS) return;
  // No Redis: persist the marker in Postgres (one row per subject, upserted).
  await tenantQuery(
    tenantSlug,
    `INSERT INTO session_invalidations (subject_id, invalidated_at)
     VALUES ($1, now())
     ON CONFLICT (subject_id) DO UPDATE SET invalidated_at = now()`,
    [userId],
  );
}

export async function isSessionInvalidated(tenantSlug, userId, tokenIssuedAt) {
  if (client) {
    const key = `invalidated:${tenantSlug}:${userId}`;
    const value = await client.get(key);
    if (!value) return false;
    const invalidatedAt = parseInt(value, 10);
    return tokenIssuedAt < invalidatedSeconds(invalidatedAt);
  }
  if (USE_REDIS) return false;
  const [row] = await tenantQuery(
    tenantSlug,
    `SELECT invalidated_at FROM session_invalidations WHERE subject_id = $1`,
    [userId],
  );
  if (!row) return false;
  return tokenIssuedAt < invalidatedSeconds(new Date(row.invalidated_at).getTime());
}

// JWT `iat` is second-precision (jsonwebtoken floors it), but the
// invalidation marker is stored with millisecond precision. Comparing them
// directly (`tokenIssuedAt * 1000 < invalidatedAtMs`) means a token minted
// milliseconds *after* invalidation — e.g. the fresh access token a
// password-change route reissues for the caller's own session, moments
// after calling invalidateUserSessions() — can land in the very same
// second as the marker (its floored `iat` equals the marker's floored
// second) and still get wrongly flagged as stale. Flooring the marker to
// whole seconds before comparing removes that race: a token issued in the
// same second as the marker is no longer treated as predating it. This
// only widens the "still valid" window by under a second at the boundary —
// an unavoidable consequence of `iat` losing sub-second precision, not a
// meaningful weakening of the invalidation guarantee.
function invalidatedSeconds(invalidatedAtMs) {
  return Math.floor(invalidatedAtMs / 1000);
}

// Remove every session-invalidation mark for a tenant. Used after a restore,
// which deletes and re-creates the tenant's users — stale marks would otherwise
// make the new users' sessions appear pre-revoked.
export async function purgeTenantInvalidations(tenantSlug) {
  if (client) {
    const pattern = `invalidated:${tenantSlug}:*`;
    // SCAN avoids blocking Redis on large keyspaces (unlike KEYS).
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      // node-redis v4 yields a string per key (v5 may batch into arrays).
      if (Array.isArray(key)) {
        if (key.length) await client.del(key);
      } else {
        await client.del(key);
      }
    }
    return;
  }
  if (USE_REDIS) return;
  // No Redis: clear the Postgres fallback markers for this tenant. tenantQuery
  // scopes the search_path to the tenant schema, so this only touches its rows.
  await tenantQuery(tenantSlug, `DELETE FROM session_invalidations`);
}
