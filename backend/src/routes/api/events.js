// beacon2026/backend/src/routes/api/events.js
// GET /api/v1/:slug/events  and  /events/:id — the public calendar.
//
// Field parity with the public calendar page (routes/public/read.js).
// Private events are excluded outright; every optional field is gated on the
// matching `calendar_config` public toggle, all of which default to false.

import { Router } from 'express';
import { z } from 'zod';
import { tenantQuery } from '../../utils/db.js';
import {
  sendCollection,
  sendOne,
  pagination,
  requireFeatures,
  visibility,
  visible,
  apiFail,
} from './helpers.js';

const router = Router();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dates must be in YYYY-MM-DD format')
  .optional();

const filterSchema = z.object({
  from: isoDate,
  to: isoDate,
  group: z.string().max(64).optional(),
});

/** All event field-visibility lives here — see the note in groups.js. */
function projectEvent(ev, cfg) {
  return {
    id: ev.id,
    date: ev.event_date,
    startTime: ev.start_time || null,
    endTime: ev.end_time || null,
    groupId: ev.group_id || null,
    groupName: ev.group_name || ev.event_type_name || 'Open Meeting',
    ...(visible(cfg, 'venue') && {
      venue: ev.venue_name || null,
      venuePostcode: ev.venue_postcode || null,
    }),
    ...(visible(cfg, 'topic') && { topic: ev.topic || null }),
    ...(visible(cfg, 'enquiries') && { contact: ev.contact || null }),
    ...(visible(cfg, 'detail') && { details: ev.details || null }),
  };
}

const SELECT_EVENT = `
  SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
         ge.group_id, g.name AS group_name,
         et.name AS event_type_name,
         v.name AS venue_name, v.postcode AS venue_postcode,
         ge.topic, ge.contact, ge.details
  FROM group_events ge
  LEFT JOIN groups g       ON g.id  = ge.group_id
  LEFT JOIN venues v       ON v.id  = ge.venue_id
  LEFT JOIN event_types et ON et.id = ge.event_type_id`;

// ─── GET /:slug/events ────────────────────────────────────────────────────

router.get('/:slug/events', async (req, res, next) => {
  try {
    if (!(await requireFeatures(req, res, ['events']))) return;
    const { limit, offset } = pagination(req.query);
    const { from, to, group } = filterSchema.parse(req.query);
    const cfg = (await visibility(req)).calendar;

    const where = [`ge.is_private IS NOT TRUE`];
    const params = [];
    if (from) {
      params.push(from);
      where.push(`ge.event_date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      where.push(`ge.event_date <= $${params.length}::date`);
    }
    if (group) {
      params.push(group);
      where.push(`ge.group_id = $${params.length}`);
    }
    const whereSQL = `WHERE ${where.join(' AND ')}`;

    const [[count], rows] = await Promise.all([
      tenantQuery(
        req.tenantSlug,
        `SELECT COUNT(*)::int AS total FROM group_events ge ${whereSQL}`,
        params,
      ),
      tenantQuery(
        req.tenantSlug,
        `${SELECT_EVENT} ${whereSQL}
         ORDER BY ge.event_date, ge.start_time, g.name
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    return sendCollection(
      res,
      rows.map((ev) => projectEvent(ev, cfg)),
      { total: count?.total ?? 0, limit, offset },
    );
  } catch (err) {
    next(err);
  }
});

// ─── GET /:slug/events/:id ────────────────────────────────────────────────

router.get('/:slug/events/:id', async (req, res, next) => {
  try {
    if (!(await requireFeatures(req, res, ['events']))) return;
    const cfg = (await visibility(req)).calendar;

    const [row] = await tenantQuery(
      req.tenantSlug,
      `${SELECT_EVENT} WHERE ge.id = $1 AND ge.is_private IS NOT TRUE`,
      [req.params.id],
    );
    if (!row) return apiFail(res, 404, 'not_found', 'Not found.');

    return sendOne(res, projectEvent(row, cfg));
  } catch (err) {
    next(err);
  }
});

export default router;
