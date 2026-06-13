// beacon2/backend/src/routes/public/join.js
// Online joining and PayPal payment flow: join-config, join, payment-confirm,
// resume-payment, and email-payment-link, plus the join confirmation / officer
// notification email helpers. All routes are tenant-scoped via :slug.

import { Router } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma, tenantQuery } from '../../utils/db.js';
import { hashOpaqueToken } from '../../utils/password.js';
import { resolveTokens } from '../../utils/emailTokens.js';
import { generateSingleCardPdf } from '../membershipCards.js';
import { initiatePayment, verifyPaymentNotification } from '../../utils/paypal.js';
import { isFeatureEnabled } from '../../middleware/requireFeature.js';
import { logAudit } from '../../utils/audit.js';

const router = Router();

// ─── GET /:slug/join-config ─────────────────────────────────────────────
// Returns configuration needed to render the online joining form.

router.get('/:slug/join-config', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    if (!(await isFeatureEnabled(slug, 'onlineJoining'))) {
      return res.status(403).json({
        error: `Online joining is not enabled for ${req.tenant.name}.`,
        u3aName: req.tenant.name,
      });
    }

    const [settings] = await tenantQuery(
      slug,
      `SELECT privacy_policy_url, paypal_email, default_town, default_county,
              online_join_email, online_renew_email
       FROM tenant_settings WHERE id = 'singleton'`,
    );

    const classes = await tenantQuery(
      slug,
      `SELECT id, name, explanation, fee::float AS fee, is_joint, is_associate
       FROM member_classes
       WHERE show_online = true AND current = true
       ORDER BY name`,
    );

    res.json({
      u3aName: req.tenant.name,
      privacyPolicyUrl: settings.privacy_policy_url ?? '',
      giftAidEnabled: await isFeatureEnabled(slug, 'giftAid'),
      defaultTown: settings.default_town ?? '',
      defaultCounty: settings.default_county ?? '',
      onlineJoinEmail: settings.online_join_email ?? '',
      onlineRenewEmail: settings.online_renew_email ?? '',
      classes,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:slug/join ───────────────────────────────────────────────────
// Submit an online joining application.
// Creates member record with Applicant status, then initiates PayPal payment.

const partner2Schema = z.object({
  title: z.string().max(20).optional(),
  forenames: z.string().min(1).max(100),
  surname: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  mobile: z.string().max(30).optional(),
  giftAid: z.boolean().default(false),
});

const joinSchema = z.object({
  classId: z.string().min(1),
  title: z.string().max(20).optional(),
  forenames: z.string().min(1).max(100),
  surname: z.string().min(1).max(100),
  email: z.string().email(),
  mobile: z.string().max(30).optional(),
  address: z.object({
    houseNo: z.string().optional(),
    street: z.string().optional(),
    town: z.string().optional(),
    county: z.string().optional(),
    postcode: z.string().min(1, 'Postcode is required'),
    telephone: z.string().optional(),
  }),
  giftAid: z.boolean().default(false),
  partner2: partner2Schema.optional(),
});

router.post('/:slug/join', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const data = joinSchema.parse(req.body);

    // Verify online joining is enabled
    if (!(await isFeatureEnabled(slug, 'onlineJoining'))) {
      return res
        .status(403)
        .json({ error: `Online joining is not enabled for ${req.tenant.name}.` });
    }

    const [settings] = await tenantQuery(
      slug,
      `SELECT paypal_email, paypal_cancel_url,
              year_start_month, year_start_day
       FROM tenant_settings WHERE id = 'singleton'`,
    );

    // Verify the class is valid and available online
    const [cls] = await tenantQuery(
      slug,
      `SELECT id, name, fee::float AS fee, show_online, current, is_joint
       FROM member_classes WHERE id = $1`,
      [data.classId],
    );
    if (!cls || !cls.show_online || !cls.current) {
      return res.status(400).json({ error: 'Invalid membership class.' });
    }

    // If class is joint, partner2 data is required
    if (cls.is_joint && !data.partner2) {
      return res
        .status(400)
        .json({ error: 'Joint membership requires details for the second person.' });
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
        addr.houseNo ?? null,
        addr.street ?? null,
        addr.town ?? null,
        addr.county ?? null,
        addr.postcode.trim().toUpperCase(),
        addr.telephone ?? null,
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
    const initials = data.forenames
      .split(/\s+/)
      .map((n) => n[0]?.toUpperCase())
      .filter(Boolean)
      .join('');

    // Set gift_aid_from if opted in and enabled
    const giftAidEnabled = await isFeatureEnabled(slug, 'giftAid');
    const giftAidFrom = data.giftAid && giftAidEnabled ? joinedOn : null;

    // Generate a payment token so the applicant can resume payment later.
    // Only the hash is persisted; the plaintext is returned below to embed
    // in the resume-payment link emailed to the applicant.
    const paymentToken = randomBytes(24).toString('hex');
    const paymentTokenHash = hashOpaqueToken(paymentToken);

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
        data.title ?? null,
        data.forenames,
        data.surname,
        initials,
        data.email.toLowerCase(),
        data.mobile ?? null,
        newAddr.id,
        applicantStatus.id,
        data.classId,
        joinedOn,
        nextRenewal,
        giftAidFrom,
        paymentTokenHash,
      ],
    );

    logAudit(slug, {
      userId: null,
      userName: `${data.forenames} ${data.surname} (online)`,
      action: 'create',
      entityType: 'member',
      entityId: member.id,
      entityName: `${data.forenames} ${data.surname}`,
      detail: 'Online joining application',
    });

    // ── Joint membership: create second member linked at same address ──
    let partner2Result = null;
    if (cls.is_joint && data.partner2) {
      const p2 = data.partner2;
      const p2Initials = p2.forenames
        .split(/\s+/)
        .map((n) => n[0]?.toUpperCase())
        .filter(Boolean)
        .join('');
      const p2Email = p2.email ? p2.email.toLowerCase() : null;
      const p2GiftAidFrom = p2.giftAid && giftAidEnabled ? joinedOn : null;

      const [partner] = await tenantQuery(
        slug,
        `INSERT INTO members
           (title, forenames, surname, initials, email, mobile,
            address_id, status_id, class_id, joined_on, next_renewal, gift_aid_from,
            payment_token, partner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::date, $12::date, $13, $14)
         RETURNING id, membership_number, forenames, surname`,
        [
          p2.title ?? null,
          p2.forenames,
          p2.surname,
          p2Initials,
          p2Email,
          p2.mobile ?? null,
          newAddr.id,
          applicantStatus.id,
          data.classId,
          joinedOn,
          nextRenewal,
          p2GiftAidFrom,
          paymentTokenHash,
          member.id,
        ],
      );

      // Set primary member's partner_id (bi-directional link)
      await tenantQuery(
        slug,
        `UPDATE members SET partner_id = $1, updated_at = now() WHERE id = $2`,
        [partner.id, member.id],
      );

      partner2Result = {
        memberId: partner.id,
        membershipNumber: partner.membership_number,
        forenames: p2.forenames,
        surname: p2.surname,
      };

      logAudit(slug, {
        userId: null,
        userName: `${p2.forenames} ${p2.surname} (online)`,
        action: 'create',
        entityType: 'member',
        entityId: partner.id,
        entityName: `${p2.forenames} ${p2.surname}`,
        detail: 'Online joining application (joint partner)',
      });
    }

    // Compute total payment amount (doubled for joint)
    const totalAmount = cls.is_joint ? (cls.fee ?? 0) * 2 : (cls.fee ?? 0);

    // Initiate PayPal payment (stub)
    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const returnUrl = `${frontendBase}/public/${slug}/join-complete`;
    const cancelUrl = settings.paypal_cancel_url || `${frontendBase}/public/${slug}/join`;

    const { paymentId, redirectUrl } = await initiatePayment({
      amount: totalAmount,
      description: cls.is_joint ? `Joint Membership: ${cls.name} (×2)` : `Membership: ${cls.name}`,
      memberRef: member.id,
      returnUrl,
      cancelUrl,
      paypalEmail: settings.paypal_email,
    });

    res.status(201).json({
      memberId: member.id,
      membershipNumber: member.membership_number,
      paymentId,
      redirectUrl,
      paymentToken,
      amount: totalAmount,
      className: cls.name,
      partner2: partner2Result,
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
  memberId: z.string().min(1),
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

    // Find the member (include partner and joint info)
    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
              m.title, m.class_id, m.joined_on, m.next_renewal, m.partner_id,
              mc.name AS class_name, mc.fee::float AS fee, mc.is_joint
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

      // Also promote the joint partner if present
      if (member.partner_id && member.is_joint) {
        await tenantQuery(
          slug,
          `UPDATE members SET status_id = $1, card_printed = false, payment_token = NULL, updated_at = now() WHERE id = $2`,
          [currentStatus.id, member.partner_id],
        );
      }
    }

    // Compute total payment amount (doubled for joint)
    const perPersonFee = member.fee ?? 0;
    const paypalAmount = member.is_joint ? perPersonFee * 2 : perPersonFee;

    // Create finance transaction in PayPal account
    if (paypalAmount > 0) {
      const [paypalAcct] = await tenantQuery(
        slug,
        `SELECT id FROM finance_accounts WHERE name ILIKE '%PayPal%' AND active = true LIMIT 1`,
      );
      const [membershipCat] = await tenantQuery(
        slug,
        `SELECT id FROM finance_categories WHERE name = 'Membership' AND active = true LIMIT 1`,
      );

      if (paypalAcct) {
        // For joint: include both members on the transaction
        let partnerForTxn = null;
        if (member.partner_id && member.is_joint) {
          [partnerForTxn] = await tenantQuery(
            slug,
            `SELECT id, forenames, surname FROM members WHERE id = $1`,
            [member.partner_id],
          );
        }

        const memberName = partnerForTxn
          ? `${member.forenames} ${member.surname} & ${partnerForTxn.forenames} ${partnerForTxn.surname}`
          : `${member.forenames} ${member.surname}`;

        const detail = member.is_joint ? 'New Joint Membership' : 'New Membership';

        const txnParams = [
          paypalAcct.id,
          member.joined_on,
          memberName,
          paypalAmount,
          detail,
          member.id,
        ];
        let memberIdCols = 'member_id_1';
        let memberIdVals = '$6';
        if (partnerForTxn) {
          memberIdCols += ', member_id_2';
          memberIdVals += ', $7';
          txnParams.push(partnerForTxn.id);
        }

        const [txn] = await tenantQuery(
          slug,
          `INSERT INTO transactions
             (account_id, date, type, from_to, amount, payment_method, detail, ${memberIdCols})
           VALUES ($1, $2::date, 'in', $3, $4::numeric, 'Online', $5, ${memberIdVals})
           RETURNING id`,
          txnParams,
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

    // Send confirmation email to joint partner if applicable
    if (member.partner_id && member.is_joint) {
      const [partner] = await tenantQuery(
        slug,
        `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
                m.title, m.class_id, m.joined_on, m.next_renewal,
                mc.name AS class_name
         FROM members m
         LEFT JOIN member_classes mc ON m.class_id = mc.id
         WHERE m.id = $1`,
        [member.partner_id],
      );
      if (partner) await sendJoinConfirmationEmail(slug, partner);
    }

    // Send officer notifications
    await sendOfficerNotifications(slug, member);

    logAudit(slug, {
      userId: null,
      userName: 'System (online payment)',
      action: 'update',
      entityType: 'member',
      entityId: member.id,
      entityName: `${member.forenames} ${member.surname}`,
      detail: member.is_joint
        ? 'Online joining payment confirmed (joint membership)'
        : 'Online joining payment confirmed',
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

    // Find the Applicant member by payment token (either primary or partner may hold it).
    // payment_token is stored as either sha256(token) or sha256(token)|<base64-meta>
    // for portal renewals; match either form.
    const tokenHash = hashOpaqueToken(token);
    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
              m.class_id, m.partner_id, ms.name AS status_name,
              mc.name AS class_name, mc.fee::float AS fee, mc.is_joint
       FROM members m
       LEFT JOIN member_statuses ms ON m.status_id = ms.id
       LEFT JOIN member_classes mc ON m.class_id = mc.id
       WHERE m.payment_token = $1
          OR substr(m.payment_token, 1, 64) = $1`,
      [tokenHash],
    );

    if (!member) {
      return res.status(404).json({
        error: 'This payment link is no longer valid. It may have expired or already been used.',
      });
    }

    // If member is no longer an Applicant, they've already paid
    if (member.status_name !== 'Applicant') {
      return res.status(400).json({
        error: 'This membership has already been activated. No further payment is needed.',
        membershipNumber: member.membership_number,
      });
    }

    // Look up joint partner if applicable
    let partner2 = null;
    if (member.partner_id && member.is_joint) {
      const [p] = await tenantQuery(
        slug,
        `SELECT id, membership_number, forenames, surname FROM members WHERE id = $1`,
        [member.partner_id],
      );
      if (p) {
        partner2 = {
          memberId: p.id,
          membershipNumber: p.membership_number,
          forenames: p.forenames,
          surname: p.surname,
        };
      }
    }

    // Compute total amount (doubled for joint)
    const totalAmount = member.is_joint ? (member.fee ?? 0) * 2 : (member.fee ?? 0);

    // Re-initiate payment
    const [settings] = await tenantQuery(
      slug,
      `SELECT paypal_email, paypal_cancel_url FROM tenant_settings WHERE id = 'singleton'`,
    );

    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const returnUrl = `${frontendBase}/public/${slug}/join-complete`;
    const cancelUrl = settings?.paypal_cancel_url || `${frontendBase}/public/${slug}/join`;

    const { paymentId, redirectUrl } = await initiatePayment({
      amount: totalAmount,
      description: member.is_joint
        ? `Joint Membership: ${member.class_name} (×2)`
        : `Membership: ${member.class_name}`,
      memberRef: member.id,
      returnUrl,
      cancelUrl,
      paypalEmail: settings?.paypal_email,
    });

    res.json({
      memberId: member.id,
      membershipNumber: member.membership_number,
      forenames: member.forenames,
      surname: member.surname,
      email: member.email,
      className: member.class_name,
      amount: totalAmount,
      paymentId,
      redirectUrl,
      partner2,
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

    // Find the Applicant member (match against hashed payment_token, with or
    // without the portal-renewal metadata suffix).
    const paymentTokenHash = hashOpaqueToken(paymentToken);
    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
              ms.name AS status_name,
              mc.name AS class_name
       FROM members m
       LEFT JOIN member_statuses ms ON m.status_id = ms.id
       LEFT JOIN member_classes mc ON m.class_id = mc.id
       WHERE m.payment_token = $1
          OR substr(m.payment_token, 1, 64) = $1`,
      [paymentTokenHash],
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

    const { subject } = resolveTokens(
      template.subject,
      template.body,
      { ...member, class_name: member.class_name },
      u3aName,
      { '#PAYMENTLINK': paymentLink },
    );

    // In production, this would call SendGrid
    console.log(
      `[Online Join] Would send payment link email to ${member.email}: "${subject}"${replyTo ? ` (reply-to: ${replyTo})` : ''}`,
    );
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
      `SELECT online_join_email, email_cards FROM tenant_settings WHERE id = 'singleton'`,
    );
    const replyTo = settings?.online_join_email || null;

    const { subject } = resolveTokens(
      template.subject,
      template.body,
      { ...member, class_name: member.class_name },
      u3aName,
    );

    // Build attachment list — attach membership card PDF when email_cards is enabled
    const attachments = [];
    if (settings?.email_cards && member.id) {
      try {
        const { pdfBuffer, filename } = await generateSingleCardPdf(slug, member.id);
        attachments.push({
          content: pdfBuffer.toString('base64'),
          filename,
          type: 'application/pdf',
          disposition: 'attachment',
        });
      } catch (cardErr) {
        console.error('[Online Join] Failed to generate card PDF for attachment:', cardErr.message);
      }
    }

    // In production, this would call SendGrid with the msg object below.
    // For now, log the email that would be sent.
    // const msg = {
    //   to:          { email: member.email, name: `${member.forenames} ${member.surname}`.trim() },
    //   from:        { email: FROM_ADDRESS, name: u3aName },
    //   replyTo:     replyTo ? { email: replyTo, name: u3aName } : undefined,
    //   subject,
    //   text:        body,
    //   attachments: attachments.length > 0 ? attachments : undefined,
    // };
    // await sgMail.send(msg);
    console.log(
      `[Online Join] Would send confirmation email to ${member.email}: "${subject}"${replyTo ? ` (reply-to: ${replyTo})` : ''}${attachments.length ? ` [+${attachments.length} attachment(s): ${attachments.map((a) => a.filename).join(', ')}]` : ''}`,
    );
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

    const { subject } = resolveTokens(
      template.subject,
      template.body,
      { ...member, class_name: member.class_name },
      u3aName,
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

export default router;
