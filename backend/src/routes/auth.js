// beacon2/backend/src/routes/auth.js
// Authentication endpoints: login, logout, token refresh

import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import sgMail from '@sendgrid/mail';
import { loginUser, logoutUser, refreshTokens, loginSysAdmin } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { tenantQuery, prisma } from '../utils/db.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const RECOVERY_FROM = process.env.RECOVERY_FROM_ADDRESS ?? 'noreply@u3abeacon.org.uk';

const COOKIE_NAME = 'beacon2_refresh';
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',   // required for cross-origin (Vercel frontend → Render backend)
  maxAge: 1000 * 60 * 60 * 24 * parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '30', 10),
};

// CSRF defence for the refresh cookie. Because the cookie is SameSite=none
// a cross-origin POST from an attacker's page could otherwise trigger a
// token refresh (revoking the legitimate one). The browser always sends
// Origin on cross-origin requests and the attacker cannot spoof it, so we
// require Origin — when present — to match CORS_ORIGIN. In dev/test
// CORS_ORIGIN may be unset or Origin may be absent (supertest); we skip
// the check there.
function isAllowedOrigin(req) {
  const allowed = process.env.CORS_ORIGIN;
  if (!allowed) return true;
  const origin = req.headers.origin;
  if (!origin) {
    // Browsers always send Origin on cross-origin POST. Absence means a
    // non-browser caller (server-to-server, tests) — no CSRF risk.
    return process.env.NODE_ENV !== 'production';
  }
  try {
    return new URL(origin).origin === new URL(allowed).origin;
  } catch {
    return false;
  }
}

// ─── POST /auth/login ─────────────────────────────────────────────────────
// Log in a u3a user. Tenant is identified by the slug in the request body.
// In production, tenant could also be determined by subdomain.

