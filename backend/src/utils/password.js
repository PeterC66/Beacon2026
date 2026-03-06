// beacon2/backend/src/utils/password.js
// Password hashing and verification using bcrypt

import bcrypt from 'bcrypt';

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

/**
 * Hash a plaintext password.
 * @param {string} password
 * @returns {Promise<string>} hash
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

/**
 * Compare a plaintext password against a stored hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token (for refresh tokens, password resets etc.)
 * @returns {string} hex string
 */
export function generateToken() {
  const { randomBytes } = await import('crypto');  // lazy import to avoid top-level await
  return randomBytes(48).toString('hex');
}
