// beacon2/backend/src/routes/portal/helpers.js
// Shared helpers used across the Members Portal sub-route files: date
// formatters and the (currently stubbed) outbound email helpers.

import sgMail from '@sendgrid/mail';
import { tenantQuery, prisma } from '../../utils/db.js';
import { resolveTokens } from '../../utils/emailTokens.js';
import { logger } from '../../utils/logger.js';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const PORTAL_FROM = process.env.RECOVERY_FROM_ADDRESS ?? 'noreply@u3abeacon.org.uk';

/** Format a date value as DD/MM/YYYY (UK). Returns '' for falsy input. */
export function fmtDateUK(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

/** Format a time value as HH:MM, accepting either a bare time or an ISO string. */
export function fmtTime(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  if (idx !== -1) return s.slice(idx + 1, idx + 6);
  return s.slice(0, 5);
}

/** Format a date as ISO (YYYY-MM-DD). */
export function fmtDateISO(date) {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

export async function notifyGroupLeaders(slug, groupId, memberId, action, groupName) {
  try {
    const leaders = await tenantQuery(
      slug,
      `SELECT m.email, m.forenames, m.surname
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
       WHERE gm.group_id = $1 AND gm.is_leader = true`,
      [groupId],
    );

    // In production this would email each leader that a member joined/left.
    // Log only the operational facts — never leader/member names or emails.
    const recipientCount = leaders.filter((l) => l.email).length;
    if (recipientCount > 0) {
      logger.info('[Portal] Group-leader notifications prepared (SendGrid not configured)', {
        action,
        group: groupName,
        recipients: recipientCount,
      });
    }
  } catch (err) {
    logger.error('[Portal] Failed to notify group leaders', { message: err.message });
  }
}

export async function sendDetailsUpdateEmail(slug, memberId, emailChanged) {
  try {
    const [member] = await tenantQuery(
      slug,
      `SELECT forenames, surname, email, portal_email FROM members WHERE id = $1`,
      [memberId],
    );
    if (!member) return;

    const emailAddr = emailChanged ? member.portal_email : member.portal_email || member.email;
    if (!emailAddr) return;

    // Try to use a system message template
    const [template] = await tenantQuery(
      slug,
      `SELECT subject, body FROM system_messages WHERE id = 'portal_details_updated'`,
    );

    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const u3aName = tenant?.name ?? slug;

    if (template) {
      // In production the resolved subject/body populate the SendGrid message.
      resolveTokens(template.subject, template.body, member, u3aName);
    }
    // Log only non-PII metadata — never the recipient email or resolved subject.
    logger.info('[Portal] Details-update confirmation prepared (SendGrid not configured)', {
      hasTemplate: Boolean(template),
    });
  } catch (err) {
    logger.error('[Portal] Failed to send details update email', { message: err.message });
  }
}

/** Send the portal email-change verification link. Mirrors sendPortalResetEmail()
 *  in public.js — if SendGrid is not configured we log a warning (without the
 *  token) and return silently rather than emitting the link to stdout. */
export async function sendPortalVerificationEmail(toEmail, verifyLink) {
  const subject = 'Verify your new Members Portal email address';
  const body = `You changed the email address on your Members Portal account.

Use the link below to verify this new address. The link expires in one hour.

${verifyLink}

If you did not request this, please contact your u3a.`;

  if (!process.env.SENDGRID_API_KEY) {
    logger.warn(
      '[Portal] SendGrid not configured — cannot deliver email-verification message. ' +
        'Set SENDGRID_API_KEY to enable portal verification emails.',
    );
    return;
  }

  try {
    await sgMail.send({ to: toEmail, from: PORTAL_FROM, subject, text: body });
  } catch (err) {
    // Never include the recipient email or the verification link in the error log.
    logger.error('[Portal] Failed to send email-verification message', { message: err.message });
  }
}
