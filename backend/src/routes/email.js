// beacon2/backend/src/routes/email.js

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import sgMail from '@sendgrid/mail';
import { tenantQuery, prisma } from '../utils/db.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { resolveTokens, fmtDate } from '../utils/emailTokens.js';

const router = Router();
router.use(requireAuth);
router.use(requireFeature('email'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Configure SendGrid (noop if no key — unit tests mock before this runs)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_ADDRESS = 'noreply@u3abeacon.org.uk';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Fetch members with address and partner data for token resolution.
 * Returns an array of enriched member objects.
 */
async function fetchMembersForEmail(tenantSlug, memberIds) {
  const rows = await tenantQuery(tenantSlug, `
    SELECT
      m.id, m.membership_number, m.title, m.forenames, m.surname, m.known_as,
      m.email, m.mobile, m.next_renewal, m.home_u3a,
      mc.name AS class_name,
      a.house_no, a.street, a.add_line1, a.add_line2, a.town, a.county, a.postcode, a.telephone,
      -- partner data (flat columns)
      p.id               AS p_id,
      p.title            AS p_title,
      p.forenames        AS p_forenames,
      p.surname          AS p_surname,
      p.known_as         AS p_known_as,
      p.email            AS p_email,
      p.mobile           AS p_mobile,
      pa.telephone       AS p_telephone
    FROM members m
    LEFT JOIN member_classes mc ON mc.id = m.class_id
    LEFT JOIN addresses a        ON a.id  = m.address_id
    LEFT JOIN members p          ON p.id  = m.partner_id
    LEFT JOIN addresses pa       ON pa.id = p.address_id
    WHERE m.id = ANY($1::text[])
  `, [memberIds]);

  return rows.map((r) => ({
    id:               r.id,
    membership_number: r.membership_number,
    title:            r.title,
    forenames:        r.forenames,
    surname:          r.surname,
    known_as:         r.known_as,
    email:            r.email,
    mobile:           r.mobile,
    next_renewal:     r.next_renewal,
    home_u3a:         r.home_u3a,
    class_name:       r.class_name,
    address: {
      house_no:  r.house_no,
      street:    r.street,
      add_line1: r.add_line1,
      add_line2: r.add_line2,
      town:      r.town,
      county:    r.county,
      postcode:  r.postcode,
      telephone: r.telephone,
    },
    partner: r.p_id ? {
      id:        r.p_id,
      title:     r.p_title,
      forenames: r.p_forenames,
      surname:   r.p_surname,
      known_as:  r.p_known_as,
      email:     r.p_email,
      mobile:    r.p_mobile,
      address: { telephone: r.p_telephone },
    } : null,
  }));
}

/**
 * Get the tenant's display name from the system tenants table.
 */
async function getTenantDisplayName(tenantSlug) {
  const tenant = await prisma.sysTenant.findUnique({ where: { slug: tenantSlug } });
  return tenant?.name || tenantSlug;
}

/**
 * Map a SendGrid event type to a Beacon2 delivery status string.
 */
function mapSgStatus(events) {
  if (!events || events.length === 0) return 'Despatched';
  // Pick the most significant status from the event list
  const priority = ['spam_report', 'bounce', 'dropped', 'delivered', 'deferred', 'processed'];
  for (const ev of priority) {
    if (events.some((e) => e.event === ev)) {
      switch (ev) {
        case 'spam_report': return 'Reported as SPAM';
        case 'bounce':      return 'Bounced';
        case 'dropped':     return 'Dropped';
        case 'delivered':   return 'Delivered';
        case 'deferred':    return 'Deferred';
        case 'processed':   return 'Processed';
      }
    }
  }
  return 'Despatched';
}

// ─── Standard Messages ────────────────────────────────────────────────────

// GET /email/standard-messages
router.get('/standard-messages', requirePrivilege('email_standard_messages', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(req.tenantSlug, `
      SELECT id, name, subject, body FROM standard_messages ORDER BY name
    `, []);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /email/standard-messages
router.post('/standard-messages', requirePrivilege('email_standard_messages', 'create'), async (req, res, next) => {
  const schema = z.object({
    name:    z.string().min(1).max(200),
    subject: z.string().max(500).default(''),
    body:    z.string().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation error', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  const { name, subject, body } = parsed.data;
  try {
    const rows = await tenantQuery(req.tenantSlug, `
      INSERT INTO standard_messages (name, subject, body)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO UPDATE SET subject = $2, body = $3, updated_at = NOW()
      RETURNING id, name, subject, body
    `, [name, subject, body]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /email/standard-messages/:id
router.delete('/standard-messages/:id', requirePrivilege('email_standard_messages', 'delete'), async (req, res, next) => {
  try {
    await tenantQuery(req.tenantSlug, `DELETE FROM standard_messages WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── From addresses ───────────────────────────────────────────────────────

// GET /email/from-addresses  — member email + any office emails the user holds
router.get('/from-addresses', requirePrivilege('email', 'send'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    // Get the user record to find their linked member_id
    const userRows = await tenantQuery(req.tenantSlug, `SELECT member_id, name FROM users WHERE id = $1`, [userId]);
    const user = userRows[0];
    const addresses = [];

    if (user?.member_id) {
      const memberRows = await tenantQuery(req.tenantSlug, `SELECT email, forenames, surname FROM members WHERE id = $1`, [user.member_id]);
      if (memberRows[0]?.email) {
        const m = memberRows[0];
        addresses.push({ label: `${m.forenames} ${m.surname} <${m.email}>`, email: m.email });
      }
      // Office emails for this member
      const officeRows = await tenantQuery(req.tenantSlug, `
        SELECT name, office_email FROM offices WHERE member_id = $1 AND office_email IS NOT NULL AND office_email != ''
      `, [user.member_id]);
      for (const o of officeRows) {
        addresses.push({ label: `${o.name} <${o.office_email}>`, email: o.office_email });
      }
    }

    // Fallback: if no member linked, use user's email from users table
    if (addresses.length === 0) {
      const emailRows = await tenantQuery(req.tenantSlug, `SELECT email FROM users WHERE id = $1`, [userId]);
      if (emailRows[0]?.email) {
        addresses.push({ label: `${user?.name ?? ''} <${emailRows[0].email}>`, email: emailRows[0].email });
      }
    }

    res.json(addresses);
  } catch (err) { next(err); }
});

// ─── Send email ───────────────────────────────────────────────────────────

const sendSchema = z.object({
  memberIds:     z.array(z.string()).min(1),
  subject:       z.string().min(1).max(500),
  body:          z.string().min(1),
  fromEmail:     z.string().email(),
  replyTo:       z.string().email(),
  copyToSelf:    z.boolean().default(false),
  giftAidDates:  z.object({ from: z.string(), to: z.string() }).optional(),
});

// POST /email/send  (multipart — attachments optional)
router.post('/send',
  requirePrivilege('email', 'send'),
  upload.array('attachments', 20),
  async (req, res, next) => {
    // Parse JSON fields sent as multipart form fields
    let bodyData;
    try {
      bodyData = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
    } catch {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const parsed = sendSchema.safeParse(bodyData);
    if (!parsed.success) return res.status(422).json({ error: 'Validation error', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });

    const { memberIds, subject, body, fromEmail, replyTo, copyToSelf, giftAidDates } = parsed.data;

    try {
      const [members, u3aName] = await Promise.all([
        fetchMembersForEmail(req.tenantSlug, memberIds),
        getTenantDisplayName(req.tenantSlug),
      ]);

      // Pre-build Gift Aid tokens per member if sending from GA page
      let gaTokensByMemberId = {};
      if (giftAidDates) {
        const gaRows = await tenantQuery(
          req.tenantSlug,
          `SELECT t.member_id_1, t.date, t.gift_aid_amount::float,
                  m.gift_aid_from
           FROM transactions t
           JOIN members m ON m.id = t.member_id_1
           WHERE t.type = 'in'
             AND t.gift_aid_amount IS NOT NULL AND t.gift_aid_amount > 0
             AND m.gift_aid_from IS NOT NULL AND m.gift_aid_from <= t.date
             AND t.date BETWEEN $1::date AND $2::date
           ORDER BY t.date`,
          [giftAidDates.from, giftAidDates.to],
        );
        for (const r of gaRows) {
          if (!gaTokensByMemberId[r.member_id_1]) {
            gaTokensByMemberId[r.member_id_1] = { giftAidFrom: r.gift_aid_from, items: [] };
          }
          gaTokensByMemberId[r.member_id_1].items.push(r);
        }
      }

      // Build recipients — only members with a valid email
      const recipients = members.filter((m) => m.email && m.email.includes('@'));

      if (recipients.length === 0) {
        return res.status(400).json({ error: 'No recipients have a valid email address' });
      }

      // Build attachments array for SendGrid
      const attachments = (req.files || []).map((f) => ({
        content:     f.buffer.toString('base64'),
        filename:    f.originalname,
        type:        f.mimetype,
        disposition: 'attachment',
      }));

      // Send one personalised email per recipient
      const batchId = await createBatch(req.tenantSlug, req.user.userId, subject, body, fromEmail, replyTo, recipients.length);

      const sendResults = await Promise.allSettled(
        recipients.map(async (member) => {
          // Build Gift Aid extra tokens for this member
          let extraTokens;
          if (giftAidDates) {
            const ga = gaTokensByMemberId[member.id];
            const gaDate = ga ? fmtDate(ga.giftAidFrom) : '';
            const gaList = ga
              ? ga.items.map((i) => `${fmtDate(i.date)} £${Number(i.gift_aid_amount).toFixed(2)}`).join(', ')
              : '';
            extraTokens = { '#GIFTAID': gaDate, '#GIFTAIDLIST': gaList };
          }
          const { subject: resolvedSubject, body: resolvedBody } = resolveTokens(subject, body, member, u3aName, extraTokens);
          const htmlBody = resolvedBody.replace(/\n/g, '<br>');
          const msg = {
            to:         { email: member.email, name: `${member.forenames} ${member.surname}`.trim() },
            from:       { email: FROM_ADDRESS, name: u3aName },
            replyTo:    { email: replyTo, name: u3aName },
            subject:    resolvedSubject,
            text:       resolvedBody,
            html:       htmlBody,
            attachments: attachments.length > 0 ? attachments : undefined,
            customArgs: { batch_id: batchId },
          };
          const [response] = await sgMail.send(msg);
          const msgId = response?.headers?.['x-message-id'] || null;
          return { memberId: member.id, email: member.email, name: `${member.forenames} ${member.surname}`.trim(), msgId };
        }),
      );

      // Store recipient rows
      const recipientRows = sendResults.map((r, i) => {
        const member = recipients[i];
        if (r.status === 'fulfilled') {
          return { memberId: member.id, email: member.email, name: `${member.forenames} ${member.surname}`.trim(), status: 'Despatched', msgId: r.value.msgId, error: null };
        } else {
          return { memberId: member.id, email: member.email, name: `${member.forenames} ${member.surname}`.trim(), status: 'Invalid', msgId: null, error: r.reason?.message || 'Send failed' };
        }
      });

      await storeRecipients(req.tenantSlug, batchId, recipientRows);

      // Optional copy to self (no token substitution)
      if (copyToSelf && replyTo) {
        const selfMsg = {
          to:      replyTo,
          from:    { email: FROM_ADDRESS, name: u3aName },
          replyTo: { email: replyTo, name: u3aName },
          subject: `[COPY] ${subject}`,
          text:    body,
          html:    body.replace(/\n/g, '<br>'),
          attachments: attachments.length > 0 ? attachments : undefined,
        };
        await sgMail.send(selfMsg).catch(() => {});
      }

      const sent = recipientRows.filter((r) => r.status === 'Despatched').length;
      const failed = recipientRows.filter((r) => r.status !== 'Despatched').length;

      res.json({ batchId, sent, failed });
    } catch (err) { next(err); }
  },
);

async function createBatch(tenantSlug, userId, subject, body, fromEmail, replyTo, recipientCount) {
  const rows = await tenantQuery(tenantSlug, `
    INSERT INTO email_batches (user_id, subject, body, from_email, reply_to, recipient_count)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [userId, subject, body, fromEmail, replyTo, recipientCount]);
  return rows[0].id;
}

async function storeRecipients(tenantSlug, batchId, recipients) {
  if (recipients.length === 0) return;
  // Insert individually (simple, small lists)
  for (const r of recipients) {
    await tenantQuery(tenantSlug, `
      INSERT INTO email_recipients (batch_id, member_id, email_address, display_name, status, sendgrid_message_id, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [batchId, r.memberId || null, r.email, r.name, r.status, r.msgId || null, r.error || null]);
  }
}

// ─── Delivery list ────────────────────────────────────────────────────────

// GET /email/delivery
router.get('/delivery', requirePrivilege('email_delivery', 'view'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const isAdmin = req.user.privileges?.includes('email_delivery:all');
    const { from, to } = req.query;

    let sql = `
      SELECT id, user_id, subject, from_email, reply_to, recipient_count, sent_at
      FROM email_batches
      WHERE 1=1
    `;
    const params = [];

    if (!isAdmin) {
      params.push(userId);
      sql += ` AND user_id = $${params.length}`;
    }
    if (from) { params.push(from); sql += ` AND sent_at >= $${params.length}::timestamptz`; }
    if (to)   { params.push(to);   sql += ` AND sent_at <= $${params.length}::timestamptz`; }

    sql += ` ORDER BY sent_at DESC LIMIT 50`;

    const rows = await tenantQuery(req.tenantSlug, sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /email/delivery/:batchId
router.get('/delivery/:batchId', requirePrivilege('email_delivery', 'view'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const isAdmin = req.user.privileges?.includes('email_delivery:all');

    // Verify ownership
    const batchRows = await tenantQuery(req.tenantSlug, `SELECT * FROM email_batches WHERE id = $1`, [req.params.batchId]);
    if (!batchRows[0]) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin && batchRows[0].user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    const recipients = await tenantQuery(req.tenantSlug, `
      SELECT id, member_id, email_address, display_name, status, sendgrid_message_id, error_message, updated_at
      FROM email_recipients WHERE batch_id = $1 ORDER BY display_name
    `, [req.params.batchId]);

    res.json({ batch: batchRows[0], recipients });
  } catch (err) { next(err); }
});

// POST /email/delivery/:batchId/refresh  — re-query SendGrid for current statuses
router.post('/delivery/:batchId/refresh', requirePrivilege('email_delivery', 'view'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const isAdmin = req.user.privileges?.includes('email_delivery:all');

    const batchRows = await tenantQuery(req.tenantSlug, `SELECT * FROM email_batches WHERE id = $1`, [req.params.batchId]);
    if (!batchRows[0]) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin && batchRows[0].user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    if (!process.env.SENDGRID_API_KEY) {
      return res.status(503).json({ error: 'SendGrid not configured' });
    }

    const recipients = await tenantQuery(req.tenantSlug, `
      SELECT id, email_address, sendgrid_message_id FROM email_recipients WHERE batch_id = $1
    `, [req.params.batchId]);

    // Query SendGrid Activity Feed API for each message ID that we have
    const withMsgId = recipients.filter((r) => r.sendgrid_message_id);
    let updated = 0;

    for (const r of withMsgId) {
      try {
        const url = `https://api.sendgrid.com/v3/messages/${encodeURIComponent(r.sendgrid_message_id)}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
        });
        if (!response.ok) continue;
        const data = await response.json();
        // data.events is an array of event objects
        const newStatus = mapSgStatus(data.events || []);
        await tenantQuery(req.tenantSlug, `
          UPDATE email_recipients SET status = $1, updated_at = NOW() WHERE id = $2
        `, [newStatus, r.id]);
        updated++;
      } catch {
        // Skip individual failures
      }
    }

    const refreshed = await tenantQuery(req.tenantSlug, `
      SELECT id, member_id, email_address, display_name, status, sendgrid_message_id, error_message, updated_at
      FROM email_recipients WHERE batch_id = $1 ORDER BY display_name
    `, [req.params.batchId]);

    res.json({ updated, recipients: refreshed });
  } catch (err) { next(err); }
});

// ─── Email Unblocker ──────────────────────────────────────────────────────

// POST /email/unblocker  — remove an address from SendGrid bounce + spam lists
router.post('/unblocker', requirePrivilege('email_delivery', 'all'), async (req, res, next) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Invalid email address' });

  if (!process.env.SENDGRID_API_KEY) {
    return res.status(503).json({ error: 'SendGrid not configured' });
  }

  const { email } = parsed.data;
  const headers = {
    Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const results = { bounces: false, spam: false };

    // Remove from bounces
    const bouncesRes = await fetch(`https://api.sendgrid.com/v3/suppression/bounces/${encodeURIComponent(email)}`, {
      method: 'DELETE', headers,
    });
    results.bounces = bouncesRes.ok || bouncesRes.status === 204 || bouncesRes.status === 404;

    // Remove from spam reports
    const spamRes = await fetch(`https://api.sendgrid.com/v3/suppression/spam_reports/${encodeURIComponent(email)}`, {
      method: 'DELETE', headers,
    });
    results.spam = spamRes.ok || spamRes.status === 204 || spamRes.status === 404;

    res.json({
      message: `Address ${email} has been removed from bounce and spam lists.`,
      details: results,
    });
  } catch (err) { next(err); }
});

export default router;
