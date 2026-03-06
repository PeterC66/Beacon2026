// beacon2/backend/src/utils/redis.js
// Redis client — used for refresh token revocation and session invalidation.
// Set USE_REDIS=false in environment to run without Redis (POC / free hosting).

import { createClient } from 'redis';

const USE_REDIS = process.env.USE_REDIS !== 'false' && !!process.env.REDIS_URL;

let client = null;

if (USE_REDIS) {
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();
  console.log('Redis connected.');
} else {
  console.log('Redis disabled — running without session invalidation (POC mode).');
}

export default client;

/**
 * Invalidate all sessions for a given user (e.g. when their roles change).
 * No-op when Redis is disabled.
 */
export async function invalidateUserSessions(tenantSlug, userId) {
  if (!client) return;   // POC mode — skip
  const key = `invalidated:${tenantSlug}:${userId}`;
  await client.set(key, Date.now().toString(), { EX: 60 * 60 * 24 * 31 });
}

/**
 * Check if a user's sessions have been invalidated.
 * Always returns false when Redis is disabled (tokens remain valid until they expire).
 */
export async function isSessionInvalidated(tenantSlug, userId, tokenIssuedAt) {
  if (!client) return false;   // POC mode — skip
  const key = `invalidated:${tenantSlug}:${userId}`;
  const value = await client.get(key);
  if (!value) return false;
  const invalidatedAt = parseInt(value, 10);
  return tokenIssuedAt * 1000 < invalidatedAt;
}
