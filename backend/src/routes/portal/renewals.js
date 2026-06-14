// beacon2/backend/src/routes/portal/renewals.js
// Members Portal — Online Renewals (doc 10.2.1): renewal eligibility/fee lookup,
// PayPal payment initiation, and post-payment confirmation.

import { Router } from 'express';
import { z } from 'zod';
import { tenantQuery, prisma } from '../../utils/db.js';
import { hashOpaqueToken } from '../../utils/password.js';
import { resolveTokens } from '../../utils/emailTokens.js';
import { isFeatureEnabled } from '../../middleware/requireFeature.js';
import { logAudit } from '../../utils/audit.js';
import { generateSingleCardPdf } from '../membershipCards.js';
import { fmtDateISO } from './helpers.js';
import { logger } from '../../utils/logger.js';

const router = Router({ mergeParams: true });

// GET /renewal-info — returns member's renewal eligibility, fee, partner info
router.get('/renewal-info', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [[settings], [member], tenant] = await Promise.all([
      tenantQuery(
        slug,
        `SELECT portal_config, year_start_month, year_start_day,
                advance_renewals_weeks, gift_aid_online_renewals,
                paypal_email, online_renew_email
         FROM tenant_settings WHERE id = 'singleton'`,
      ),
      tenantQuery(
        slug,
        `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
                m.email, m.next_renewal, m.gift_aid_from, m.class_id, m.partner_id,
                ms.name AS status_name,
                mc.name AS class_name, mc.fee::float AS fee, mc.is_joint,
                mc.gift_aid_fee::float AS gift_aid_fee
         FROM members m
         LEFT JOIN member_statuses ms ON m.status_id = ms.id
         LEFT JOIN member_classes mc ON m.class_id = mc.id
         WHERE m.id = $1`,
        [memberId],
      ),
      prisma.sysTenant.findUnique({ where: { slug } }),
    ]);

    const portalConfig = { renewals: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.renewals) {
      return res
        .status(403)
        .json({ error: 'Online renewal is not enabled for this organisation.' });
    }

    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    // Must be Current status
    const statusLower = (member.status_name ?? '').toLowerCase();
    if (!statusLower.includes('current')) {
      return res.status(400).json({
        error:
          'Online renewal is only available for current members. Please contact your Membership Secretary.',
      });
    }

    // Check if within renewal window
    const nextRenewal = member.next_renewal
      ? new Date(String(member.next_renewal).slice(0, 10))
      : null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (!nextRenewal) {
      return res.status(400).json({
        error:
          'No renewal date is set for your membership. Please contact your Membership Secretary.',
      });
    }

    // Already renewed (next_renewal is more than 1 year from now - likely already renewed)
    const advanceWeeks = settings.advance_renewals_weeks ?? 4;
    const windowStart = new Date(nextRenewal);
    windowStart.setDate(windowStart.getDate() - advanceWeeks * 7);

    if (now < windowStart) {
      return res.status(400).json({
        error: `Your membership is not yet due for renewal. Renewal opens from ${fmtDateISO(windowStart)}.`,
        nextRenewal: String(member.next_renewal).slice(0, 10),
      });
    }

    // If next_renewal has already passed, still allow (they're overdue but still Current)

    // Look up partner info for joint memberships
    let partner = null;
    if (member.partner_id && member.is_joint) {
      const [p] = await tenantQuery(
        slug,
        `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
                m.gift_aid_from, m.next_renewal,
                mc.name AS class_name, mc.fee::float AS fee,
                mc.gift_aid_fee::float AS gift_aid_fee
         FROM members m
         LEFT JOIN member_classes mc ON m.class_id = mc.id
         WHERE m.id = $1`,
        [member.partner_id],
      );
      if (p) {
        partner = {
          id: p.id,
          membershipNumber: p.membership_number,
          forenames: p.forenames,
          surname: p.surname,
          displayName: p.known_as || p.forenames?.split(' ')[0] || p.forenames,
          fee: p.fee ?? 0,
          giftAidFrom: p.gift_aid_from ? String(p.gift_aid_from).slice(0, 10) : null,
          nextRenewal: p.next_renewal ? String(p.next_renewal).slice(0, 10) : null,
        };
      }
    }

    // Compute fees
    const memberFee = member.fee ?? 0;
    const partnerFee = partner?.fee ?? 0;
    const totalFee = member.is_joint ? memberFee + partnerFee : memberFee;

    const giftAidFeatureOn = await isFeatureEnabled(slug, 'giftAid');
    const showGiftAid = giftAidFeatureOn && settings.gift_aid_online_renewals;

    res.json({
      u3aName: tenant?.name ?? slug,
      member: {
        id: member.id,
        membershipNumber: member.membership_number,
        forenames: member.forenames,
        surname: member.surname,
        displayName: member.known_as || member.forenames?.split(' ')[0] || member.forenames,
        className: member.class_name,
        fee: memberFee,
        nextRenewal: String(member.next_renewal).slice(0, 10),
        giftAidFrom: member.gift_aid_from ? String(member.gift_aid_from).slice(0, 10) : null,
        isJoint: member.is_joint ?? false,
      },
      partner,
      totalFee,
      showGiftAid,
      onlineRenewEmail: settings.online_renew_email ?? '',
    });
  } catch (err) {
    next(err);
  }
});