const loginSchema = z.object({
  tenantSlug: z.string().min(1),
  username:   z.string().min(1),
  password:   z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const { tenantSlug, username, password } = loginSchema.parse(req.body);
    const result = await loginUser(tenantSlug, username, password);

    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);

    res.json({
      accessToken: result.accessToken,
      user: result.user,
      mustChangePassword: result.user.mustChangePassword || false,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];
    await logoutUser(req.user.tenantSlug, refreshToken);

    res.clearCookie(COOKIE_NAME);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────
// Issue a new access token using the refresh token from the httpOnly cookie.

router.post('/refresh', async (req, res, next) => {
  try {
    if (!isAllowedOrigin(req)) {
      return res.status(403).json({ error: 'Origin not allowed.' });
    }

    const refreshToken = req.cookies?.[COOKIE_NAME];
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token.' });
    }

    // tenantSlug comes from the (expired) access token or a separate cookie/header
    // For simplicity here we decode without verifying to extract tenantSlug
    // The refresh token is verified inside refreshTokens()
    const tenantSlug = req.headers['x-tenant-slug'];
    if (!tenantSlug) {
      return res.status(400).json({ error: 'Tenant not specified.' });
    }

    const result = await refreshTokens(tenantSlug, refreshToken);

    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.json({ accessToken: result.accessToken, user: result.user, mustChangePassword: result.user?.mustChangePassword || false });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/system/login ──────────────────────────────────────────────
// Log in a system administrator (separate credentials, no tenant).

const sysLoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

router.post('/system/login', async (req, res, next) => {
  try {
    const { email, password } = sysLoginSchema.parse(req.body);
    const result = await loginSysAdmin(email, password);
    res.json({ accessToken: result.accessToken, admin: result.admin });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/change-password ───────────────────────────────────────────
// Allows a logged-in user to change their own password.

const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(10).max(72),
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePwSchema.parse(req.body);
    const slug = req.user.tenantSlug;
    const [user] = await tenantQuery(slug, `SELECT id, password_hash FROM users WHERE id = $1`, [req.user.userId]);
    if (!user) throw AppError('User not found.', 404);

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) throw AppError('Current password is incorrect.', 400);

    const newHash = await hashPassword(newPassword);
    await tenantQuery(slug, `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [newHash, user.id]);
    res.json({ message: 'Password changed.' });
  } catch (err) { next(err); }
});

// ─── PATCH /auth/qa ───────────────────────────────────────────────────────
// Allows a logged-in user to update their security question and answer.

const qaSchema = z.object({
  question: z.string().min(1).max(200),
  answer:   z.string().min(1).max(200),
});

router.patch('/qa', requireAuth, async (req, res, next) => {
  try {
    const { question, answer } = qaSchema.parse(req.body);
    const slug = req.user.tenantSlug;
    const [user] = await tenantQuery(slug, `SELECT id FROM users WHERE id = $1`, [req.user.userId]);
    if (!user) throw AppError('User not found.', 404);

    const answerHash = await hashPassword(answer);
    await tenantQuery(
      slug,
      `UPDATE users SET security_question = $1, security_answer_hash = $2, updated_at = now() WHERE id = $3`,
      [question, answerHash, user.id],
    );
    res.json({ message: 'Security Q&A updated.' });
  } catch (err) { next(err); }
});

// ─── GET /auth/qa ─────────────────────────────────────────────────────────
// Returns the current user's security question (not the answer hash).

router.get('/qa', requireAuth, async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [user] = await tenantQuery(
      slug,
      `SELECT security_question FROM users WHERE id = $1`,
      [req.user.userId],
    );
    res.json({ question: user?.security_question ?? null });
  } catch (err) { next(err); }
});

// ─── POST /auth/recover ──────────────────────────────────────────────────
// Step 1: Identify the user by forename, surname, postcode, email.
// Returns the security question if one is set, or sends the recovery email
// directly if no question is set. Blocks site admins.

const recoverSchema = z.object({
  tenantSlug: z.string().min(1),
  forename:   z.string().min(1),
  surname:    z.string().min(1),
  postcode:   z.string().min(1),
  email:      z.string().email(),
});

// Generic message to avoid revealing whether the user exists
const RECOVER_GENERIC = 'If a matching account was found, you will receive an email with your login details.';

router.post('/recover', async (req, res, next) => {
  try {
    const data = recoverSchema.parse(req.body);
    const tenant = await prisma.sysTenant.findUnique({ where: { slug: data.tenantSlug } });
    if (!tenant || !tenant.active) {
      return res.json({ message: RECOVER_GENERIC });
    }

    // Find user linked to a member matching forename + surname + postcode + email
    const [user] = await tenantQuery(
      data.tenantSlug,
      `SELECT u.id, u.username, u.email AS user_email, u.is_site_admin,
              u.security_question, u.security_answer_hash
       FROM users u
       JOIN members m ON m.id = u.member_id
       WHERE LOWER(m.forenames) = LOWER($1)
         AND LOWER(m.surname)   = LOWER($2)
         AND LOWER(REPLACE(m.postcode, ' ', '')) = LOWER(REPLACE($3, ' ', ''))
         AND LOWER(m.email)     = LOWER($4)
         AND u.active = true
       LIMIT 1`,
      [data.forename, data.surname, data.postcode, data.email],
    );

    if (!user) {
      return res.json({ message: RECOVER_GENERIC });
    }

    // Block recovery for site administrators
    if (user.is_site_admin) {
      return res.json({ message: RECOVER_GENERIC });
    }

    // If user has a security question, return it so the frontend can ask step 2
    if (user.security_question && user.security_answer_hash) {
      return res.json({ securityQuestion: user.security_question, userId: user.id });
    }

    // No security question set — send recovery email directly
    await sendRecoveryEmail(data.tenantSlug, user);
    res.json({ message: RECOVER_GENERIC });
  } catch (err) { next(err); }
});

// ─── POST /auth/recover/verify ───────────────────────────────────────────
// Step 2: Verify the security answer and send the recovery email.

const recoverVerifySchema = z.object({
  tenantSlug: z.string().min(1),
  userId:     z.string().min(1),
  answer:     z.string().min(1),
});

router.post('/recover/verify', async (req, res, next) => {
  try {
    const data = recoverVerifySchema.parse(req.body);
    const tenant = await prisma.sysTenant.findUnique({ where: { slug: data.tenantSlug } });
    if (!tenant || !tenant.active) {
      return res.json({ message: RECOVER_GENERIC });
    }

    const [user] = await tenantQuery(
      data.tenantSlug,
      `SELECT id, username, email, is_site_admin, security_answer_hash
       FROM users WHERE id = $1 AND active = true`,
      [data.userId],
    );

    if (!user || user.is_site_admin || !user.security_answer_hash) {
      return res.json({ message: RECOVER_GENERIC });
    }

    const valid = await verifyPassword(data.answer, user.security_answer_hash);
    if (!valid) {
      return res.status(400).json({ error: 'The answer is incorrect. Please try again, using the same format as when it was originally set.' });
    }

    await sendRecoveryEmail(data.tenantSlug, user);
    res.json({ message: RECOVER_GENERIC });
  } catch (err) { next(err); }
});

// ─── POST /auth/force-change-password ────────────────────────────────────
// Used after login when must_change_password is true.
// Sets new password + security Q&A. Does NOT require current password.

const forceChangePwSchema = z.object({
  newPassword: z.string().min(10).max(72),
  question:    z.string().min(1).max(200),
  answer:      z.string().min(1).max(200),
});

router.post('/force-change-password', requireAuth, async (req, res, next) => {
  try {
    const { newPassword, question, answer } = forceChangePwSchema.parse(req.body);

    // Validate password rules: no spaces, upper+lower+number
    if (/\s/.test(newPassword)) throw AppError('Password must not contain spaces.', 400);
    if (!/[A-Z]/.test(newPassword)) throw AppError('Password must include at least one uppercase letter.', 400);
    if (!/[a-z]/.test(newPassword)) throw AppError('Password must include at least one lowercase letter.', 400);
    if (!/[0-9]/.test(newPassword)) throw AppError('Password must include at least one number.', 400);

    const slug = req.user.tenantSlug;
    const newHash = await hashPassword(newPassword);
    const answerHash = await hashPassword(answer);

    await tenantQuery(
      slug,
      `UPDATE users SET password_hash = $1, must_change_password = false,
              security_question = $2, security_answer_hash = $3, updated_at = now()
       WHERE id = $4`,
      [newHash, question, answerHash, req.user.userId],
    );

    logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'force_change_password', entityType: 'user', entityId: req.user.userId, entityName: req.user.name });
    res.json({ message: 'Password changed successfully.' });
  } catch (err) { next(err); }
});

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Generate a random temporary password like "!xZ#8kP2" */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

/** Generate temp password, update user, and send recovery email.
 *  The temp password is never logged. If SendGrid is not configured the
 *  recovery email cannot be delivered — we log a warning (without the
 *  password) so operators can see that email delivery is disabled. */
async function sendRecoveryEmail(tenantSlug, user) {
  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);

  await tenantQuery(
    tenantSlug,
    `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = now() WHERE id = $2`,
    [hash, user.id],
  );

  const subject = 'Your Beacon2 login credentials';
  const body = `Your username is: ${user.username}\n\nA temporary password has been set: ${tempPassword}\n\nYou will be required to change this password when you next log in.`;

  if (!process.env.SENDGRID_API_KEY) {
    console.warn(
      `[Recovery] SendGrid not configured — cannot deliver recovery email to ${user.email}. ` +
      `Set SENDGRID_API_KEY to enable account recovery emails.`,
    );
    return;
  }

  try {
    await sgMail.send({
      to: user.email,
      from: RECOVERY_FROM,
      subject,
      text: body,
    });
  } catch (err) {
    // Never include the body/password in the error log.
    console.error(`[Recovery] Failed to send recovery email to ${user.email}:`, err.message);
  }
}

export default router;
