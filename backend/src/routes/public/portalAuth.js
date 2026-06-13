// beacon2/backend/src/routes/public/portalAuth.js
// Members Portal authentication endpoints (register, verify-email, login,
// forgot-password, reset-password). These are the unauthenticated entry points
// that issue or reset portal credentials; the authenticated portal app lives
// under routes/portal/.

import { Router } from 'express';
import { z } from 'zod';
import sgMail from '@sendgrid/mail';
import { rateLimit } from 'express-rate-limit';
import { tenantQuery } from '../../utils/db.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashOpaqueToken,
} from '../../utils/password.js';
import { passwordSchema } from '../../utils/passwordPolicy.js';
import { invalidateUserSessions } from '../../utils/redis.js';
import { signAccessToken } from '../../utils/jwt.js';
import { logAudit } from '../../utils/audit.js';

const router = Router();

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const PORTAL_FROM = process.env.RECOVERY_FROM_ADDRESS ?? 'noreply@u3abeacon.org.uk';

// Dummy bcrypt hash used to equalise response timing when no matching portal
// account exists, so a miss takes the same time as a wrong-password hit and
// cannot be distinguished by an attacker probing for registered emails.
const DUMMY_PORTAL_HASH = '$2b$12$invalidhashfortimingattackprevention000000000000000000000';

// Targeted rate limiter for the unauthenticated portal-auth endpoints
// (register/login/forgot/reset/verify). The global limiter is 300/15min/IP;
// these are far more sensitive, so cap them tightly. Env-tunable.
const portalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.PORTAL_AUTH_RATE_LIMIT_MAX ?? '20', 10),
  message: { error: 'Too many attempts, please try again later.' },
});

// Portal-login lockout — reuses the admin login env vars so operators have a
// single knob. Mirrors registerFailedLogin() in services/authService.js.
const MAX_FAILED_LOGINS = parseInt(process.env.MAX_FAILED_LOGINS ?? '5', 10);
const LOCKOUT_MINUTES = parseInt(process.env.LOCKOUT_MINUTES ?? '15', 10);

async function registerPortalFailedLogin(slug, members, attemptedEmail) {
  for (const m of members) {
    const newCount = (m.portal_failed_login_count ?? 0) + 1;
    const willLock = newCount >= MAX_FAILED_LOGINS;
    const lockedUntil = willLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;

    await tenantQuery(
      slug,
      `UPDATE members SET portal_failed_login_count = $1, portal_locked_until = $2 WHERE id = $3`,
      [willLock ? 0 : newCount, lockedUntil, m.id],
    );

    await logAudit(slug, {
      userId: null,
      userName: `${m.forenames} ${m.surname}`,
      action: willLock ? 'portal_login_locked' : 'portal_login_failed',
      entityType: 'member',
      entityId: m.id,
      entityName: `${m.forenames} ${m.surname}`,
      detail: willLock
        ? `Portal account locked for ${LOCKOUT_MINUTES} min after ${MAX_FAILED_LOGINS} failed attempts (email ${attemptedEmail})`
        : `Failed portal attempt ${newCount}/${MAX_FAILED_LOGINS} (email ${attemptedEmail})`,
    });
  }
}

// ─── POST /:slug/portal/register ────────────────────────────────────────
// Step 1: Verify identity (membership number + forename + surname + postcode + email)
// Step 2: Set portal password and send verification email

const portalRegisterSchema = z.object({
  membershipNumber: z.number().int().positive(),
  forename: z.string().min(1),
  surname: z.string().min(1),
  postcode: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema,
});

