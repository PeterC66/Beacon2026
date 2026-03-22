// beacon2/backend/src/services/authService.js
// Core authentication business logic.

import crypto from 'crypto';
import { tenantQuery, prisma } from '../utils/db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { invalidateUserSessions } from '../utils/redis.js';
import { AppError } from '../middleware/errorHandler.js';

// ─── Login ────────────────────────────────────────────────────────────────

/**
 * Authenticate a u3a user.
 * Returns access token (in response body) and refresh token (for httpOnly cookie).
 *
 * @param {string} tenantSlug
 * @param {string} username
 * @param {string} password
 */
export async function loginUser(tenantSlug, username, password) {
  // 1. Verify tenant exists and is active
  const tenant = await prisma.sysTenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant || !tenant.active) throw AppError('Invalid credentials.', 401);

  // 2. Find user in tenant schema — try username first, fall back to email
  //    (fallback allows existing users without a username set to still log in)
  let [user] = await tenantQuery(
    tenantSlug,
    `SELECT id, email, name, password_hash, active, is_site_admin, must_change_password FROM users WHERE username = $1`,
    [username.toLowerCase()],
  );

  if (!user) {
    [user] = await tenantQuery(
      tenantSlug,
      `SELECT id, email, name, password_hash, active, is_site_admin, must_change_password FROM users WHERE email = $1`,
      [username.toLowerCase()],
    );
  }

  // Use a consistent comparison time even if user not found (timing attack prevention)
  const dummyHash = '$2b$12$invalidhashfortimingattackprevention000000000000000000000';
  const hashToCheck = user?.password_hash ?? dummyHash;

  const valid = await verifyPassword(password, hashToCheck);
  if (!user || !valid || !user.active) {
    throw AppError('Invalid credentials.', 401);
  }

  // 3. Compute effective privileges (union across all assigned roles)
  //    Site admin gets ALL privileges (doc 8.1)
  const privileges = user.is_site_admin
    ? await computeAllPrivileges(tenantSlug)
    : await computePrivileges(tenantSlug, user.id);

  // 4. Issue tokens
  const tokenPayload = {
    userId: user.id,
    tenantSlug,
    name: user.name,
    privileges,
    isSiteAdmin: user.is_site_admin || false,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user.id, tenantSlug });

  // 5. Store refresh token hash in DB
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '30', 10));

  await tenantQuery(
    tenantSlug,
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt],
  );

  // 6. Update last_login
  await tenantQuery(
    tenantSlug,
    `UPDATE users SET last_login = now() WHERE id = $1`,
    [user.id],
  );

  return { accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, mustChangePassword: user.must_change_password || false } };
}

// ─── Token refresh ────────────────────────────────────────────────────────

/**
 * Exchange a valid refresh token for a new access token.
 * Rotates the refresh token (old one revoked, new one issued).
 */
export async function refreshTokens(tenantSlug, refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError('Invalid or expired refresh token.', 401);
  }

  const tokenHash = hashToken(refreshToken);

  // Look up the token in the DB
  const [stored] = await tenantQuery(
    tenantSlug,
    `SELECT id, user_id, revoked, expires_at FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash],
  );

  if (!stored || stored.revoked || new Date(stored.expires_at) < new Date()) {
    // Possible token reuse — invalidate ALL sessions for this user
    if (stored) {
      await invalidateUserSessions(tenantSlug, stored.user_id);
    }
    throw AppError('Invalid refresh token.', 401);
  }

  // Revoke old token
  await tenantQuery(
    tenantSlug,
    `UPDATE refresh_tokens SET revoked = true WHERE id = $1`,
    [stored.id],
  );

  // Re-compute privileges (may have changed since last login)
  const [user] = await tenantQuery(
    tenantSlug,
    `SELECT id, name, email, is_site_admin, must_change_password FROM users WHERE id = $1`,
    [stored.user_id],
  );

  const privileges = user?.is_site_admin
    ? await computeAllPrivileges(tenantSlug)
    : await computePrivileges(tenantSlug, stored.user_id);

  // Issue new tokens
  const newAccessToken = signAccessToken({ userId: user.id, tenantSlug, name: user.name, privileges, isSiteAdmin: user.is_site_admin || false });
  const newRefreshToken = signRefreshToken({ userId: user.id, tenantSlug });

  const newHash = hashToken(newRefreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '30', 10));

  await tenantQuery(
    tenantSlug,
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, newHash, expiresAt],
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: { id: user.id, name: user.name, email: user.email, mustChangePassword: user.must_change_password || false } };
}

// ─── Logout ───────────────────────────────────────────────────────────────

export async function logoutUser(tenantSlug, refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await tenantQuery(
    tenantSlug,
    `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
    [tokenHash],
  );
}

// ─── System admin login ───────────────────────────────────────────────────

export async function loginSysAdmin(email, password) {
  const admin = await prisma.sysAdmin.findUnique({ where: { email: email.toLowerCase() } });

  const dummyHash = '$2b$12$invalidhashfortimingattackprevention000000000000000000000';
  const valid = await verifyPassword(password, admin?.passwordHash ?? dummyHash);

  if (!admin || !valid || !admin.active) {
    throw AppError('Invalid credentials.', 401);
  }

  const accessToken = signAccessToken({ sysAdminId: admin.id, isSysAdmin: true, name: admin.name });

  await prisma.sysAdmin.update({ where: { id: admin.id }, data: { lastLogin: new Date() } });

  return { accessToken, admin: { id: admin.id, name: admin.name, email: admin.email } };
}

// ─── Privilege computation ────────────────────────────────────────────────

/**
 * Compute the full set of effective privileges for a user.
 * Unions all privileges across all roles assigned to the user.
 *
 * Returns an array of strings like ["members_list:view", "finance:transactions:create"]
 *
 * @param {string} tenantSlug
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function computePrivileges(tenantSlug, userId) {
  const rows = await tenantQuery(
    tenantSlug,
    `SELECT DISTINCT pr.code, rp.action
     FROM user_roles ur
     JOIN role_privileges rp ON rp.role_id = ur.role_id
     JOIN privilege_resources pr ON pr.id = rp.resource_id
     WHERE ur.user_id = $1`,
    [userId],
  );

  return rows.map((r) => `${r.code}:${r.action}`);
}

/**
 * Return ALL defined privilege strings for a tenant.
 * Used for the Site Administrator who has full access (doc 8.1).
 */
export async function computeAllPrivileges(tenantSlug) {
  const rows = await tenantQuery(
    tenantSlug,
    `SELECT pr.code, unnest(pr.actions) AS action
     FROM privilege_resources pr`,
  );
  return rows.map((r) => `${r.code}:${r.action}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
