// beacon2/backend/src/routes/public.js
// Public (unauthenticated) routes for online joining and Members Portal.
// All routes are tenant-scoped via the :slug path parameter.

import { Router } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma, tenantQuery, withTenant } from '../utils/db.js';
import { hashPassword, verifyPassword, generateToken } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { resolveTokens } from '../utils/emailTokens.js';
import { initiatePayment, verifyPaymentNotification } from '../utils/paypal.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// ─── Middleware: resolve tenant from slug ────────────────────────────────

async function resolveTenant(req, res, next) {
  const { slug } = req.params;
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Invalid tenant slug.' });
  }
  try {
    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    if (!tenant || !tenant.active) {
      return res.status(404).json({ error: 'Organisation not found.' });
    }
    req.tenant = tenant;
    req.tenantSlug = slug;
    next();
  } catch (err) {
    next(err);
  }
}

router.use('/:slug', resolveTenant);

// ─── GET /:slug/join-config ─────────────────────────────────────────────
// Returns configuration needed to render the online joining form.

router.get('/:slug/join-config', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const [settings] = await tenantQuery(
      slug,
      `SELECT online_joining_enabled, privacy_policy_url,
              gift_aid_enabled, paypal_email, default_town, default_county,
              online_join_email, online_renew_email
       FROM tenant_settings WHERE id = 'singleton'`,
    );

    if (!settings?.online_joining_enabled) {
      return res.status(403).json({
        error: `Online joining is not enabled for ${req.tenant.name}.`,
        u3aName: req.tenant.name,
      });
    }

    const classes = await tenantQuery(
      slug,
      `SELECT id, name, explanation, fee::float AS fee, is_joint, is_associate
       FROM member_classes
       WHERE show_online = true AND current = true
       ORDER BY name`,
    );

    res.json({
      u3aName:            req.tenant.name,
      privacyPolicyUrl:   settings.privacy_policy_url ?? '',
      giftAidEnabled:     settings.gift_aid_enabled ?? false,
      defaultTown:        settings.default_town ?? '',
      defaultCounty:      settings.default_county ?? '',
      onlineJoinEmail:    settings.online_join_email ?? '',
      onlineRenewEmail:   settings.online_renew_email ?? '',
      classes,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/join ───────────────────────────────────────────────────
// Submit an online joining application.
// Creates member record with Applicant status, then initiates PayPal payment.

const joinSchema = z.object({
  classId:     z.string().min(1),
  title:       z.string().max(20).optional(),
  forenames:   z.string().min(1).max(100),
  surname:     z.string().min(1).max(100),
  email:       z.string().email(),
  mobile:      z.string().max(30).optional(),
  address: z.object({
    houseNo:   z.string().optional(),
    street:    z.string().optional(),
    town:      z.string().optional(),
    county:    z.string().optional(),
    postcode:  z.string().min(1, 'Postcode is required'),
    telephone: z.string().optional(),
  }),
  giftAid:     z.boolean().default(false),
});

router.post('/:slug/join', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const data = joinSchema.parse(req.body);

    // Verify online joining is enabled
    const [settings] = await tenantQuery(
      slug,
      `SELECT online_joining_enabled, paypal_email, paypal_cancel_url,
              gift_aid_enabled, year_start_month, year_start_day
       FROM tenant_settings WHERE id = 'singleton'`,
    );

    if (!settings?.online_joining_enabled) {
      return res.status(403).json({ error: `Online joining is not enabled for ${req.tenant.name}.` });
    }

    // Verify the class is valid and available online
    const [cls] = await tenantQuery(
      slug,
      `SELECT id, name, fee::float AS fee, show_online, current
       FROM member_classes WHERE id = $1`,
      [data.classId],
    );
    if (!cls || !cls.show_online || !cls.current) {
      return res.status(400).json({ error: 'Invalid membership class.' });
    }

    // Find or create the Applicant status
    let [applicantStatus] = await tenantQuery(
      slug,
      `SELECT id FROM member_statuses WHERE name = 'Applicant'`,
    );
    if (!applicantStatus) {
      [applicantStatus] = await tenantQuery(
        slug,
        `INSERT INTO member_statuses (name) VALUES ('Applicant') RETURNING id`,
      );
    }

    // Create address
    const addr = data.address;
    const [newAddr] = await tenantQuery(
      slug,
      `INSERT INTO addresses (house_no, street, town, county, postcode, telephone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        addr.houseNo ?? null, addr.street ?? null,
        addr.town ?? null, addr.county ?? null,
        addr.postcode.trim().toUpperCase(), addr.telephone ?? null,
      ],
    );

    // Compute next_renewal
    const now = new Date();
    const joinedOn = now.toISOString().slice(0, 10);
    const ysm = settings.year_start_month ?? 1;
    const ysd = settings.year_start_day ?? 1;
    let renewalYear = now.getFullYear();
    const yearStart = new Date(renewalYear, ysm - 1, ysd);
    if (now >= yearStart) renewalYear++;
    const nextRenewal = `${renewalYear}-${String(ysm).padStart(2, '0')}-${String(ysd).padStart(2, '0')}`;

    // Derive initials
    const initials = data.forenames.split(/\s+/).map(n => n[0]?.toUpperCase()).filter(Boolean).join('');

    // Set gift_aid_from if opted in and enabled
    const giftAidFrom = (data.giftAid && settings.gift_aid_enabled) ? joinedOn : null;

    // Generate a payment token so the applicant can resume payment later
    const paymentToken = randomBytes(24).toString('hex');

    // Create member with Applicant status
    const [member] = await tenantQuery(
      slug,
      `INSERT INTO members
         (title, forenames, surname, initials, email, mobile,
          address_id, status_id, class_id, joined_on, next_renewal, gift_aid_from,
          payment_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::date, $12::date, $13)
       RETURNING id, membership_number, forenames, surname, email`,
      [
        data.title ?? null, data.forenames, data.surname, initials,
        data.email.toLowerCase(), data.mobile ?? null,
        newAddr.id, applicantStatus.id, data.classId,
        joinedOn, nextRenewal, giftAidFrom,
        paymentToken,
      ],
    );

    logAudit(slug, {
      userId: null, userName: `${data.forenames} ${data.surname} (online)`,
      action: 'create', entityType: 'member',
      entityId: member.id, entityName: `${data.forenames} ${data.surname}`,
      detail: 'Online joining application',
    });

    // Initiate PayPal payment (stub)
    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const returnUrl = `${frontendBase}/public/${slug}/join-complete`;
    const cancelUrl = settings.paypal_cancel_url || `${frontendBase}/public/${slug}/join`;

    const { paymentId, redirectUrl } = await initiatePayment({
      amount:      cls.fee ?? 0,
      description: `Membership: ${cls.name}`,
      memberRef:   member.id,
      returnUrl,
      cancelUrl,
      paypalEmail: settings.paypal_email,
    });

    res.status(201).json({
      memberId:         member.id,
      membershipNumber: member.membership_number,
      paymentId,
      redirectUrl,
      paymentToken,
      amount:           cls.fee ?? 0,
      className:        cls.name,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/payment-confirm ────────────────────────────────────────
// Called after PayPal payment succeeds (or stub simulates success).
// Updates member status from Applicant to Current and creates finance transaction.

const paymentConfirmSchema = z.object({
  paymentId: z.string().min(1),
  memberId:  z.string().min(1),
});

router.post('/:slug/payment-confirm', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const data = paymentConfirmSchema.parse(req.body);

    // Verify payment (stub always succeeds)
    const verification = await verifyPaymentNotification({
      paymentId: data.paymentId,
      rawBody: req.body,
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Payment verification failed.' });
    }

    // Find the member
    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
              m.title, m.class_id, m.joined_on, m.next_renewal,
              mc.name AS class_name, mc.fee::float AS fee
       FROM members m
       LEFT JOIN member_classes mc ON m.class_id = mc.id
       WHERE m.id = $1`,
      [data.memberId],
    );
    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    // Update status from Applicant to Current, clear payment token
    let [currentStatus] = await tenantQuery(
      slug,
      `SELECT id FROM member_statuses WHERE name ILIKE '%Current%' LIMIT 1`,
    );
    if (currentStatus) {
      await tenantQuery(
        slug,
        `UPDATE members SET status_id = $1, card_printed = false, payment_token = NULL, updated_at = now() WHERE id = $2`,
        [currentStatus.id, member.id],
      );
    }

    // Create finance transaction in PayPal account
    const paypalAmount = member.fee ?? 0;
    if (paypalAmount > 0) {
      // Find or note the PayPal account and Membership category
      const [paypalAcct] = await tenantQuery(
        slug,
        `SELECT id FROM finance_accounts WHERE name ILIKE '%PayPal%' AND active = true LIMIT 1`,
      );
      const [membershipCat] = await tenantQuery(
        slug,
        `SELECT id FROM finance_categories WHERE name = 'Membership' AND active = true LIMIT 1`,
      );

      if (paypalAcct) {
        const memberName = `${member.forenames} ${member.surname}`;
        const [txn] = await tenantQuery(
          slug,
          `INSERT INTO transactions
             (account_id, date, type, from_to, amount, payment_method, detail, member_id_1)
           VALUES ($1, $2::date, 'in', $3, $4::numeric, 'Online', 'New Membership', $5)
           RETURNING id`,
          [paypalAcct.id, member.joined_on, memberName, paypalAmount, member.id],
        );

        if (membershipCat && txn) {
          await tenantQuery(
            slug,
            `INSERT INTO transaction_categories (transaction_id, category_id, amount)
             VALUES ($1, $2, $3::numeric)`,
            [txn.id, membershipCat.id, paypalAmount],
          );
        }
      }
    }

    // Send confirmation email to new member
    await sendJoinConfirmationEmail(slug, member);

    // Send officer notifications
    await sendOfficerNotifications(slug, member);

    logAudit(slug, {
      userId: null, userName: 'System (online payment)',
      action: 'update', entityType: 'member',
      entityId: member.id, entityName: `${member.forenames} ${member.surname}`,
      detail: 'Online joining payment confirmed',
    });

    res.json({ success: true, membershipNumber: member.membership_number });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:slug/resume-payment/:token ────────────────────────────────────
// Looks up an Applicant by payment token and re-initiates payment.
// Returns payment details so the frontend can show a "Resume payment" page.

router.get('/:slug/resume-payment/:token', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const { token } = req.params;

    if (!token || token.length < 10) {
      return res.status(400).json({ error: 'Invalid payment link.' });
    }

    // Find the Applicant member by payment token
    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
              m.class_id, ms.name AS status_name,
              mc.name AS class_name, mc.fee::float AS fee
       FROM members m
       LEFT JOIN member_statuses ms ON m.status_id = ms.id
       LEFT JOIN member_classes mc ON m.class_id = mc.id
       WHERE m.payment_token = $1`,
      [token],
    );

    if (!member) {
      return res.status(404).json({ error: 'This payment link is no longer valid. It may have expired or already been used.' });
    }

    // If member is no longer an Applicant, they've already paid
    if (member.status_name !== 'Applicant') {
      return res.status(400).json({
        error: 'This membership has already been activated. No further payment is needed.',
        membershipNumber: member.membership_number,
      });
    }

    // Re-initiate payment
    const [settings] = await tenantQuery(
      slug,
      `SELECT paypal_email, paypal_cancel_url FROM tenant_settings WHERE id = 'singleton'`,
    );

    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const returnUrl = `${frontendBase}/public/${slug}/join-complete`;
    const cancelUrl = settings?.paypal_cancel_url || `${frontendBase}/public/${slug}/join`;

    const { paymentId, redirectUrl } = await initiatePayment({
      amount:      member.fee ?? 0,
      description: `Membership: ${member.class_name}`,
      memberRef:   member.id,
      returnUrl,
      cancelUrl,
      paypalEmail: settings?.paypal_email,
    });

    res.json({
      memberId:         member.id,
      membershipNumber: member.membership_number,
      forenames:        member.forenames,
      surname:          member.surname,
      email:            member.email,
      className:        member.class_name,
      amount:           member.fee ?? 0,
      paymentId,
      redirectUrl,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/email-payment-link ─────────────────────────────────────
// Sends a "complete your payment" email to the applicant.
// Called from the JoinPending page when the applicant clicks "Email me this link".

const emailPaymentLinkSchema = z.object({
  paymentToken: z.string().min(1),
});

router.post('/:slug/email-payment-link', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const { paymentToken } = emailPaymentLinkSchema.parse(req.body);

    // Find the Applicant member
    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
              ms.name AS status_name,
              mc.name AS class_name
       FROM members m
       LEFT JOIN member_statuses ms ON m.status_id = ms.id
       LEFT JOIN member_classes mc ON m.class_id = mc.id
       WHERE m.payment_token = $1`,
      [paymentToken],
    );

    if (!member || member.status_name !== 'Applicant') {
      return res.status(404).json({ error: 'Application not found or already completed.' });
    }

    if (!member.email) {
      return res.status(400).json({ error: 'No email address on file.' });
    }

    // Build the payment link URL
    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const paymentLink = `${frontendBase}/public/${slug}/resume-payment/${paymentToken}`;

    // Resolve and send the email
    const [template] = await tenantQuery(
      slug,
      `SELECT subject, body FROM system_messages WHERE id = 'online_join_payment_link'`,
    );
    if (!template) {
      return res.status(500).json({ error: 'Payment link email template not found.' });
    }

    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const u3aName = tenant?.name ?? '';

    const [settings] = await tenantQuery(
      slug,
      `SELECT online_join_email FROM tenant_settings WHERE id = 'singleton'`,
    );
    const replyTo = settings?.online_join_email || null;

    const { subject, body } = resolveTokens(
      template.subject, template.body,
      { ...member, class_name: member.class_name }, u3aName,
      { '#PAYMENTLINK': paymentLink },
    );

    // In production, this would call SendGrid
    console.log(`[Online Join] Would send payment link email to ${member.email}: "${subject}"${replyTo ? ` (reply-to: ${replyTo})` : ''}`);
    console.log(`[Online Join] Payment link: ${paymentLink}`);

    res.json({ message: 'Payment link has been sent to your email address.' });
  } catch (err) {
    next(err);
  }
});

// ─── Email helpers ──────────────────────────────────────────────────────

async function sendJoinConfirmationEmail(slug, member) {
  try {
    const [template] = await tenantQuery(
      slug,
      `SELECT subject, body FROM system_messages WHERE id = 'online_join_confirm'`,
    );
    if (!template || !member.email) return;

    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const u3aName = tenant?.name ?? '';

    // Use online_join_email as reply-to so members can contact the u3a
    const [settings] = await tenantQuery(
      slug,
      `SELECT online_join_email FROM tenant_settings WHERE id = 'singleton'`,
    );
    const replyTo = settings?.online_join_email || null;

    const { subject, body } = resolveTokens(
      template.subject, template.body,
      { ...member, class_name: member.class_name }, u3aName,
    );

    // In production, this would call SendGrid.
    // For now, log the email that would be sent.
    console.log(`[Online Join] Would send confirmation email to ${member.email}: "${subject}"${replyTo ? ` (reply-to: ${replyTo})` : ''}`);
  } catch (err) {
    console.error('[Online Join] Failed to send confirmation email:', err.message);
  }
}

async function sendOfficerNotifications(slug, member) {
  try {
    const officers = await tenantQuery(
      slug,
      `SELECT o.office_email, m.email
       FROM offices o
       LEFT JOIN members m ON o.member_id = m.id
       WHERE o.notify_online_join = true`,
    );

    if (officers.length === 0) return;

    const [template] = await tenantQuery(
      slug,
      `SELECT subject, body FROM system_messages WHERE id = 'online_join_officer_notify'`,
    );
    if (!template) return;

    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const u3aName = tenant?.name ?? '';

    const { subject, body } = resolveTokens(
      template.subject, template.body,
      { ...member, class_name: member.class_name }, u3aName,
    );

    for (const officer of officers) {
      const email = officer.office_email || officer.email;
      if (email) {
        console.log(`[Online Join] Would notify officer at ${email}: "${subject}"`);
      }
    }
  } catch (err) {
    console.error('[Online Join] Failed to send officer notifications:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMBERS PORTAL AUTH
// ═══════════════════════════════════════════════════════════════════════════

// ─── POST /:slug/portal/register ────────────────────────────────────────
// Step 1: Verify identity (membership number + forename + surname + postcode + email)
// Step 2: Set portal password and send verification email

const portalRegisterSchema = z.object({
  membershipNumber: z.number().int().positive(),
  forename:         z.string().min(1),
  surname:          z.string().min(1),
  postcode:         z.string().min(1),
  email:            z.string().email(),
  password:         z.string().min(10).max(72).refine(
    (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw),
    { message: 'Password must contain at least one uppercase, one lowercase, and one numeric character.' },
  ),
});

router.post('/:slug/portal/register', async (req, res, next) => {
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
      return res.status(400).json({ error: 'Details do not match our records. Please check and try again.' });
    }

    // Verify each field matches (case-insensitive)
    const forenameMatch = member.forenames?.toLowerCase().startsWith(data.forename.toLowerCase()) ||
                          data.forename.toLowerCase() === member.forenames?.split(' ')[0]?.toLowerCase();
    const surnameMatch  = member.surname?.toLowerCase() === data.surname.toLowerCase();
    const postcodeMatch = member.postcode?.replace(/\s+/g, '').toLowerCase() ===
                          data.postcode.replace(/\s+/g, '').toLowerCase();
    const emailMatch    = member.email?.toLowerCase() === data.email.toLowerCase();

    if (!forenameMatch || !surnameMatch || !postcodeMatch || !emailMatch) {
      return res.status(400).json({ error: 'Details do not match our records. Please check and try again.' });
    }

    if (member.portal_password_hash) {
      return res.status(400).json({ error: 'A portal account already exists for this member. Please sign in instead.' });
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
      [data.email.toLowerCase(), passwordHash, verificationToken, verificationExpires, member.id],
    );

    // In production, send verification email with link
    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const verifyLink = `${frontendBase}/public/${slug}/portal/verify?token=${verificationToken}`;
    console.log(`[Portal] Would send verification email to ${data.email}: ${verifyLink}`);

    logAudit(slug, {
      userId: null, userName: `${data.forename} ${data.surname} (portal)`,
      action: 'create', entityType: 'portal_account',
      entityId: member.id, entityName: `${member.forenames} ${member.surname}`,
    });

    res.json({ message: 'Registration successful. Please check your email to verify your account.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/portal/verify-email ────────────────────────────────────

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

router.post('/:slug/portal/verify-email', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const { token } = verifyEmailSchema.parse(req.body);

    const [member] = await tenantQuery(
      slug,
      `SELECT id, forenames, surname, portal_verification_expires
       FROM members
       WHERE portal_verification_token = $1`,
      [token],
    );

    if (!member) {
      return res.status(400).json({ error: 'Invalid or expired verification link.' });
    }

    if (new Date() > new Date(member.portal_verification_expires)) {
      return res.status(400).json({ error: 'Verification link has expired. Please use Forgotten Password to get a new one.' });
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

    res.json({ message: 'Email verified successfully. You can now sign in to the Members Portal.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/portal/login ───────────────────────────────────────────

const portalLoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

router.post('/:slug/portal/login', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const data = portalLoginSchema.parse(req.body);

    const members = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
              m.portal_password_hash, m.portal_email_verified
       FROM members m
       WHERE m.portal_email = $1 AND m.portal_password_hash IS NOT NULL`,
      [data.email.toLowerCase()],
    );

    if (members.length === 0) {
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
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!authenticatedMember.portal_email_verified) {
      return res.status(403).json({ error: 'Please verify your email address before signing in.' });
    }

    // Issue a portal JWT (different from admin JWT)
    const token = signAccessToken({
      memberId:   authenticatedMember.id,
      tenantSlug: slug,
      name:       `${authenticatedMember.forenames} ${authenticatedMember.surname}`,
      isPortal:   true,
    });

    res.json({
      token,
      member: {
        id:               authenticatedMember.id,
        membershipNumber: authenticatedMember.membership_number,
        name:             `${authenticatedMember.forenames} ${authenticatedMember.surname}`,
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

router.post('/:slug/portal/forgot-password', async (req, res, next) => {
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
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }

    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await tenantQuery(
      slug,
      `UPDATE members SET
         portal_reset_token = $1,
         portal_reset_expires = $2,
         updated_at = now()
       WHERE id = $3`,
      [resetToken, resetExpires, member.id],
    );

    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const resetLink = `${frontendBase}/public/${slug}/portal/reset-password?token=${resetToken}`;
    console.log(`[Portal] Would send password reset email to ${email}: ${resetLink}`);

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/portal/reset-password ──────────────────────────────────

const resetPasswordSchema = z.object({
  token:    z.string().min(1),
  password: z.string().min(10).max(72).refine(
    (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw),
    { message: 'Password must contain at least one uppercase, one lowercase, and one numeric character.' },
  ),
});

router.post('/:slug/portal/reset-password', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const { token, password } = resetPasswordSchema.parse(req.body);

    const [member] = await tenantQuery(
      slug,
      `SELECT id, portal_reset_expires
       FROM members
       WHERE portal_reset_token = $1`,
      [token],
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

    res.json({ message: 'Password has been reset successfully. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

export default router;