router.post('/:slug/portal/register', portalAuthLimiter, async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const data = portalRegisterSchema.parse(req.body);

    // Find the member and verify identity
    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.forenames, m.surname, m.email, m.portal_password_hash,
              a.postcode
       FROM members m
       LEFT JOIN addresses a ON m.address_id = a.id
       WHERE m.membership_number = $1`,
      [data.membershipNumber],
    );

    if (!member) {
      return res
        .status(400)
        .json({ error: 'Details do not match our records. Please check and try again.' });
    }

    // Verify each field matches (case-insensitive). Match the full forename
    // string OR the first whitespace-delimited token exactly — never a
    // prefix, so a one-letter `data.forename` cannot match every member
    // whose forename starts with that letter.
    const submittedForename = data.forename.toLowerCase().trim();
    const memberForenameFull = member.forenames?.toLowerCase() ?? '';
    const memberForenameFirst = memberForenameFull.split(/\s+/)[0] ?? '';
    const forenameMatch =
      submittedForename === memberForenameFull || submittedForename === memberForenameFirst;
    const surnameMatch = member.surname?.toLowerCase() === data.surname.toLowerCase();
    const postcodeMatch =
      member.postcode?.replace(/\s+/g, '').toLowerCase() ===
      data.postcode.replace(/\s+/g, '').toLowerCase();
    const emailMatch = member.email?.toLowerCase() === data.email.toLowerCase();

    if (!forenameMatch || !surnameMatch || !postcodeMatch || !emailMatch) {
      return res
        .status(400)
        .json({ error: 'Details do not match our records. Please check and try again.' });
    }

    if (member.portal_password_hash) {
      return res.status(400).json({
        error: 'A portal account already exists for this member. Please sign in instead.',
      });
    }

    // Set portal credentials
    const passwordHash = await hashPassword(data.password);
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await tenantQuery(
      slug,
      `UPDATE members SET
         portal_email = $1,
         portal_password_hash = $2,
         portal_email_verified = false,
         portal_verification_token = $3,
         portal_verification_expires = $4,
         updated_at = now()
       WHERE id = $5`,
      [
        data.email.toLowerCase(),
        passwordHash,
        hashOpaqueToken(verificationToken),
        verificationExpires,
        member.id,
      ],
    );

    // Send the verification email with the link. Fire-and-forget; never log
    // the token (a leaked verification token would let an attacker activate an
    // account they registered against someone else's membership record).
    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const verifyLink = `${frontendBase}/public/${slug}/portal/verify?token=${verificationToken}`;
    void sendPortalVerificationEmail(data.email.toLowerCase(), verifyLink).catch((err) =>
      console.error('[Portal] Background verification email failed:', err.message),
    );

    logAudit(slug, {
      userId: null,
      userName: `${data.forename} ${data.surname} (portal)`,
      action: 'create',
      entityType: 'portal_account',
      entityId: member.id,
      entityName: `${member.forenames} ${member.surname}`,
    });

    res.json({
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/portal/verify-email ────────────────────────────────────

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

router.post('/:slug/portal/verify-email', portalAuthLimiter, async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const { token } = verifyEmailSchema.parse(req.body);

    const [member] = await tenantQuery(
      slug,
      `SELECT id, forenames, surname, portal_verification_expires
       FROM members
       WHERE portal_verification_token = $1`,
      [hashOpaqueToken(token)],
    );

    if (!member) {
      return res.status(400).json({ error: 'Invalid or expired verification link.' });
    }

    if (new Date() > new Date(member.portal_verification_expires)) {
      return res.status(400).json({
        error: 'Verification link has expired. Please use Forgotten Password to get a new one.',
      });
    }

    await tenantQuery(
      slug,
      `UPDATE members SET
         portal_email_verified = true,
         portal_verification_token = NULL,
         portal_verification_expires = NULL,
         updated_at = now()
       WHERE id = $1`,
      [member.id],
    );

    res.json({
      message: 'Email verified successfully. You can now sign in to the Members Portal.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/portal/login ───────────────────────────────────────────

const portalLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/:slug/portal/login', portalAuthLimiter, async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const data = portalLoginSchema.parse(req.body);

    const members = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
              m.portal_password_hash, m.portal_email_verified,
              m.portal_failed_login_count, m.portal_locked_until
       FROM members m
       WHERE m.portal_email = $1 AND m.portal_password_hash IS NOT NULL`,
      [data.email.toLowerCase()],
    );

    if (members.length === 0) {
      // Run a throwaway comparison so an unknown email takes about the same
      // time as a wrong password — otherwise response timing reveals which
      // emails have a portal account.
      await verifyPassword(data.password, DUMMY_PORTAL_HASH);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // If any member behind this email is currently locked, refuse the
    // attempt without recording another failure (otherwise hammering during
    // a lock window would extend it indefinitely). Same generic message as
    // a wrong-password response — never reveal the lock to the attacker.
    const now = new Date();
    const anyLocked = members.some(
      (m) => m.portal_locked_until && new Date(m.portal_locked_until) > now,
    );
    if (anyLocked) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Try each member with that email (handles shared email case minimally)
    let authenticatedMember = null;
    for (const member of members) {
      const match = await verifyPassword(data.password, member.portal_password_hash);
      if (match) {
        authenticatedMember = member;
        break;
      }
    }

    if (!authenticatedMember) {
      await registerPortalFailedLogin(slug, members, data.email.toLowerCase());
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!authenticatedMember.portal_email_verified) {
      return res.status(403).json({ error: 'Please verify your email address before signing in.' });
    }

    // Successful login — clear any failure counter / lockout window on the
    // winning member row.
    if (
      authenticatedMember.portal_failed_login_count > 0 ||
      authenticatedMember.portal_locked_until
    ) {
      await tenantQuery(
        slug,
        `UPDATE members SET portal_failed_login_count = 0, portal_locked_until = NULL WHERE id = $1`,
        [authenticatedMember.id],
      );
    }

    // Issue a portal JWT (different from admin JWT)
    const token = signAccessToken({
      memberId: authenticatedMember.id,
      tenantSlug: slug,
      name: `${authenticatedMember.forenames} ${authenticatedMember.surname}`,
      isPortal: true,
    });

    res.json({
      token,
      member: {
        id: authenticatedMember.id,
        membershipNumber: authenticatedMember.membership_number,
        name: `${authenticatedMember.forenames} ${authenticatedMember.surname}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/portal/forgot-password ─────────────────────────────────

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post('/:slug/portal/forgot-password', portalAuthLimiter, async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const { email } = forgotPasswordSchema.parse(req.body);

    const [member] = await tenantQuery(
      slug,
      `SELECT id, forenames, surname
       FROM members
       WHERE portal_email = $1 AND portal_password_hash IS NOT NULL`,
      [email.toLowerCase()],
    );

    // Always return success to avoid email enumeration
    if (!member) {
      return res.json({
        message: 'If an account exists with that email, a reset link has been sent.',
      });
    }

    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store only the hash — the plaintext token is delivered to the user via
    // the email link. A DB leak then can't be used to take over portal accounts.
    await tenantQuery(
      slug,
      `UPDATE members SET
         portal_reset_token = $1,
         portal_reset_expires = $2,
         updated_at = now()
       WHERE id = $3`,
      [hashOpaqueToken(resetToken), resetExpires, member.id],
    );

    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const resetLink = `${frontendBase}/public/${slug}/portal/reset-password?token=${resetToken}`;

    // Fire-and-forget so the response time does not depend on email delivery
    // (which only happens on a hit) and so cannot be used to enumerate accounts.
    void sendPortalResetEmail(email.toLowerCase(), resetLink).catch((err) =>
      console.error('[Portal] Background reset email failed:', err.message),
    );

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

/** Send the portal password-reset email. Mirrors sendRecoveryEmail() in
 *  auth.js — if SendGrid is not configured we log a warning (without the
 *  token) and return silently so the caller still gets the generic
 *  "If an account exists…" response. A SendGrid failure is logged but
 *  also swallowed to keep enumeration protection intact. */
async function sendPortalResetEmail(toEmail, resetLink) {
  const subject = 'Reset your Members Portal password';
  const body = `A password reset was requested for your Members Portal account.

Use the link below to choose a new password. The link expires in one hour.

${resetLink}

If you did not request this, you can ignore this email.`;

  if (!process.env.SENDGRID_API_KEY) {
    console.warn(
      `[Portal] SendGrid not configured — cannot deliver password reset email to ${toEmail}. ` +
        `Set SENDGRID_API_KEY to enable portal reset emails.`,
    );
    return;
  }

  try {
    await sgMail.send({
      to: toEmail,
      from: PORTAL_FROM,
      subject,
      text: body,
    });
  } catch (err) {
    // Never include the reset link in the error log.
    console.error(`[Portal] Failed to send password reset email to ${toEmail}:`, err.message);
  }
}

/** Send the portal email-verification link (registration + email change).
 *  Mirrors sendPortalResetEmail() — if SendGrid is not configured we log a
 *  warning (without the token) and return silently rather than emitting the
 *  link to stdout. */
async function sendPortalVerificationEmail(toEmail, verifyLink) {
  const subject = 'Verify your Members Portal account';
  const body = `Please verify your Members Portal email address.

Use the link below to confirm your account. The link expires in one hour.

${verifyLink}

If you did not request this, you can ignore this email.`;

  if (!process.env.SENDGRID_API_KEY) {
    console.warn(
      `[Portal] SendGrid not configured — cannot deliver verification email to ${toEmail}. ` +
        `Set SENDGRID_API_KEY to enable portal verification emails.`,
    );
    return;
  }

  try {
    await sgMail.send({ to: toEmail, from: PORTAL_FROM, subject, text: body });
  } catch (err) {
    // Never include the verification link in the error log.
    console.error(`[Portal] Failed to send verification email to ${toEmail}:`, err.message);
  }
}

// ─── POST /:slug/portal/reset-password ──────────────────────────────────

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

router.post('/:slug/portal/reset-password', portalAuthLimiter, async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const { token, password } = resetPasswordSchema.parse(req.body);

    const [member] = await tenantQuery(
      slug,
      `SELECT id, portal_reset_expires
       FROM members
       WHERE portal_reset_token = $1`,
      [hashOpaqueToken(token)],
    );

    if (!member) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }

    if (new Date() > new Date(member.portal_reset_expires)) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const passwordHash = await hashPassword(password);

    await tenantQuery(
      slug,
      `UPDATE members SET
         portal_password_hash = $1,
         portal_email_verified = true,
         portal_reset_token = NULL,
         portal_reset_expires = NULL,
         updated_at = now()
       WHERE id = $2`,
      [passwordHash, member.id],
    );

    // Invalidate any existing portal sessions for this member.
    await invalidateUserSessions(slug, member.id);

    res.json({ message: 'Password has been reset successfully. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

export default router;
