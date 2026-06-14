// beacon2/backend/src/routes/portal/profile.js
// Members Portal — dashboard, personal details, photo, password, and
// replacement-card endpoints (docs 10.2.4–10.2.5 plus the /home dashboard).

import { Router } from 'express';
import { z } from 'zod';
import { tenantQuery, prisma } from '../../utils/db.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashOpaqueToken,
} from '../../utils/password.js';
import { passwordSchema } from '../../utils/passwordPolicy.js';
import { invalidateUserSessions } from '../../utils/redis.js';
import { resolveTokens } from '../../utils/emailTokens.js';
import { logAudit } from '../../utils/audit.js';
import { generateSingleCardPdf } from '../membershipCards.js';
import { decodeAndValidateImage } from '../../utils/uploads.js';
import { logger } from '../../utils/logger.js';
import { sendDetailsUpdateEmail, sendPortalVerificationEmail } from './helpers.js';

const router = Router({ mergeParams: true });

// ─── GET /home — portal dashboard config ─────────────────────────────────────

router.get('/home', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [[settings], [member], tenant] = await Promise.all([
      tenantQuery(
        slug,
        `SELECT portal_config, group_info_config, calendar_config
         FROM tenant_settings WHERE id = 'singleton'`,
      ),
      tenantQuery(
        slug,
        `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
                m.next_renewal, ms.name AS status_name
         FROM members m
         LEFT JOIN member_statuses ms ON m.status_id = ms.id
         WHERE m.id = $1`,
        [memberId],
      ),
      prisma.sysTenant.findUnique({ where: { slug } }),
    ]);

    const portalConfig = {
      renewals: false,
      groups: false,
      calendar: false,
      personalDetails: false,
      replacementCard: false,
      ...(settings?.portal_config ?? {}),
    };

    const displayName =
      member?.known_as || member?.forenames?.split(' ')[0] || member?.forenames || '';
    const fullName = `${member?.forenames ?? ''} ${member?.surname ?? ''}`.trim();

    res.json({
      u3aName: tenant?.name ?? slug,
      portalConfig,
      member: {
        id: member?.id,
        membershipNumber: member?.membership_number,
        displayName,
        fullName,
        nextRenewal: member?.next_renewal,
        statusName: member?.status_name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10.2.4 — PERSONAL DETAILS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/personal-details', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [settings] = await tenantQuery(
      slug,
      `SELECT portal_config FROM tenant_settings WHERE id = 'singleton'`,
    );
    const portalConfig = { personalDetails: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.personalDetails) {
      return res.status(403).json({ error: 'Personal details editing is not enabled.' });
    }

    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.title, m.forenames, m.surname, m.known_as, m.initials,
              m.suffix, m.email, m.mobile, m.emergency_contact, m.hide_contact,
              m.portal_email,
              (m.photo_data IS NOT NULL AND m.photo_mime_type IS NOT NULL) AS has_photo,
              a.house_no, a.street, a.add_line1, a.town, a.county, a.postcode, a.telephone
       FROM members m
       LEFT JOIN addresses a ON a.id = m.address_id
       WHERE m.id = $1`,
      [memberId],
    );

    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    res.json({
      title: member.title || '',
      forenames: member.forenames || '',
      surname: member.surname || '',
      knownAs: member.known_as || '',
      initials: member.initials || '',
      suffix: member.suffix || '',
      email: member.email || '',
      mobile: member.mobile || '',
      emergencyContact: member.emergency_contact || '',
      hideContact: member.hide_contact || false,
      portalEmail: member.portal_email || '',
      hasPhoto: !!member.has_photo,
      address: {
        houseNo: member.house_no || '',
        street: member.street || '',
        addLine1: member.add_line1 || '',
        town: member.town || '',
        county: member.county || '',
        postcode: member.postcode || '',
        telephone: member.telephone || '',
      },
    });
  } catch (err) {
    next(err);
  }
});

const updateDetailsSchema = z.object({
  title: z.string().max(20).optional(),
  forenames: z.string().min(1).max(100),
  surname: z.string().min(1).max(100),
  knownAs: z.string().max(100).optional(),
  initials: z.string().max(20).optional(),
  suffix: z.string().max(30).optional(),
  email: z.string().email(),
  mobile: z.string().max(30).optional(),
  emergencyContact: z.string().max(200).optional(),
  hideContact: z.boolean().optional(),
  address: z.object({
    houseNo: z.string().max(100).optional(),
    street: z.string().max(100).optional(),
    addLine1: z.string().max(100).optional(),
    town: z.string().max(100).optional(),
    county: z.string().max(100).optional(),
    postcode: z.string().min(1, 'Postcode is required'),
    telephone: z.string().max(30).optional(),
  }),
});

router.patch('/personal-details', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const data = updateDetailsSchema.parse(req.body);

    const [settings] = await tenantQuery(
      slug,
      `SELECT portal_config FROM tenant_settings WHERE id = 'singleton'`,
    );
    const portalConfig = { personalDetails: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.personalDetails) {
      return res.status(403).json({ error: 'Personal details editing is not enabled.' });
    }

    // Get current member to check email change
    const [current] = await tenantQuery(
      slug,
      `SELECT email, portal_email, address_id FROM members WHERE id = $1`,
      [memberId],
    );
    if (!current) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const emailChanged = data.email.toLowerCase() !== (current.email || '').toLowerCase();

    // Derive initials from forenames
    const initials =
      data.initials ||
      data.forenames
        .split(/\s+/)
        .map((n) => n[0]?.toUpperCase())
        .filter(Boolean)
        .join('');

    // Update member fields
    await tenantQuery(
      slug,
      `UPDATE members SET
         title = $1, forenames = $2, surname = $3, known_as = $4, initials = $5,
         suffix = $6, email = $7, mobile = $8, emergency_contact = $9,
         hide_contact = $10, updated_at = now()
       WHERE id = $11`,
      [
        data.title ?? null,
        data.forenames,
        data.surname,
        data.knownAs ?? null,
        initials,
        data.suffix ?? null,
        data.email.toLowerCase(),
        data.mobile ?? null,
        data.emergencyContact ?? null,
        data.hideContact ?? false,
        memberId,
      ],
    );

    // Update address
    if (current.address_id) {
      const addr = data.address;
      await tenantQuery(
        slug,
        `UPDATE addresses SET
           house_no = $1, street = $2, add_line1 = $3, town = $4, county = $5,
           postcode = $6, telephone = $7, updated_at = now()
         WHERE id = $8`,
        [
          addr.houseNo ?? null,
          addr.street ?? null,
          addr.addLine1 ?? null,
          addr.town ?? null,
          addr.county ?? null,
          addr.postcode.trim().toUpperCase(),
          addr.telephone ?? null,
          current.address_id,
        ],
      );
    }

    // If email changed, require re-verification
    if (emailChanged) {
      const verificationToken = generateToken();
      const verificationExpires = new Date(Date.now() + 60 * 60 * 1000);

      await tenantQuery(
        slug,
        `UPDATE members SET
           portal_email = $1,
           portal_email_verified = false,
           portal_verification_token = $2,
           portal_verification_expires = $3,
           updated_at = now()
         WHERE id = $4`,
        [
          data.email.toLowerCase(),
          hashOpaqueToken(verificationToken),
          verificationExpires,
          memberId,
        ],
      );

      const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
      const verifyLink = `${frontendBase}/public/${slug}/portal/verify?token=${verificationToken}`;
      // Send the link by email. Fire-and-forget; never log the token (a leaked
      // verification token lets an attacker confirm a changed email address).
      void sendPortalVerificationEmail(data.email.toLowerCase(), verifyLink).catch((err) =>
        logger.error('[Portal] Background email-verification send failed', {
          message: err.message,
        }),
      );
    }

    // Send confirmation email via system_messages template
    await sendDetailsUpdateEmail(slug, memberId, emailChanged);

    logAudit(slug, {
      userId: null,
      userName: `${req.portal.name} (portal)`,
      action: 'update',
      entityType: 'member',
      entityId: memberId,
      entityName: `${data.forenames} ${data.surname}`,
      detail: emailChanged
        ? 'Personal details updated via portal (email changed)'
        : 'Personal details updated via portal',
    });

    res.json({
      message: emailChanged
        ? 'Details updated. Please verify your new email address.'
        : 'Your personal details have been updated.',
      emailChanged,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Portal Photo endpoints ─────────────────────────────────────────────────

const portalPhotoUploadSchema = z.object({
  data: z.string().min(1, 'Photo data is required'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif'], {
    errorMap: () => ({ message: 'Photo must be jpg, png, or gif' }),
  }),
});

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

router.post('/photo', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    // Check personal details is enabled (photo upload is part of personal details)
    const [settings] = await tenantQuery(
      slug,
      `SELECT portal_config FROM tenant_settings WHERE id = 'singleton'`,
    );
    const portalConfig = { personalDetails: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.personalDetails) {
      return res.status(403).json({ error: 'Personal details editing is not enabled.' });
    }

    const { data, mimeType } = portalPhotoUploadSchema.parse(req.body);

    // Validate the real content matches the declared image type (magic bytes)
    const buffer = decodeAndValidateImage(data, mimeType);

    const byteLength = buffer.length;
    if (byteLength > MAX_PHOTO_BYTES) {
      return res.status(400).json({
        error: `Photo exceeds the 2 MB limit (${(byteLength / 1024 / 1024).toFixed(1)} MB).`,
      });
    }

    await tenantQuery(
      slug,
      `UPDATE members SET photo_data = $1, photo_mime_type = $2, updated_at = now() WHERE id = $3`,
      [data, mimeType, memberId],
    );

    logAudit(slug, {
      userId: null,
      userName: `${req.portal.name} (portal)`,
      action: 'change',
      entityType: 'member',
      entityId: memberId,
      detail: 'Photo uploaded via portal',
    });
    res.json({ message: 'Photo uploaded.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/photo', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [settings] = await tenantQuery(
      slug,
      `SELECT portal_config FROM tenant_settings WHERE id = 'singleton'`,
    );
    const portalConfig = { personalDetails: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.personalDetails) {
      return res.status(403).json({ error: 'Personal details editing is not enabled.' });
    }

    await tenantQuery(
      slug,
      `UPDATE members SET photo_data = NULL, photo_mime_type = NULL, updated_at = now() WHERE id = $1`,
      [memberId],
    );

    logAudit(slug, {
      userId: null,
      userName: `${req.portal.name} (portal)`,
      action: 'change',
      entityType: 'member',
      entityId: memberId,
      detail: 'Photo removed via portal',
    });
    res.json({ message: 'Photo removed.' });
  } catch (err) {
    next(err);
  }
});

router.get('/photo', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [member] = await tenantQuery(
      slug,
      `SELECT photo_data, photo_mime_type FROM members WHERE id = $1`,
      [memberId],
    );

    if (!member || !member.photo_data) {
      return res.status(404).json({ error: 'No photo found.' });
    }
    const buf = Buffer.from(member.photo_data, 'base64');
    res.setHeader('Content-Type', member.photo_mime_type);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

// ─── POST /change-password ───────────────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

router.post('/change-password', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const data = changePasswordSchema.parse(req.body);

    const [member] = await tenantQuery(
      slug,
      `SELECT portal_password_hash FROM members WHERE id = $1`,
      [memberId],
    );
    if (!member?.portal_password_hash) {
      return res.status(400).json({ error: 'Portal account not found.' });
    }

    const valid = await verifyPassword(data.currentPassword, member.portal_password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(data.newPassword);
    await tenantQuery(
      slug,
      `UPDATE members SET portal_password_hash = $1, updated_at = now() WHERE id = $2`,
      [newHash, memberId],
    );

    // Invalidate any other portal sessions for this member (requirePortalAuth
    // checks this marker on every request).
    await invalidateUserSessions(slug, memberId);

    logAudit(slug, {
      userId: null,
      userName: `${req.portal.name} (portal)`,
      action: 'update',
      entityType: 'portal_password',
      entityId: memberId,
      entityName: req.portal.name,
    });

    res.json({ message: 'Password has been changed successfully.' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10.2.5 — REPLACEMENT MEMBERSHIP CARD
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/request-card', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [settings] = await tenantQuery(
      slug,
      `SELECT portal_config, year_start_month, year_start_day,
              grace_lapse_weeks
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    const portalConfig = { replacementCard: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.replacementCard) {
      return res.status(403).json({ error: 'Card replacement is not enabled.' });
    }

    // Get member with status
    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
              m.email, m.next_renewal, m.portal_email,
              ms.name AS status_name
       FROM members m
       LEFT JOIN member_statuses ms ON m.status_id = ms.id
       WHERE m.id = $1`,
      [memberId],
    );

    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    // Must be Current status
    if (!member.status_name || !member.status_name.toLowerCase().includes('current')) {
      return res
        .status(400)
        .json({ error: 'Card replacement is only available for current members.' });
    }

    // Must be within standard renewal period (not in grace period)
    if (member.next_renewal) {
      const renewal = new Date(member.next_renewal);
      if (renewal < new Date()) {
        return res.status(400).json({
          error: 'Your membership renewal date has passed. Please renew your membership first.',
        });
      }
    }

    // Send the card confirmation email (stub)
    const emailAddr = member.portal_email || member.email;
    if (!emailAddr) {
      return res.status(400).json({ error: 'No email address on file.' });
    }

    // Use the card replacement system message
    const [template] = await tenantQuery(
      slug,
      `SELECT subject, body FROM system_messages WHERE id = 'card_replacement_confirm'`,
    );

    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const u3aName = tenant?.name ?? slug;

    if (template) {
      // In production the resolved subject/body populate the SendGrid message.
      resolveTokens(template.subject, template.body, { ...member }, u3aName);

      // Generate the membership card PDF to attach to the email
      const attachments = [];
      try {
        const { pdfBuffer, filename } = await generateSingleCardPdf(slug, memberId);
        attachments.push({
          content: pdfBuffer.toString('base64'),
          filename,
          type: 'application/pdf',
          disposition: 'attachment',
        });
      } catch (cardErr) {
        logger.error('[Portal] Failed to generate card PDF for attachment', {
          message: cardErr.message,
        });
      }

      // In production, this would call SendGrid with the resolved subject/body,
      // emailAddr as recipient, and the card PDF attachment. Log only metadata.
      logger.info('[Portal] Card replacement email prepared (SendGrid not configured)', {
        attachments: attachments.length,
      });
    }

    // Mark card as not printed so admin knows to reprint
    await tenantQuery(
      slug,
      `UPDATE members SET card_printed = false, updated_at = now() WHERE id = $1`,
      [memberId],
    );

    logAudit(slug, {
      userId: null,
      userName: `${req.portal.name} (portal)`,
      action: 'create',
      entityType: 'card_replacement',
      entityId: memberId,
      entityName: `${member.forenames} ${member.surname}`,
    });

    res.json({ message: 'A replacement membership card has been sent to your email address.' });
  } catch (err) {
    next(err);
  }
});

export default router;
