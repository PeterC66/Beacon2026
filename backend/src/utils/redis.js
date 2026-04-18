// beacon2/backend/src/utils/redis.js
// Redis client — used for refresh token revocation and session invalidation.
// Set USE_REDIS=false in environment to run without Redis (POC / free hosting).
//
// In production we refuse to start when REDIS_URL is missing unless the
// operator has explicitly opted out with USE_REDIS=false. Without Redis,
// privilege/role changes only take effect after the access token expires
// (up to 15 min) — acceptable for POC, dangerous unannounced in production.

import { createClient } from 'redis';

const USE_REDIS = process.env.USE_REDIS !== 'false' && !!process.env.REDIS_URL;
const IS_PROD   = process.env.NODE_ENV === 'production';

if (IS_PROD && process.env.USE_REDIS !== 'false' && !process.env.REDIS_URL) {
  throw new Error(
    'REDIS_URL is required in production. Set it, or set USE_REDIS=false to ' +
    'explicitly run without session invalidation (not recommended).',
  );
}

if (IS_PROD && process.env.USE_REDIS === 'false') {
  console.warn(
    '⚠ Redis is disabled in production (USE_REDIS=false). Session invalidation ' +
    'is OFF — revoked roles remain effective until the access token expires.',
  );
}

let client = null;

// Wrapped in a function to avoid top-level await (compatibility with all Node versions)
async function connectRedis() {
  if (!USE_REDIS) {
    console.log('Redis disabled — running without session invalidation (POC mode).');
    return;
  }
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();
  console.log('Redis connected.');
}

// Fire and forget on startup — errors are logged but do not crash the app
connectRedis().catch((err) => console.error('Redis connection failed:', err));

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
