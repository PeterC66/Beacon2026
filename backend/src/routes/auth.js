// beacon2/backend/src/routes/auth.js
// Authentication endpoints: login, logout, token refresh

import { Router } from 'express';
import { z } from 'zod';
import { loginUser, logoutUser, refreshTokens, loginSysAdmin } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { tenantQuery } from '../utils/db.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const COOKIE_NAME = 'beacon2_refresh';
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',   // required for cross-origin (Vercel frontend → Render backend)
  maxAge: 1000 * 60 * 60 * 24 * parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '30', 10),
};

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
    res.json({ accessToken: result.accessToken, user: result.user });
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
  newPassword:     z.string().min(8),
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

export default router;
