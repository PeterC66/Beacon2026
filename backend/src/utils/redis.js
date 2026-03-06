// beacon2/backend/src/utils/redis.js
// Redis client — used for refresh token revocation and session invalidation.
// Set USE_REDIS=false in environment to run without Redis (POC / free hosting).

import { createClient } from 'redis';

const USE_REDIS = process.env.USE_REDIS !== 'false' && !!process.env.REDIS_URL;

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
