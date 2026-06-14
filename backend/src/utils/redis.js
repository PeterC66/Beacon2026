// beacon2/backend/src/utils/redis.js
// Redis client — used for refresh token revocation and session invalidation.
// Set USE_REDIS=false in environment to run without Redis (POC / free hosting).
//
// In production we refuse to start when REDIS_URL is missing unless the
// operator has explicitly opted out with USE_REDIS=false. Without Redis,
// privilege/role changes only take effect after the access token expires
// (up to 15 min) — acceptable for POC, dangerous unannounced in production.

import { createClient } from 'redis';
import { logger } from './logger.js';

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
      'is OFF — revoked roles remain effective until the access token expires.',
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
  if (!client) return;
  const key = `invalidated:${tenantSlug}:${userId}`;
  await client.set(key, Date.now().toString(), { EX: 60 * 60 * 24 * 31 });
}

export async function isSessionInvalidated(tenantSlug, userId, tokenIssuedAt) {
  if (!client) return false;
  const key = `invalidated:${tenantSlug}:${userId}`;
  const value = await client.get(key);
  if (!value) return false;
  const invalidatedAt = parseInt(value, 10);
  return tokenIssuedAt * 1000 < invalidatedAt;
}

// Remove every session-invalidation mark for a tenant. Used after a restore,
// which deletes and re-creates the tenant's users — stale marks (31-day TTL)
// would otherwise make the new users' sessions appear pre-revoked.
export async function purgeTenantInvalidations(tenantSlug) {
  if (!client) return;
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
}
