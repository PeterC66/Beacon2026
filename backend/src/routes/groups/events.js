// beacon2026/backend/src/routes/groups/events.js
// Group events (schedule) sub-resource: /groups/:id/events. Guarded by the
// `group_records_all` privilege.

import { Router } from 'express';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { eventSchema, updateEventSchema, bulkDeleteIdsSchema } from '../../schemas/common.js';

const router = Router();

// ─── GET /groups/:id/events ───────────────────────────────────────────────

router.get('/:id/events', requirePrivilege('group_records_all', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [group] = await tenantQuery(
      slug,
      `SELECT id FROM groups WHERE id = $1 AND type = 'group'`,
      [req.params.id],
    );
    if (!group) throw AppError('Group not found.', 404);

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, 'group'::text AS group_type,
              ge.venue_id, v.name AS venue_name,
              ge.topic, ge.contact, ge.details, ge.is_private,
              ge.created_at, ge.updated_at
       FROM group_events ge
       LEFT JOIN venues v ON v.id = ge.venue_id
       WHERE ge.group_id = $1
       ORDER BY ge.event_date, ge.start_time`,
      [req.params.id],
    );
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// ─── POST /groups/:id/events ──────────────────────────────────────────────
// Create one or more events (recurring support via repeat count)

router.post(
  '/:id/events',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const [group] = await tenantQuery(
        slug,
        `SELECT id FROM groups WHERE id = $1 AND type = 'group'`,
        [req.params.id],
      );
      if (!group) throw AppError('Group not found.', 404);

      const data = eventSchema.parse(req.body);

      // Build list of dates
      const dates = [data.eventDate];
      if (data.repeatEvery && data.repeatUnit && data.repeatUntil) {
        let current = new Date(data.eventDate);
        const until = new Date(data.repeatUntil);
        let safety = 0;
        while (safety++ < 500) {
          // Advance by repeatEvery units
          if (data.repeatUnit === 'days') {
            current = new Date(current.getTime() + data.repeatEvery * 86400000);
          } else if (data.repeatUnit === 'weeks') {
            current = new Date(current.getTime() + data.repeatEvery * 7 * 86400000);
          } else {
            // months
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
         VALUES ($1,$2::date,$3::time,$4::time,$5,$6,$7,$8,$9)
         RETURNING *`,
          [
            req.params.id,
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
  },
);

// ─── PATCH /groups/:id/events/:eventId ────────────────────────────────────

// [jsKey, col, cast?]
const EVENT_FIELDS = [
  ['eventDate', 'event_date', '::date'],
  ['startTime', 'start_time', '::time'],
  ['endTime', 'end_time', '::time'],
  ['venueId', 'venue_id'],
  ['topic', 'topic'],
  ['contact', 'contact'],
  ['details', 'details'],
  ['isPrivate', 'is_private'],
];

router.patch(
  '/:id/events/:eventId',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const data = updateEventSchema.parse(req.body);

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
      values.push(req.params.eventId, req.params.id);

      const [ev] = await tenantQuery(
        slug,
        `UPDATE group_events SET ${setClauses.join(', ')}
       WHERE id = $${i} AND group_id = $${i + 1}
       RETURNING *`,
        values,
      );
      if (!ev) throw AppError('Event not found.', 404);
      res.json(ev);
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /groups/:id/events ─────────────────────────────────────────────
// Body: { ids: ['...', '...'] }

router.delete(
  '/:id/events',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { ids } = bulkDeleteIdsSchema.parse(req.body);

      const placeholders = ids.map((_, idx) => `$${idx + 2}`).join(', ');
      const result = await tenantQuery(
        slug,
        `DELETE FROM group_events WHERE group_id = $1 AND id IN (${placeholders}) RETURNING id`,
        [req.params.id, ...ids],
      );
      res.json({ deleted: result.length });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
