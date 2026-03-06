// beacon2/backend/src/utils/redis.js
// Redis client — used for refresh token revocation and session invalidation

import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });

client.on('error', (err) => console.error('Redis error:', err));

await client.connect();

export default client;

/**
 * Invalidate all sessions for a given user (e.g. when their roles change).
 * The access token middleware checks this set on each request.
 *
 * @param {string} tenantSlug
 * @param {string} userId
 */
export async function invalidateUserSessions(tenantSlug, userId) {
  const key = `invalidated:${tenantSlug}:${userId}`;
  // Store the invalidation timestamp — any token issued before this time is rejected
  await client.set(key, Date.now().toString(), { EX: 60 * 60 * 24 * 31 }); // 31 days TTL
}

/**
 * Check if a user's sessions have been invalidated after a given timestamp.
 * @param {string} tenantSlug
 * @param {string} userId
 * @param {number} tokenIssuedAt - JWT iat claim (seconds)
 * @returns {Promise<boolean>} true if the token should be rejected
 */
export async function isSessionInvalidated(tenantSlug, userId, tokenIssuedAt) {
  const key = `invalidated:${tenantSlug}:${userId}`;
  const value = await client.get(key);
  if (!value) return false;
  const invalidatedAt = parseInt(value, 10);
  return tokenIssuedAt * 1000 < invalidatedAt;  // token was issued before invalidation
}
