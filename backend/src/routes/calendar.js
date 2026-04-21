// beacon2/backend/src/routes/calendar.js
// Calendar — aggregated view of all group_events (including open meetings).

import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { tenantQuery, escapeLike } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);
router.use(requireFeature('events'));

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
//        &eventTypeId=... (filter to a specific event type)

router.get('/events', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { from, to, memberId, venueId, groupId, eventTypeId, groupsOnly } = req.query;

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
    } else if (groupsOnly === 'true') {
      conditions.push(`ge.group_id IS NOT NULL`);
    }
    if (eventTypeId) {
      conditions.push(`ge.event_type_id = $${i++}`);
      params.push(eventTypeId);
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
              ge.group_id, g.name AS group_name, g.type AS group_type,
              ge.event_type_id, et.name AS event_type_name,
              ge.venue_id, v.name AS venue_name, v.postcode AS venue_postcode,
              ge.topic, ge.contact, ge.details, ge.is_private
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
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
    const { from, to, memberId, venueId, groupId, eventTypeId, groupsOnly } = req.query;

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
    } else if (groupsOnly === 'true') {
      conditions.push(`ge.group_id IS NOT NULL`);
    }
    if (eventTypeId) {
      conditions.push(`ge.event_type_id = $${i++}`);
      params.push(eventTypeId);
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
              ge.event_type_id, et.name AS event_type_name,
              ge.venue_id, v.name AS venue_name,
              ge.topic, ge.contact, ge.details
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
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
      const group = ev.group_name || ev.event_type_name || 'Open Meeting';
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
    const tenantPart = slug.replace(/^u3a_/, '');
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${tenantPart}_calendar_${stamp}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/events/excel ───────────────────────────────────────────────
// Same filters as GET /events, but returns an Excel (.xlsx) download.

router.get('/events/excel', requirePrivilege('calendar', 'download'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { from, to, memberId, venueId, groupId, eventTypeId, groupsOnly } = req.query;

    const conditions = [];
    const params = [];
    let i = 1;

    if (from)        { conditions.push(`ge.event_date >= $${i++}::date`); params.push(from); }
    if (to)          { conditions.push(`ge.event_date <= $${i++}::date`); params.push(to); }
    if (venueId)     { conditions.push(`ge.venue_id = $${i++}`);         params.push(venueId); }
    if (groupId)     { conditions.push(`ge.group_id = $${i++}`);         params.push(groupId); }
    else if (groupsOnly === 'true') { conditions.push(`ge.group_id IS NOT NULL`); }
    if (eventTypeId) { conditions.push(`ge.event_type_id = $${i++}`);    params.push(eventTypeId); }
    if (memberId) {
      conditions.push(`(ge.group_id IS NULL OR ge.group_id IN (SELECT group_id FROM group_members WHERE member_id = $${i++}))`);
      params.push(memberId);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const events = await tenantQuery(
      slug,
      `SELECT ge.event_date, ge.start_time, ge.end_time,
              g.name AS group_name, et.name AS event_type_name,
              v.name AS venue_name, v.postcode AS venue_postcode,
              ge.topic, ge.contact, ge.details
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params,
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Events');

    ws.addRow([`Events ${fmtDateUK(from || '?')} to ${fmtDateUK(to || '?')}`]).font = { bold: true, size: 14 };
    ws.addRow([]);

    const header = ws.addRow(['Date', 'Start', 'End', 'Group / Type', 'Topic', 'Venue', 'Postcode', 'Contact', 'Details']);
    header.font = { bold: true };

    for (const ev of events) {
      ws.addRow([
        fmtDateUK(ev.event_date),
        fmtTime(ev.start_time),
        fmtTime(ev.end_time),
        ev.group_name || ev.event_type_name || '',
        ev.topic || '',
        ev.venue_name || '',
        ev.venue_postcode || '',
        ev.contact || '',
        ev.details || '',
      ]);
    }

    ws.columns.forEach((col) => { col.width = Math.max(10, (col.values || []).reduce((m, v) => Math.max(m, String(v ?? '').length + 2), 0)); });

    const tenantPart = slug.replace(/^u3a_/, '');
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${tenantPart}_events_${stamp}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
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
      [escapeLike(q)],
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/event-types ────────────────────────────────────────────────
// Returns all event types for the calendar UI dropdown (requires calendar:view).

router.get('/event-types', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, description, is_default FROM event_types ORDER BY is_default DESC, name`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NON-GROUP EVENTS  — events with group_id = NULL, filtered by event type
// ─────────────────────────────────────────────────────────────────────────────

// ─── GET /calendar/open-events ────────────────────────────────────────────────
// Query: ?eventTypeId=... to filter by event type

router.get('/open-events', requirePrivilege('meetings', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { eventTypeId } = req.query;

    const conditions = ['ge.group_id IS NULL'];
    const params = [];
    let i = 1;
    if (eventTypeId) {
      conditions.push(`ge.event_type_id = $${i++}`);
      params.push(eventTypeId);
    }
    const where = 'WHERE ' + conditions.join(' AND ');

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.venue_id, v.name AS venue_name,
              ge.event_type_id, et.name AS event_type_name,
              ge.topic, ge.contact, ge.details, ge.is_private,
              ge.created_at, ge.updated_at
       FROM group_events ge
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       ${where}
       ORDER BY ge.event_date, ge.start_time`,
      params,
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
  eventTypeId:  z.string().nullable().optional(),
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
           (group_id, event_date, start_time, end_time, venue_id, topic, contact, details, is_private, event_type_id)
         VALUES (NULL, $1::date, $2::time, $3::time, $4, $5, $6, $7, $8, $9)
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
          data.eventTypeId ?? null,
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
  eventDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime:   z.string().nullable().optional(),
  endTime:     z.string().nullable().optional(),
  venueId:     z.string().nullable().optional(),
  topic:       z.string().nullable().optional(),
  contact:     z.string().nullable().optional(),
  details:     z.string().nullable().optional(),
  isPrivate:   z.boolean().optional(),
  eventTypeId: z.string().nullable().optional(),
});

const EVENT_FIELDS = [
  ['eventDate',   'event_date',    '::date'],
  ['startTime',   'start_time',    '::time'],
  ['endTime',     'end_time',      '::time'],
  ['venueId',     'venue_id'],
  ['topic',       'topic'],
  ['contact',     'contact'],
  ['details',     'details'],
  ['isPrivate',   'is_private'],
  ['eventTypeId', 'event_type_id'],
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

// ─────────────────────────────────────────────────────────────────────────────
// EVENT SEARCH  (for TransactionEditor event selector)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/events/search', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    if (q.length < 2) return res.json([]);

    const rows = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time,
              ge.group_id, g.name AS group_name,
              ge.event_type_id, et.name AS event_type_name,
              ge.topic
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       WHERE ge.topic ILIKE '%' || $1 || '%'
          OR g.name ILIKE '%' || $1 || '%'
          OR ge.event_date::text ILIKE '%' || $1 || '%'
       ORDER BY ge.event_date DESC
       LIMIT $2`,
      [q, limit],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE EVENT  (for EventRecord page)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/events/:eventId', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [ev] = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, g.name AS group_name, g.type AS group_type,
              ge.event_type_id, et.name AS event_type_name,
              ge.venue_id, v.name AS venue_name, v.postcode AS venue_postcode,
              ge.topic, ge.contact, ge.details, ge.is_private,
              ge.created_at, ge.updated_at,
              (SELECT COUNT(*) FROM event_members em WHERE em.event_id = ge.id)::int AS member_count
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       WHERE ge.id = $1`,
      [req.params.eventId],
    );
    if (!ev) throw AppError('Event not found.', 404);
    res.json(ev);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENT MEMBERS  (attendance/organiser tracking per event)
// ─────────────────────────────────────────────────────────────────────────────

// ─── GET /calendar/events/:eventId/members ───────────────────────────────────

router.get('/events/:eventId/members', requireFeature('eventAttendance'), requirePrivilege('event_attendance', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const rows = await tenantQuery(
      slug,
      `SELECT em.id, em.event_id, em.member_id, em.is_organiser, em.notes, em.created_at,
              m.membership_number, m.forenames, m.surname, m.email
       FROM event_members em
       JOIN members m ON m.id = em.member_id
       WHERE em.event_id = $1
       ORDER BY em.is_organiser DESC, m.surname, m.forenames`,
      [req.params.eventId],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── POST /calendar/events/:eventId/members ──────────────────────────────────

const addEventMembersSchema = z.object({
  memberIds:   z.array(z.string()).min(1),
  isOrganiser: z.boolean().default(false),
});

router.post('/events/:eventId/members', requireFeature('eventAttendance'), requirePrivilege('event_attendance', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { eventId } = req.params;
    const data = addEventMembersSchema.parse(req.body);

    // Verify event exists
    const [ev] = await tenantQuery(slug, `SELECT id FROM group_events WHERE id = $1`, [eventId]);
    if (!ev) throw AppError('Event not found.', 404);

    const inserted = [];
    for (const memberId of data.memberIds) {
      const [row] = await tenantQuery(
        slug,
        `INSERT INTO event_members (event_id, member_id, is_organiser)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, member_id) DO NOTHING
         RETURNING *`,
        [eventId, memberId, data.isOrganiser],
      );
      if (row) inserted.push(row);
    }

    await logAudit(slug, req.user, 'add_event_members', 'group_events', eventId, null,
      `Added ${inserted.length} member(s) to event`);

    res.status(201).json(inserted);
  } catch (err) {
    next(err);
  }
});

// ─── POST /calendar/events/:eventId/members/from-group ───────────────────────

router.post('/events/:eventId/members/from-group', requireFeature('eventAttendance'), requirePrivilege('event_attendance', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { eventId } = req.params;

    // Verify event exists and has a group
    const [ev] = await tenantQuery(slug,
      `SELECT id, group_id FROM group_events WHERE id = $1`, [eventId]);
    if (!ev) throw AppError('Event not found.', 404);
    if (!ev.group_id) throw AppError('Event is not linked to a group.', 400);

    // Copy group members in a single INSERT...SELECT
    const result = await tenantQuery(
      slug,
      `INSERT INTO event_members (event_id, member_id, is_organiser)
       SELECT $1, gm.member_id, gm.is_leader
       FROM group_members gm
       WHERE gm.group_id = $2
       ON CONFLICT (event_id, member_id) DO NOTHING
       RETURNING id`,
      [eventId, ev.group_id],
    );

    await logAudit(slug, req.user, 'copy_group_to_event', 'group_events', eventId, null,
      `Copied ${result.length} member(s) from group`);

    res.status(201).json({ added: result.length });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /calendar/events/:eventId/members/:memberId ───────────────────────

const updateEventMemberSchema = z.object({
  isOrganiser: z.boolean().optional(),
  notes:       z.string().nullable().optional(),
});

router.patch('/events/:eventId/members/:memberId', requireFeature('eventAttendance'), requirePrivilege('event_attendance', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { eventId, memberId } = req.params;
    const data = updateEventMemberSchema.parse(req.body);

    const setClauses = [];
    const values = [];
    let i = 1;
    if (data.isOrganiser !== undefined) {
      setClauses.push(`is_organiser = $${i++}`);
      values.push(data.isOrganiser);
    }
    if (data.notes !== undefined) {
      setClauses.push(`notes = $${i++}`);
      values.push(data.notes);
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    values.push(eventId, memberId);
    const [row] = await tenantQuery(
      slug,
      `UPDATE event_members SET ${setClauses.join(', ')}
       WHERE event_id = $${i++} AND member_id = $${i}
       RETURNING *`,
      values,
    );
    if (!row) throw AppError('Event member not found.', 404);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /calendar/events/:eventId/members ────────────────────────────────

router.delete('/events/:eventId/members', requireFeature('eventAttendance'), requirePrivilege('event_attendance', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { eventId } = req.params;
    const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);

    const placeholders = ids.map((_, idx) => `$${idx + 2}`).join(', ');
    const result = await tenantQuery(
      slug,
      `DELETE FROM event_members
       WHERE event_id = $1 AND member_id IN (${placeholders})
       RETURNING id`,
      [eventId, ...ids],
    );

    await logAudit(slug, req.user, 'remove_event_members', 'group_events', eventId, null,
      `Removed ${result.length} member(s) from event`);

    res.json({ deleted: result.length });
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/events/:eventId/members/download ──────────────────────────

router.get('/events/:eventId/members/download', requireFeature('eventAttendance'), requirePrivilege('event_attendance', 'download'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { eventId } = req.params;

    // Get event info for the title
    const [ev] = await tenantQuery(slug,
      `SELECT ge.event_date, ge.topic, g.name AS group_name
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       WHERE ge.id = $1`, [eventId]);
    if (!ev) throw AppError('Event not found.', 404);

    const rows = await tenantQuery(
      slug,
      `SELECT m.membership_number, m.forenames, m.surname, m.email,
              em.is_organiser, em.notes
       FROM event_members em
       JOIN members m ON m.id = em.member_id
       WHERE em.event_id = $1
       ORDER BY em.is_organiser DESC, m.surname, m.forenames`,
      [eventId],
    );

    const title = ev.topic || ev.group_name || 'Event';
    const dateStr = fmtDateUK(ev.event_date);

    // Build PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    doc.font('Helvetica-Bold').fontSize(14)
      .text(`${title} — ${dateStr}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10)
      .text(`${rows.length} member(s)`, { align: 'center' });
    doc.moveDown(0.5);

    const cols = [
      { label: 'No',       x: 40,  w: 50 },
      { label: 'Name',     x: 90,  w: 160 },
      { label: 'Email',    x: 250, w: 180 },
      { label: 'Role',     x: 430, w: 70 },
      { label: 'Notes',    x: 500, w: 60 },
    ];

    function drawHeader(y) {
      doc.font('Helvetica-Bold').fontSize(8);
      for (const col of cols) {
        doc.text(col.label, col.x, y, { width: col.w, ellipsis: true });
      }
      doc.moveTo(40, y + 12).lineTo(560, y + 12).lineWidth(0.5).stroke();
      return y + 16;
    }

    let y = drawHeader(doc.y);
    doc.font('Helvetica').fontSize(8);

    for (const r of rows) {
      if (y > 780) {
        doc.addPage();
        y = drawHeader(40);
        doc.font('Helvetica').fontSize(8);
      }
      doc.text(r.membership_number || '', cols[0].x, y, { width: cols[0].w, ellipsis: true });
      doc.text(`${r.surname}, ${r.forenames}`, cols[1].x, y, { width: cols[1].w, ellipsis: true });
      doc.text(r.email || '', cols[2].x, y, { width: cols[2].w, ellipsis: true });
      doc.text(r.is_organiser ? 'Organiser' : 'Member', cols[3].x, y, { width: cols[3].w, ellipsis: true });
      doc.text(r.notes || '', cols[4].x, y, { width: cols[4].w, ellipsis: true });
      y += 14;
    }

    doc.end();
    await new Promise((resolve) => doc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="event_members_${stamp}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENT FINANCIALS  (summary of transactions linked to an event)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/events/:eventId/financials', requirePrivilege('event_finance', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { eventId } = req.params;

    const transactions = await tenantQuery(
      slug,
      `SELECT t.id, t.transaction_number, t.date, t.type, t.from_to, t.amount,
              t.payment_method, t.detail, t.remarks,
              a.name AS account_name
       FROM transactions t
       JOIN finance_accounts a ON a.id = t.account_id
       WHERE t.event_id = $1
       ORDER BY t.date, t.transaction_number`,
      [eventId],
    );

    const income = transactions.filter(t => t.type === 'in');
    const costs  = transactions.filter(t => t.type === 'out');
    const totalIncome = income.reduce((s, t) => s + parseFloat(t.amount), 0);
    const totalCosts  = costs.reduce((s, t) => s + parseFloat(t.amount), 0);

    const [countRow] = await tenantQuery(slug,
      `SELECT COUNT(*)::int AS count FROM event_members WHERE event_id = $1`, [eventId]);

    res.json({
      income,
      costs,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalCosts:  Math.round(totalCosts * 100) / 100,
      netBalance:  Math.round((totalIncome - totalCosts) * 100) / 100,
      attendeeCount: countRow?.count || 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
