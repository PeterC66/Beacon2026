// beacon2/backend/src/routes/calendar.js
// Calendar — aggregated view of all group_events (including open meetings).

import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── GET /calendar/events ─────────────────────────────────────────────────────
// Returns all events across all groups + open meetings within a date range.
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&memberId=...&venueId=...&groupId=...

router.get('/events', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { from, to, memberId, venueId, groupId } = req.query;

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
    if (venueId) {
      conditions.push(`ge.venue_id = $${i++}`);
      params.push(venueId);
    }
    if (groupId) {
      conditions.push(`ge.group_id = $${i++}`);
      params.push(groupId);
    }
    if (memberId) {
      conditions.push(`(ge.group_id IS NULL OR ge.group_id IN (SELECT group_id FROM group_members WHERE member_id = $${i++}))`);
      params.push(memberId);
    }

    const where = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, g.name AS group_name,
              ge.venue_id, v.name AS venue_name, v.postcode AS venue_postcode,
              ge.topic, ge.contact, ge.details, ge.is_private
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params,
    );
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/events/pdf ─────────────────────────────────────────────────
// Same filters as GET /events, but returns a PDF download.

router.get('/events/pdf', requirePrivilege('calendar', 'download'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { from, to, memberId, venueId, groupId } = req.query;

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
    if (venueId) {
      conditions.push(`ge.venue_id = $${i++}`);
      params.push(venueId);
    }
    if (groupId) {
      conditions.push(`ge.group_id = $${i++}`);
      params.push(groupId);
    }
    if (memberId) {
      conditions.push(`(ge.group_id IS NULL OR ge.group_id IN (SELECT group_id FROM group_members WHERE member_id = $${i++}))`);
      params.push(memberId);
    }

    const where = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, g.name AS group_name,
              ge.venue_id, v.name AS venue_name,
              ge.topic, ge.contact, ge.details
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params,
    );

    // Build PDF
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, autoFirstPage: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const fromLabel = from || '?';
    const toLabel = to || '?';
    doc.font('Helvetica-Bold').fontSize(16)
      .text(`Calendar ${fmtDateUK(fromLabel)} to ${fmtDateUK(toLabel)}`, { align: 'center' });
    doc.moveDown(0.5);

    // Table header
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
      const endStr = fmtTime(ev.end_time);
      const group = ev.group_name || 'Open Meeting';
      const venue = ev.venue_name || '';
      const topic = ev.topic || '';
      const contact = ev.contact || '';

      doc.text(dateStr, cols[0].x, y, { width: cols[0].w, ellipsis: true });
      doc.text(endStr,  cols[1].x, y, { width: cols[1].w, ellipsis: true });
      doc.text(group,   cols[2].x, y, { width: cols[2].w, ellipsis: true });
      doc.text(venue,   cols[3].x, y, { width: cols[3].w, ellipsis: true });
      doc.text(topic,   cols[4].x, y, { width: cols[4].w, ellipsis: true });
      doc.text(contact, cols[5].x, y, { width: cols[5].w, ellipsis: true });

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

// ─── GET /calendar/members/search ─────────────────────────────────────────────
// Search members by name for the calendar member filter.
// Query: ?q=search_term

router.get('/members/search', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const members = await tenantQuery(
      slug,
      `SELECT id, member_no, first_name, last_name
       FROM members
       WHERE (first_name || ' ' || last_name) ILIKE '%' || $1 || '%'
          OR last_name ILIKE $1 || '%'
       ORDER BY last_name, first_name
       LIMIT 20`,
      [q],
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OPEN MEETINGS  — events with group_id = NULL
// ─────────────────────────────────────────────────────────────────────────────

// ─── GET /calendar/open-events ────────────────────────────────────────────────

router.get('/open-events', requirePrivilege('meetings', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.venue_id, v.name AS venue_name,
              ge.topic, ge.contact, ge.details, ge.is_private,
              ge.created_at, ge.updated_at
       FROM group_events ge
       LEFT JOIN venues v ON v.id = ge.venue_id
       WHERE ge.group_id IS NULL
       ORDER BY ge.event_date, ge.start_time`,
    );
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// ─── POST /calendar/open-events ───────────────────────────────────────────────

const openEventSchema = z.object({
  eventDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:    z.string().nullable().optional(),
  endTime:      z.string().nullable().optional(),
  venueId:      z.string().nullable().optional(),
  topic:        z.string().nullable().optional(),
  contact:      z.string().nullable().optional(),
  details:      z.string().nullable().optional(),
  isPrivate:    z.boolean().default(false),
  repeatEvery:  z.number().int().positive().nullable().optional(),
  repeatUnit:   z.enum(['days', 'weeks', 'months']).optional(),
  repeatUntil:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

router.post('/open-events', requirePrivilege('meetings', 'create'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = openEventSchema.parse(req.body);

    // Build list of dates (same recurrence logic as group events)
    const dates = [data.eventDate];
    if (data.repeatEvery && data.repeatUnit && data.repeatUntil) {
      let current = new Date(data.eventDate);
      const until = new Date(data.repeatUntil);
      let safety = 0;
      while (safety++ < 500) {
        if (data.repeatUnit === 'days') {
          current = new Date(current.getTime() + data.repeatEvery * 86400000);
        } else if (data.repeatUnit === 'weeks') {
          current = new Date(current.getTime() + data.repeatEvery * 7 * 86400000);
        } else {
          const d = new Date(current);
          d.setMonth(d.getMonth() + data.repeatEvery);
          current = d;
        }
        if (current > until) break;
        dates.push(current.toISOString().slice(0, 10));
      }
    }

    const created = [];
    for (const date of dates) {
      const [ev] = await tenantQuery(
        slug,
        `INSERT INTO group_events
           (group_id, event_date, start_time, end_time, venue_id, topic, contact, details, is_private)
         VALUES (NULL, $1::date, $2::time, $3::time, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          date,
          data.startTime ?? null,
          data.endTime ?? null,
          data.venueId ?? null,
          data.topic ?? null,
          data.contact ?? null,
          data.details ?? null,
          data.isPrivate,
        ],
      );
      created.push(ev);
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /calendar/open-events/:eventId ─────────────────────────────────────

const updateOpenEventSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().nullable().optional(),
  endTime:   z.string().nullable().optional(),
  venueId:   z.string().nullable().optional(),
  topic:     z.string().nullable().optional(),
  contact:   z.string().nullable().optional(),
  details:   z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
});

const EVENT_FIELDS = [
  ['eventDate', 'event_date', '::date'],
  ['startTime', 'start_time', '::time'],
  ['endTime',   'end_time',   '::time'],
  ['venueId',   'venue_id'],
  ['topic',     'topic'],
  ['contact',   'contact'],
  ['details',   'details'],
  ['isPrivate', 'is_private'],
];

router.patch('/open-events/:eventId', requirePrivilege('meetings', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = updateOpenEventSchema.parse(req.body);

    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [jsKey, col, cast = ''] of EVENT_FIELDS) {
      if (data[jsKey] !== undefined) {
        setClauses.push(`${col} = $${i++}${cast}`);
        values.push(data[jsKey] ?? null);
      }
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }
    setClauses.push(`updated_at = now()`);
    values.push(req.params.eventId);

    const [ev] = await tenantQuery(
      slug,
      `UPDATE group_events SET ${setClauses.join(', ')}
       WHERE id = $${i} AND group_id IS NULL
       RETURNING *`,
      values,
    );
    if (!ev) throw AppError('Open event not found.', 404);
    res.json(ev);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /calendar/open-events ─────────────────────────────────────────────
// Body: { ids: ['...', '...'] }

router.delete('/open-events', requirePrivilege('meetings', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);

    const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');
    const result = await tenantQuery(
      slug,
      `DELETE FROM group_events WHERE group_id IS NULL AND id IN (${placeholders}) RETURNING id`,
      ids,
    );
    res.json({ deleted: result.length });
  } catch (err) {
    next(err);
  }
});

export default router;
