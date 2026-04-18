// beacon2/backend/src/utils/jwt.js
// JWT creation and verification helpers.
//
// We pin the algorithm to HS256 on both signing and verification.  Pinning
// `algorithms: ['HS256']` on verify defeats the classic "alg=none" /
// algorithm-confusion attack where an attacker swaps the header to a public
// key algorithm the server then validates with the HMAC secret.

import jwt from 'jsonwebtoken';

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const ALGORITHM      = 'HS256';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT secrets must be set in environment variables');
}

/**
 * Creates an access token embedding the user's identity and privilege set.
 * Short-lived (default 15 minutes).
 *
 * @param {object} payload
 * @param {string} payload.userId
 * @param {string} payload.tenantSlug
 * @param {string} payload.name
 * @param {string[]} payload.privileges - e.g. ["members_list:view", "finance:transactions:create"]
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { algorithm: ALGORITHM, expiresIn: ACCESS_EXPIRES });
}

/**
 * Creates a refresh token. Opaque to the client — only the hash is stored in DB.
 * Long-lived (default 30 days).
 */
export function signRefreshToken(payload) {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '30', 10);
  return jwt.sign(payload, REFRESH_SECRET, { algorithm: ALGORITHM, expiresIn: `${days}d` });
}

/**
 * Verifies an access token. Throws if invalid or expired.
 * @returns {object} decoded payload
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, { algorithms: [ALGORITHM] });
}

/**
 * Verifies a refresh token. Throws if invalid or expired.
 * @returns {object} decoded payload
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET, { algorithms: [ALGORITHM] });
}
