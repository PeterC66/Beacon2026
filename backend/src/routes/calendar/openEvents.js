// beacon2/backend/src/routes/calendar/openEvents.js
// Non-group events (open meetings) — events with group_id = NULL, filtered by
// event type. Guarded by the `meetings` privilege resource.

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

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
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  venueId: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
  isPrivate: z.boolean().default(false),
  eventTypeId: z.string().nullable().optional(),
  repeatEvery: z.number().int().positive().nullable().optional(),
  repeatUnit: z.enum(['days', 'weeks', 'months']).optional(),
  repeatUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
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
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  venueId: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
  eventTypeId: z.string().nullable().optional(),
});

const EVENT_FIELDS = [
  ['eventDate', 'event_date', '::date'],
  ['startTime', 'start_time', '::time'],
  ['endTime', 'end_time', '::time'],
  ['venueId', 'venue_id'],
  ['topic', 'topic'],
  ['contact', 'contact'],
  ['details', 'details'],
  ['isPrivate', 'is_private'],
  ['eventTypeId', 'event_type_id'],
];

router.patch(
  '/open-events/:eventId',
  requirePrivilege('meetings', 'change'),
  async (req, res, next) => {
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
  },
);

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
