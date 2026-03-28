// beacon2/backend/src/routes/portal.js
// Authenticated Members Portal routes (docs 10.2.2–10.2.5).
// All routes require a valid portal JWT (isPortal: true).
// Mounted at /public/:slug/portal/app/* via the public router.

import express, { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { tenantQuery, prisma } from '../utils/db.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateToken } from '../utils/password.js';
import { resolveTokens } from '../utils/emailTokens.js';
import { logAudit } from '../utils/audit.js';

const router = Router({ mergeParams: true });

// ─── Portal auth middleware ──────────────────────────────────────────────────

async function requirePortalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }
  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload.isPortal) {
      return res.status(403).json({ error: 'Not a portal token.' });
    }
    if (payload.tenantSlug !== req.params.slug) {
      return res.status(403).json({ error: 'Token does not match this organisation.' });
    }
    req.portal = payload; // { memberId, tenantSlug, name, isPortal }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

router.use(requirePortalAuth);

// ─── GET /home — portal dashboard config ─────────────────────────────────────

router.get('/home', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [[settings], [member], tenant] = await Promise.all([
      tenantQuery(slug,
        `SELECT portal_config, group_info_config, calendar_config
         FROM tenant_settings WHERE id = 'singleton'`),
      tenantQuery(slug,
        `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
                m.next_renewal, ms.name AS status_name
         FROM members m
         LEFT JOIN member_statuses ms ON m.status_id = ms.id
         WHERE m.id = $1`, [memberId]),
      prisma.sysTenant.findUnique({ where: { slug } }),
    ]);

    const portalConfig = {
      renewals: false, groups: false, calendar: false,
      personalDetails: false, replacementCard: false,
      ...(settings?.portal_config ?? {}),
    };

    const displayName = member?.known_as || member?.forenames?.split(' ')[0] || member?.forenames || '';
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
// 10.2.2 — GROUPS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/groups', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [[settings], groups] = await Promise.all([
      tenantQuery(slug,
        `SELECT portal_config, group_info_config
         FROM tenant_settings WHERE id = 'singleton'`),
      tenantQuery(slug,
        `SELECT g.id, g.name, g.status, g.when_text, g.start_time, g.end_time,
                g.enquiries, g.information, g.max_members, g.allow_online_join,
                g.enable_waiting_list,
                v.name AS venue_name, v.postcode AS venue_postcode,
                f.name AS faculty_name,
                (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.waiting_since IS NULL) AS member_count
         FROM groups g
         LEFT JOIN venues v ON v.id = g.venue_id
         LEFT JOIN faculties f ON f.id = g.faculty_id
         WHERE g.status = 'active'
         ORDER BY g.name`),
    ]);

    const portalConfig = { groups: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.groups) {
      return res.status(403).json({ error: 'Groups viewing is not enabled for this organisation.' });
    }

    const groupInfoConfig = {
      status: { members: false }, venue: { members: false },
      contact: { members: false }, detail: { members: false },
      enquiries: { members: false }, joinGroup: { members: false },
      ...(settings?.group_info_config ?? {}),
    };

    // Get the member's group memberships
    const memberships = await tenantQuery(slug,
      `SELECT group_id, is_leader, waiting_since FROM group_members WHERE member_id = $1`,
      [memberId]);
    const memberGroupMap = new Map(memberships.map(m => [m.group_id, m]));

    // Find leaders for contact info
    const leaderRows = await tenantQuery(slug,
      `SELECT gm.group_id, m.forenames, m.surname, m.known_as
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
       WHERE gm.is_leader = true`);
    const leaderMap = new Map();
    for (const row of leaderRows) {
      const name = row.known_as || row.forenames?.split(' ')[0] || row.forenames;
      const display = `${name} ${row.surname}`.trim();
      if (!leaderMap.has(row.group_id)) leaderMap.set(row.group_id, []);
      leaderMap.get(row.group_id).push(display);
    }

    const result = groups.map(g => {
      const membership = memberGroupMap.get(g.id);
      return {
        id: g.id,
        name: g.name,
        isMember: !!membership && !membership.waiting_since,
        isWaiting: !!membership?.waiting_since,
        // Conditional fields based on groupInfoConfig
        ...(groupInfoConfig.status?.members && { status: g.status }),
        when: g.when_text || null,
        startTime: g.start_time || null,
        endTime: g.end_time || null,
        ...(groupInfoConfig.venue?.members && {
          venue: g.venue_name || null,
          venuePostcode: g.venue_postcode || null,
        }),
        ...(groupInfoConfig.contact?.members && {
          contact: (leaderMap.get(g.id) || []).join(', ') || g.enquiries || null,
        }),
        ...(groupInfoConfig.enquiries?.members && { enquiries: g.enquiries || null }),
        ...(groupInfoConfig.detail?.members && { information: g.information || null }),
        canJoin: groupInfoConfig.joinGroup?.members && g.allow_online_join !== false,
        maxMembers: g.max_members,
        memberCount: g.member_count,
        enableWaitingList: g.enable_waiting_list,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /groups/:groupId/join ──────────────────────────────────────────────

router.post('/groups/:groupId/join', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const { groupId } = req.params;

    // Check joinGroup is enabled
    const [settings] = await tenantQuery(slug,
      `SELECT group_info_config FROM tenant_settings WHERE id = 'singleton'`);
    const gic = { joinGroup: { members: false }, ...(settings?.group_info_config ?? {}) };
    if (!gic.joinGroup?.members) {
      return res.status(403).json({ error: 'Online group joining is not enabled.' });
    }

    // Check group exists and is active
    const [group] = await tenantQuery(slug,
      `SELECT id, name, max_members, enable_waiting_list, allow_online_join,
              (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.waiting_since IS NULL) AS member_count
       FROM groups g WHERE g.id = $1 AND g.status = 'active'`, [groupId]);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }
    if (group.allow_online_join === false) {
      return res.status(403).json({ error: 'This group does not allow online joining.' });
    }

    // Check not already a member
    const [existing] = await tenantQuery(slug,
      `SELECT id FROM group_members WHERE group_id = $1 AND member_id = $2`,
      [groupId, memberId]);
    if (existing) {
      return res.status(400).json({ error: 'You are already a member of this group.' });
    }

    // Check capacity — if full, add to waiting list if enabled
    const isFull = group.max_members > 0 && group.member_count >= group.max_members;
    let waitingSince = null;
    if (isFull) {
      if (!group.enable_waiting_list) {
        return res.status(400).json({ error: 'This group is full and does not have a waiting list.' });
      }
      waitingSince = new Date().toISOString().slice(0, 10);
    }

    await tenantQuery(slug,
      `INSERT INTO group_members (group_id, member_id, waiting_since)
       VALUES ($1, $2, $3::date)`,
      [groupId, memberId, waitingSince]);

    // Notify group leader (stubbed)
    await notifyGroupLeaders(slug, groupId, memberId, 'join', group.name);

    logAudit(slug, {
      userId: null, userName: `${req.portal.name} (portal)`,
      action: 'create', entityType: 'group_member',
      entityId: groupId, entityName: group.name,
      detail: waitingSince ? 'Added to waiting list via portal' : 'Joined group via portal',
    });

    res.json({
      message: waitingSince
        ? `You have been added to the waiting list for ${group.name}.`
        : `You have joined ${group.name}.`,
      waiting: !!waitingSince,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /groups/:groupId/leave ─────────────────────────────────────────────

router.post('/groups/:groupId/leave', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const { groupId } = req.params;

    const [group] = await tenantQuery(slug,
      `SELECT id, name FROM groups WHERE id = $1`, [groupId]);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const [membership] = await tenantQuery(slug,
      `SELECT id FROM group_members WHERE group_id = $1 AND member_id = $2`,
      [groupId, memberId]);
    if (!membership) {
      return res.status(400).json({ error: 'You are not a member of this group.' });
    }

    await tenantQuery(slug,
      `DELETE FROM group_members WHERE group_id = $1 AND member_id = $2`,
      [groupId, memberId]);

    // Notify group leader (stubbed)
    await notifyGroupLeaders(slug, groupId, memberId, 'leave', group.name);

    logAudit(slug, {
      userId: null, userName: `${req.portal.name} (portal)`,
      action: 'delete', entityType: 'group_member',
      entityId: groupId, entityName: group.name,
      detail: 'Left group via portal',
    });

    res.json({ message: `You have left ${group.name}.` });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10.2.3 — CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

function fmtDateUK(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function fmtTime(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  if (idx !== -1) return s.slice(idx + 1, idx + 6);
  return s.slice(0, 5);
}

router.get('/calendar', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const { from, to, groupId, filter } = req.query;
    // filter: 'all' | 'own' | groupId

    const [settings] = await tenantQuery(slug,
      `SELECT portal_config, calendar_config
       FROM tenant_settings WHERE id = 'singleton'`);
    const portalConfig = { calendar: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.calendar) {
      return res.status(403).json({ error: 'Calendar viewing is not enabled for this organisation.' });
    }

    const calConfig = {
      venue: { members: false }, topic: { members: false },
      enquiries: { members: false }, detail: { members: false },
      download: { members: false },
      ...(settings?.calendar_config ?? {}),
    };

    const conditions = [];
    const params = [];
    let i = 1;

    if (from) {
      conditions.push(`ge.event_date >= $${i++}::date`);
      params.push(from);
    }
    if (to) {
      conditions.push(`ge.event_date <= $${i++}::date`);
      params.push(to);
    }

    if (filter === 'own') {
      // Own groups + general/open meetings
      conditions.push(`(ge.group_id IS NULL OR ge.group_id IN (SELECT group_id FROM group_members WHERE member_id = $${i++}))`);
      params.push(memberId);
    } else if (groupId) {
      conditions.push(`ge.group_id = $${i++}`);
      params.push(groupId);
    }
    // 'all' = no group filter

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const events = await tenantQuery(slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, g.name AS group_name,
              ge.venue_id, v.name AS venue_name, v.postcode AS venue_postcode,
              ge.topic, ge.contact, ge.details, ge.is_private
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params);

    // Filter fields based on calendarConfig
    const result = events.map(ev => ({
      id: ev.id,
      eventDate: ev.event_date,
      startTime: ev.start_time,
      endTime: ev.end_time,
      groupId: ev.group_id,
      groupName: ev.group_name || 'Open Meeting',
      ...(calConfig.venue?.members && {
        venue: ev.venue_name || null,
        venuePostcode: ev.venue_postcode || null,
      }),
      ...(calConfig.topic?.members && { topic: ev.topic || null }),
      ...(calConfig.enquiries?.members && { contact: ev.contact || null }),
      ...(calConfig.detail?.members && { details: ev.details || null }),
    }));

    // Also return groups list for filter dropdown
    const groups = await tenantQuery(slug,
      `SELECT DISTINCT g.id, g.name
       FROM groups g
       WHERE g.status = 'active'
       ORDER BY g.name`);

    res.json({ events: result, groups, canDownload: calConfig.download?.members ?? false });
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/pdf ───────────────────────────────────────────────────────

router.get('/calendar/pdf', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const { from, to, groupId, filter } = req.query;

    const [settings] = await tenantQuery(slug,
      `SELECT calendar_config FROM tenant_settings WHERE id = 'singleton'`);
    const calConfig = { download: { members: false }, ...(settings?.calendar_config ?? {}) };
    if (!calConfig.download?.members) {
      return res.status(403).json({ error: 'Calendar download is not enabled.' });
    }

    const conditions = [];
    const params = [];
    let i = 1;

    if (from) { conditions.push(`ge.event_date >= $${i++}::date`); params.push(from); }
    if (to) { conditions.push(`ge.event_date <= $${i++}::date`); params.push(to); }
    if (filter === 'own') {
      conditions.push(`(ge.group_id IS NULL OR ge.group_id IN (SELECT group_id FROM group_members WHERE member_id = $${i++}))`);
      params.push(memberId);
    } else if (groupId) {
      conditions.push(`ge.group_id = $${i++}`);
      params.push(groupId);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const events = await tenantQuery(slug,
      `SELECT ge.event_date, ge.start_time, ge.end_time,
              g.name AS group_name, v.name AS venue_name,
              ge.topic, ge.contact, ge.details
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params);

    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const u3aName = tenant?.name ?? slug;

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, autoFirstPage: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    doc.font('Helvetica-Bold').fontSize(16)
      .text(`${u3aName} Calendar`, { align: 'center' });
    if (from || to) {
      doc.font('Helvetica').fontSize(10)
        .text(`${fmtDateUK(from)} to ${fmtDateUK(to)}`, { align: 'center' });
    }
    doc.moveDown(0.5);

    const cols = [
      { label: 'Date & Time', x: 40, w: 130 },
      { label: 'Until', x: 170, w: 50 },
      { label: 'Group', x: 220, w: 120 },
      { label: 'Venue', x: 340, w: 120 },
      { label: 'Topic', x: 460, w: 180 },
      { label: 'Enquiries', x: 640, w: 160 },
    ];

    function drawHeader(y) {
      doc.font('Helvetica-Bold').fontSize(8);
      for (const col of cols) {
        doc.text(col.label, col.x, y, { width: col.w, ellipsis: true });
      }
      doc.moveTo(40, y + 12).lineTo(800, y + 12).lineWidth(0.5).stroke();
      return y + 16;
    }

    let y = drawHeader(doc.y);
    doc.font('Helvetica').fontSize(8);
    for (const ev of events) {
      if (y > 540) {
        doc.addPage();
        y = drawHeader(40);
        doc.font('Helvetica').fontSize(8);
      }
      const dateStr = fmtDateUK(ev.event_date) + (ev.start_time ? ' ' + fmtTime(ev.start_time) : '');
      doc.text(dateStr,                    cols[0].x, y, { width: cols[0].w, ellipsis: true });
      doc.text(fmtTime(ev.end_time),      cols[1].x, y, { width: cols[1].w, ellipsis: true });
      doc.text(ev.group_name || 'Open Meeting', cols[2].x, y, { width: cols[2].w, ellipsis: true });
      doc.text(ev.venue_name || '',        cols[3].x, y, { width: cols[3].w, ellipsis: true });
      doc.text(ev.topic || '',             cols[4].x, y, { width: cols[4].w, ellipsis: true });
      doc.text(ev.contact || '',           cols[5].x, y, { width: cols[5].w, ellipsis: true });
      y += 14;
    }

    doc.end();
    await new Promise((resolve) => doc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="calendar_${stamp}.pdf"`);
    res.send(pdfBuffer);
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

    const [settings] = await tenantQuery(slug,
      `SELECT portal_config FROM tenant_settings WHERE id = 'singleton'`);
    const portalConfig = { personalDetails: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.personalDetails) {
      return res.status(403).json({ error: 'Personal details editing is not enabled.' });
    }

    const [member] = await tenantQuery(slug,
      `SELECT m.id, m.title, m.forenames, m.surname, m.known_as, m.initials,
              m.suffix, m.email, m.mobile, m.emergency_contact, m.hide_contact,
              m.portal_email,
              (m.photo_data IS NOT NULL AND m.photo_mime_type IS NOT NULL) AS has_photo,
              a.house_no, a.street, a.add_line1, a.town, a.county, a.postcode, a.telephone
       FROM members m
       LEFT JOIN addresses a ON a.id = m.address_id
       WHERE m.id = $1`, [memberId]);

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
  title:       z.string().max(20).optional(),
  forenames:   z.string().min(1).max(100),
  surname:     z.string().min(1).max(100),
  knownAs:     z.string().max(100).optional(),
  initials:    z.string().max(20).optional(),
  suffix:      z.string().max(30).optional(),
  email:       z.string().email(),
  mobile:      z.string().max(30).optional(),
  emergencyContact: z.string().max(200).optional(),
  hideContact: z.boolean().optional(),
  address: z.object({
    houseNo:   z.string().max(100).optional(),
    street:    z.string().max(100).optional(),
    addLine1:  z.string().max(100).optional(),
    town:      z.string().max(100).optional(),
    county:    z.string().max(100).optional(),
    postcode:  z.string().min(1, 'Postcode is required'),
    telephone: z.string().max(30).optional(),
  }),
});

router.patch('/personal-details', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const data = updateDetailsSchema.parse(req.body);

    const [settings] = await tenantQuery(slug,
      `SELECT portal_config FROM tenant_settings WHERE id = 'singleton'`);
    const portalConfig = { personalDetails: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.personalDetails) {
      return res.status(403).json({ error: 'Personal details editing is not enabled.' });
    }

    // Get current member to check email change
    const [current] = await tenantQuery(slug,
      `SELECT email, portal_email, address_id FROM members WHERE id = $1`, [memberId]);
    if (!current) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const emailChanged = data.email.toLowerCase() !== (current.email || '').toLowerCase();

    // Derive initials from forenames
    const initials = data.initials || data.forenames.split(/\s+/).map(n => n[0]?.toUpperCase()).filter(Boolean).join('');

    // Update member fields
    await tenantQuery(slug,
      `UPDATE members SET
         title = $1, forenames = $2, surname = $3, known_as = $4, initials = $5,
         suffix = $6, email = $7, mobile = $8, emergency_contact = $9,
         hide_contact = $10, updated_at = now()
       WHERE id = $11`,
      [
        data.title ?? null, data.forenames, data.surname,
        data.knownAs ?? null, initials, data.suffix ?? null,
        data.email.toLowerCase(), data.mobile ?? null,
        data.emergencyContact ?? null, data.hideContact ?? false,
        memberId,
      ]);

    // Update address
    if (current.address_id) {
      const addr = data.address;
      await tenantQuery(slug,
        `UPDATE addresses SET
           house_no = $1, street = $2, add_line1 = $3, town = $4, county = $5,
           postcode = $6, telephone = $7, updated_at = now()
         WHERE id = $8`,
        [
          addr.houseNo ?? null, addr.street ?? null, addr.addLine1 ?? null,
          addr.town ?? null, addr.county ?? null,
          addr.postcode.trim().toUpperCase(), addr.telephone ?? null,
          current.address_id,
        ]);
    }

    // If email changed, require re-verification
    if (emailChanged) {
      const verificationToken = generateToken();
      const verificationExpires = new Date(Date.now() + 60 * 60 * 1000);

      await tenantQuery(slug,
        `UPDATE members SET
           portal_email = $1,
           portal_email_verified = false,
           portal_verification_token = $2,
           portal_verification_expires = $3,
           updated_at = now()
         WHERE id = $4`,
        [data.email.toLowerCase(), verificationToken, verificationExpires, memberId]);

      const frontendBase = process.env.CORS_ORIGIN || 'http://localhost:5173';
      const verifyLink = `${frontendBase}/public/${slug}/portal/verify?token=${verificationToken}`;
      console.log(`[Portal] Would send email verification to ${data.email}: ${verifyLink}`);
    }

    // Send confirmation email via system_messages template
    await sendDetailsUpdateEmail(slug, memberId, emailChanged);

    logAudit(slug, {
      userId: null, userName: `${req.portal.name} (portal)`,
      action: 'update', entityType: 'member',
      entityId: memberId, entityName: `${data.forenames} ${data.surname}`,
      detail: emailChanged ? 'Personal details updated via portal (email changed)' : 'Personal details updated via portal',
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
  data:     z.string().min(1, 'Photo data is required'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif'], {
    errorMap: () => ({ message: 'Photo must be jpg, png, or gif' }),
  }),
});

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

router.post('/photo', express.json({ limit: '4mb' }), async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    // Check personal details is enabled (photo upload is part of personal details)
    const [settings] = await tenantQuery(slug,
      `SELECT portal_config FROM tenant_settings WHERE id = 'singleton'`);
    const portalConfig = { personalDetails: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.personalDetails) {
      return res.status(403).json({ error: 'Personal details editing is not enabled.' });
    }

    const { data, mimeType } = portalPhotoUploadSchema.parse(req.body);

    const byteLength = Buffer.from(data, 'base64').length;
    if (byteLength > MAX_PHOTO_BYTES) {
      return res.status(400).json({ error: `Photo exceeds the 2 MB limit (${(byteLength / 1024 / 1024).toFixed(1)} MB).` });
    }

    await tenantQuery(slug,
      `UPDATE members SET photo_data = $1, photo_mime_type = $2, updated_at = now() WHERE id = $3`,
      [data, mimeType, memberId]);

    logAudit(slug, { userId: null, userName: `${req.portal.name} (portal)`, action: 'change', entityType: 'member', entityId: memberId, detail: 'Photo uploaded via portal' });
    res.json({ message: 'Photo uploaded.' });
  } catch (err) { next(err); }
});

router.delete('/photo', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [settings] = await tenantQuery(slug,
      `SELECT portal_config FROM tenant_settings WHERE id = 'singleton'`);
    const portalConfig = { personalDetails: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.personalDetails) {
      return res.status(403).json({ error: 'Personal details editing is not enabled.' });
    }

    await tenantQuery(slug,
      `UPDATE members SET photo_data = NULL, photo_mime_type = NULL, updated_at = now() WHERE id = $1`,
      [memberId]);

    logAudit(slug, { userId: null, userName: `${req.portal.name} (portal)`, action: 'change', entityType: 'member', entityId: memberId, detail: 'Photo removed via portal' });
    res.json({ message: 'Photo removed.' });
  } catch (err) { next(err); }
});

router.get('/photo', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [member] = await tenantQuery(slug,
      `SELECT photo_data, photo_mime_type FROM members WHERE id = $1`, [memberId]);

    if (!member || !member.photo_data) {
      return res.status(404).json({ error: 'No photo found.' });
    }
    const buf = Buffer.from(member.photo_data, 'base64');
    res.setHeader('Content-Type', member.photo_mime_type);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buf);
  } catch (err) { next(err); }
});

// ─── POST /change-password ───────────────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(72).refine(
    (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw),
    { message: 'Password must contain at least one uppercase, one lowercase, and one numeric character.' },
  ),
});