// POST /renew — process online renewal (creates PayPal payment)
const portalRenewSchema = z.object({
  giftAid: z.boolean().default(false),
  partnerGiftAid: z.boolean().default(false),
});

router.post('/renew', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const data = portalRenewSchema.parse(req.body);

    const [[settings], [member]] = await Promise.all([
      tenantQuery(
        slug,
        `SELECT portal_config, year_start_month, year_start_day,
                advance_renewals_weeks, gift_aid_online_renewals,
                paypal_email, paypal_cancel_url
         FROM tenant_settings WHERE id = 'singleton'`,
      ),
      tenantQuery(
        slug,
        `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
                m.next_renewal, m.gift_aid_from, m.class_id, m.partner_id,
                ms.name AS status_name,
                mc.name AS class_name, mc.fee::float AS fee, mc.is_joint
         FROM members m
         LEFT JOIN member_statuses ms ON m.status_id = ms.id
         LEFT JOIN member_classes mc ON m.class_id = mc.id
         WHERE m.id = $1`,
        [memberId],
      ),
    ]);

    const portalConfig = { renewals: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.renewals) {
      return res.status(403).json({ error: 'Online renewal is not enabled.' });
    }

    if (!member) return res.status(404).json({ error: 'Member not found.' });

    const statusLower = (member.status_name ?? '').toLowerCase();
    if (!statusLower.includes('current')) {
      return res
        .status(400)
        .json({ error: 'Online renewal is only available for current members.' });
    }

    // Validate renewal window
    const nextRenewal = member.next_renewal
      ? new Date(String(member.next_renewal).slice(0, 10))
      : null;
    if (!nextRenewal) {
      return res.status(400).json({ error: 'No renewal date set.' });
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const advanceWeeks = settings.advance_renewals_weeks ?? 4;
    const windowStart = new Date(nextRenewal);
    windowStart.setDate(windowStart.getDate() - advanceWeeks * 7);
    if (now < windowStart) {
      return res.status(400).json({ error: 'Renewal window has not opened yet.' });
    }

    // Get partner for joint
    let partnerMember = null;
    if (member.partner_id && member.is_joint) {
      const [p] = await tenantQuery(
        slug,
        `SELECT m.id, m.forenames, m.surname, m.email, m.next_renewal,
                m.gift_aid_from, m.class_id,
                mc.fee::float AS fee
         FROM members m
         LEFT JOIN member_classes mc ON m.class_id = mc.id
         WHERE m.id = $1`,
        [member.partner_id],
      );
      if (p) partnerMember = p;
    }

    // Calculate total amount
    const memberFee = member.fee ?? 0;
    const partnerFee = partnerMember?.fee ?? 0;
    const totalAmount = member.is_joint ? memberFee + partnerFee : memberFee;

    // Store renewal intent: save Gift Aid choices and generate payment token.
    // The DB stores sha256(token)|<base64-meta>. The plaintext token is not
    // needed externally for the renewal flow (the user returns via PayPal and
    // is re-identified by memberId), but is hashed for consistency with the
    // joining flow's resume-payment path which does look up by token.
    const { randomBytes } = await import('crypto');
    const paymentToken = randomBytes(24).toString('hex');

    const renewalMeta = JSON.stringify({
      giftAid: data.giftAid,
      partnerGiftAid: data.partnerGiftAid,
      partnerMemberId: partnerMember?.id ?? null,
    });
    const combinedToken = `${hashOpaqueToken(paymentToken)}|${Buffer.from(renewalMeta).toString('base64')}`;
    await tenantQuery(
      slug,
      `UPDATE members SET payment_token = $1, updated_at = now() WHERE id = $2`,
      [combinedToken, memberId],
    );

    // Initiate PayPal payment
    const { initiatePayment } = await import('../../utils/paypal.js');
    const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const returnUrl = `${frontendBase}/public/${slug}/portal/renewal-complete`;
    const cancelUrl = settings.paypal_cancel_url || `${frontendBase}/public/${slug}/portal/home`;

    const description = member.is_joint
      ? `Membership Renewal: ${member.class_name} (joint — ${member.forenames} & ${partnerMember?.forenames})`
      : `Membership Renewal: ${member.class_name}`;

    const { paymentId, redirectUrl } = await initiatePayment({
      amount: totalAmount,
      description,
      memberRef: memberId,
      returnUrl,
      cancelUrl,
      paypalEmail: settings.paypal_email,
    });

    logAudit(slug, {
      userId: null,
      userName: `${req.portal.name} (portal)`,
      action: 'update',
      entityType: 'member',
      entityId: memberId,
      entityName: `${member.forenames} ${member.surname}`,
      detail: 'Online renewal initiated',
    });

    res.json({
      paymentId,
      redirectUrl,
      amount: totalAmount,
    });
  } catch (err) {
    next(err);
  }
});

// POST /renewal-confirm — confirm payment and update renewal dates
const renewalConfirmSchema = z.object({
  paymentId: z.string().min(1),
});

router.post('/renewal-confirm', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const data = renewalConfirmSchema.parse(req.body);

    // Verify payment
    const { verifyPaymentNotification } = await import('../../utils/paypal.js');
    const verification = await verifyPaymentNotification({
      paymentId: data.paymentId,
      rawBody: req.body,
    });
    if (!verification.verified) {
      return res.status(400).json({ error: 'Payment verification failed.' });
    }

    // Get member with payment token
    const [member] = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.email,
              m.next_renewal, m.gift_aid_from, m.class_id, m.partner_id,
              m.payment_token,
              ms.name AS status_name,
              mc.name AS class_name, mc.fee::float AS fee, mc.is_joint
       FROM members m
       LEFT JOIN member_statuses ms ON m.status_id = ms.id
       LEFT JOIN member_classes mc ON m.class_id = mc.id
       WHERE m.id = $1`,
      [memberId],
    );

    if (!member) return res.status(404).json({ error: 'Member not found.' });

    // Parse renewal metadata from payment token
    let renewalMeta = { giftAid: false, partnerGiftAid: false, partnerMemberId: null };
    if (member.payment_token && member.payment_token.includes('|')) {
      try {
        const metaPart = member.payment_token.split('|')[1];
        renewalMeta = JSON.parse(Buffer.from(metaPart, 'base64').toString('utf8'));
      } catch {
        /* use defaults */
      }
    }

    const [settings] = await tenantQuery(
      slug,
      `SELECT gift_aid_online_renewals, year_start_month, year_start_day
       FROM tenant_settings WHERE id = 'singleton'`,
    );

    const giftAidFeatureOn = await isFeatureEnabled(slug, 'giftAid');
    const showGiftAid = giftAidFeatureOn && settings?.gift_aid_online_renewals;

    // Calculate new next_renewal (current next_renewal + 1 year)
    const baseDate = member.next_renewal
      ? new Date(String(member.next_renewal).slice(0, 10))
      : new Date();
    baseDate.setFullYear(baseDate.getFullYear() + 1);
    const newNextRenewal = baseDate.toISOString().slice(0, 10);

    // Update Gift Aid
    let giftAidFrom = member.gift_aid_from ? String(member.gift_aid_from).slice(0, 10) : null;
    if (showGiftAid) {
      if (renewalMeta.giftAid && !giftAidFrom) {
        giftAidFrom = new Date().toISOString().slice(0, 10);
      } else if (!renewalMeta.giftAid) {
        giftAidFrom = null;
      }
    }

    // Update member
    await tenantQuery(
      slug,
      `UPDATE members
       SET next_renewal = $1::date,
           gift_aid_from = $2::date,
           card_printed = false,
           payment_token = NULL,
           updated_at = now()
       WHERE id = $3`,
      [newNextRenewal, giftAidFrom, memberId],
    );

    // Handle joint partner renewal
    let partnerMember = null;
    if (member.is_joint && renewalMeta.partnerMemberId) {
      const [p] = await tenantQuery(
        slug,
        `SELECT id, forenames, surname, email, next_renewal, gift_aid_from,
                class_id
         FROM members WHERE id = $1`,
        [renewalMeta.partnerMemberId],
      );
      if (p) {
        partnerMember = p;
        const pBaseDate = p.next_renewal
          ? new Date(String(p.next_renewal).slice(0, 10))
          : new Date();
        pBaseDate.setFullYear(pBaseDate.getFullYear() + 1);
        const pNewNextRenewal = pBaseDate.toISOString().slice(0, 10);

        let pGiftAidFrom = p.gift_aid_from ? String(p.gift_aid_from).slice(0, 10) : null;
        if (showGiftAid) {
          if (renewalMeta.partnerGiftAid && !pGiftAidFrom) {
            pGiftAidFrom = new Date().toISOString().slice(0, 10);
          } else if (!renewalMeta.partnerGiftAid) {
            pGiftAidFrom = null;
          }
        }

        await tenantQuery(
          slug,
          `UPDATE members
           SET next_renewal = $1::date,
               gift_aid_from = $2::date,
               card_printed = false,
               payment_token = NULL,
               updated_at = now()
           WHERE id = $3`,
          [pNewNextRenewal, pGiftAidFrom, p.id],
        );
      }
    }

    // Create finance transaction
    const memberFee = member.fee ?? 0;
    const partnerFee = partnerMember
      ? ((
          await tenantQuery(slug, `SELECT fee::float FROM member_classes WHERE id = $1`, [
            partnerMember.class_id,
          ])
        )[0]?.fee ?? 0)
      : 0;
    const totalAmount = member.is_joint ? memberFee + partnerFee : memberFee;

    if (totalAmount > 0) {
      const [paypalAcct] = await tenantQuery(
        slug,
        `SELECT id FROM finance_accounts WHERE name ILIKE '%PayPal%' AND active = true LIMIT 1`,
      );
      const [membershipCat] = await tenantQuery(
        slug,
        `SELECT id FROM finance_categories WHERE name = 'Membership' AND active = true LIMIT 1`,
      );

      if (paypalAcct) {
        const fromTo = partnerMember
          ? `${member.forenames} ${member.surname} & ${partnerMember.forenames} ${partnerMember.surname}`
          : `${member.forenames} ${member.surname}`;
        const detail = member.is_joint ? 'Membership Renewal (joint)' : 'Membership Renewal';

        const txnParams = [paypalAcct.id, fromTo, totalAmount, detail, memberId];
        let memberIdCols = 'member_id_1';
        let memberIdVals = '$5';
        if (partnerMember) {
          memberIdCols += ', member_id_2';
          memberIdVals += ', $6';
          txnParams.push(partnerMember.id);
        }

        const [txn] = await tenantQuery(
          slug,
          `INSERT INTO transactions
             (account_id, date, type, from_to, amount, payment_method, detail, ${memberIdCols})
           VALUES ($1, CURRENT_DATE, 'in', $2, $3::numeric, 'Online', $4, ${memberIdVals})
           RETURNING id, transaction_number`,
          txnParams,
        );

        if (membershipCat && txn) {
          await tenantQuery(
            slug,
            `INSERT INTO transaction_categories (transaction_id, category_id, amount)
             VALUES ($1, $2, $3::numeric)`,
            [txn.id, membershipCat.id, totalAmount],
          );
        }
      }
    }

    // Send confirmation email
    const [template] = await tenantQuery(
      slug,
      `SELECT subject, body FROM system_messages WHERE id = 'online_renewal_confirm'`,
    );
    if (template) {
      const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
      const u3aName = tenant?.name ?? slug;

      // Check if card attachment is enabled
      const [cardSetting] = await tenantQuery(
        slug,
        `SELECT email_cards FROM tenant_settings WHERE id = 'singleton'`,
      );
      const emailCards = cardSetting?.email_cards ?? false;

      const emailAddr = member.email;
      if (emailAddr) {
        // In production the resolved subject/body populate the SendGrid message.
        resolveTokens(
          template.subject,
          template.body,
          { ...member, class_name: member.class_name },
          u3aName,
        );

        // Attach membership card PDF when email_cards is enabled
        const attachments = [];
        if (emailCards) {
          try {
            const { pdfBuffer, filename } = await generateSingleCardPdf(slug, memberId);
            attachments.push({
              content: pdfBuffer.toString('base64'),
              filename,
              type: 'application/pdf',
              disposition: 'attachment',
            });
          } catch (cardErr) {
            logger.error('[Portal] Failed to generate renewal card PDF', {
              message: cardErr.message,
            });
          }
        }

        // In production this would call SendGrid with the resolved subject/body,
        // emailAddr as recipient, and the card PDF. Log only non-PII metadata.
        logger.info('[Portal] Renewal confirmation prepared (SendGrid not configured)', {
          attachments: attachments.length,
        });
      }
      // Also email partner if joint — partner gets their own card
      if (partnerMember?.email) {
        const pClassName =
          (
            await tenantQuery(slug, `SELECT name FROM member_classes WHERE id = $1`, [
              partnerMember.class_id,
            ])
          )[0]?.name ?? '';
        // In production the resolved subject/body populate the SendGrid message.
        resolveTokens(
          template.subject,
          template.body,
          { ...partnerMember, class_name: pClassName },
          u3aName,
        );

        const partnerAttachments = [];
        if (emailCards && partnerMember.id) {
          try {
            const { pdfBuffer, filename } = await generateSingleCardPdf(slug, partnerMember.id);
            partnerAttachments.push({
              content: pdfBuffer.toString('base64'),
              filename,
              type: 'application/pdf',
              disposition: 'attachment',
            });
          } catch (cardErr) {
            logger.error('[Portal] Failed to generate partner renewal card PDF', {
              message: cardErr.message,
            });
          }
        }

        // In production this would call SendGrid for the partner. Log only metadata.
        logger.info('[Portal] Partner renewal confirmation prepared (SendGrid not configured)', {
          attachments: partnerAttachments.length,
        });
      }
    }

    logAudit(slug, {
      userId: null,
      userName: `${req.portal.name} (portal)`,
      action: 'renew',
      entityType: 'member',
      entityId: memberId,
      entityName: `${member.forenames} ${member.surname}`,
      detail: `Online renewal confirmed — new next_renewal: ${newNextRenewal}`,
    });

    res.json({
      success: true,
      newNextRenewal,
      membershipNumber: member.membership_number,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