router.post('/change-password', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const data = changePasswordSchema.parse(req.body);

    const [member] = await tenantQuery(slug,
      `SELECT portal_password_hash FROM members WHERE id = $1`, [memberId]);
    if (!member?.portal_password_hash) {
      return res.status(400).json({ error: 'Portal account not found.' });
    }

    const valid = await verifyPassword(data.currentPassword, member.portal_password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(data.newPassword);
    await tenantQuery(slug,
      `UPDATE members SET portal_password_hash = $1, updated_at = now() WHERE id = $2`,
      [newHash, memberId]);

    logAudit(slug, {
      userId: null, userName: `${req.portal.name} (portal)`,
      action: 'update', entityType: 'portal_password',
      entityId: memberId, entityName: req.portal.name,
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

    const [settings] = await tenantQuery(slug,
      `SELECT portal_config, year_start_month, year_start_day,
              grace_lapse_weeks
       FROM tenant_settings WHERE id = 'singleton'`);
    const portalConfig = { replacementCard: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.replacementCard) {
      return res.status(403).json({ error: 'Card replacement is not enabled.' });
    }

    // Get member with status
    const [member] = await tenantQuery(slug,
      `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
              m.email, m.next_renewal, m.portal_email,
              ms.name AS status_name
       FROM members m
       LEFT JOIN member_statuses ms ON m.status_id = ms.id
       WHERE m.id = $1`, [memberId]);

    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    // Must be Current status
    if (!member.status_name || !member.status_name.toLowerCase().includes('current')) {
      return res.status(400).json({ error: 'Card replacement is only available for current members.' });
    }

    // Must be within standard renewal period (not in grace period)
    if (member.next_renewal) {
      const renewal = new Date(member.next_renewal);
      if (renewal < new Date()) {
        return res.status(400).json({ error: 'Your membership renewal date has passed. Please renew your membership first.' });
      }
    }

    // Send the card confirmation email (stub)
    const emailAddr = member.portal_email || member.email;
    if (!emailAddr) {
      return res.status(400).json({ error: 'No email address on file.' });
    }

    // Use the card replacement system message
    const [template] = await tenantQuery(slug,
      `SELECT subject, body FROM system_messages WHERE id = 'card_replacement_confirm'`);

    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const u3aName = tenant?.name ?? slug;

    if (template) {
      const { subject, body } = resolveTokens(
        template.subject, template.body,
        { ...member }, u3aName,
      );
      console.log(`[Portal] Would send card replacement email to ${emailAddr}: "${subject}"`);
      console.log(`[Portal] (In production, attach single-card PDF)`);
    }

    // Mark card as not printed so admin knows to reprint
    await tenantQuery(slug,
      `UPDATE members SET card_printed = false, updated_at = now() WHERE id = $1`,
      [memberId]);

    logAudit(slug, {
      userId: null, userName: `${req.portal.name} (portal)`,
      action: 'create', entityType: 'card_replacement',
      entityId: memberId, entityName: `${member.forenames} ${member.surname}`,
    });

    res.json({ message: 'A replacement membership card has been sent to your email address.' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function notifyGroupLeaders(slug, groupId, memberId, action, groupName) {
  try {
    const leaders = await tenantQuery(slug,
      `SELECT m.email, m.forenames, m.surname
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
       WHERE gm.group_id = $1 AND gm.is_leader = true`,
      [groupId]);

    const [member] = await tenantQuery(slug,
      `SELECT forenames, surname FROM members WHERE id = $1`, [memberId]);
    const memberName = member ? `${member.forenames} ${member.surname}` : 'A member';

    for (const leader of leaders) {
      if (leader.email) {
        const verb = action === 'join' ? 'joined' : 'left';
        console.log(`[Portal] Would notify leader ${leader.forenames} ${leader.surname} (${leader.email}): ${memberName} has ${verb} ${groupName}`);
      }
    }
  } catch (err) {
    console.error('[Portal] Failed to notify group leaders:', err.message);
  }
}

async function sendDetailsUpdateEmail(slug, memberId, emailChanged) {
  try {
    const [member] = await tenantQuery(slug,
      `SELECT forenames, surname, email, portal_email FROM members WHERE id = $1`, [memberId]);
    if (!member) return;

    const emailAddr = emailChanged ? member.portal_email : (member.portal_email || member.email);
    if (!emailAddr) return;

    // Try to use a system message template
    const [template] = await tenantQuery(slug,
      `SELECT subject, body FROM system_messages WHERE id = 'portal_details_updated'`);

    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const u3aName = tenant?.name ?? slug;

    if (template) {
      const { subject, body } = resolveTokens(
        template.subject, template.body,
        member, u3aName,
      );
      console.log(`[Portal] Would send details update confirmation to ${emailAddr}: "${subject}"`);
    } else {
      console.log(`[Portal] Would send details update confirmation to ${emailAddr} (no template found for 'portal_details_updated')`);
    }
  } catch (err) {
    console.error('[Portal] Failed to send details update email:', err.message);
  }
}

export default router;
