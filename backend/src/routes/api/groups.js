// beacon2026/backend/src/routes/api/groups.js
// GET /api/v1/:slug/groups  and  /groups/:id — the primary use case.
//
// Field parity with the public groups page (routes/public/read.js): the
// always-visible fields are the group's identity and when it meets; every
// other field is gated on the matching `group_info_config` public toggle,
// all of which default to false.
//
// Only active interest groups are returned. Teams (type = 'team') are
// internal committee structures and are never public.

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

const filterSchema = z.object({
  faculty: z.string().max(64).optional(),
});

/**
 * Project one group row for the anonymous tier.
 *
 * All group field-visibility lives here. A new column added to the queries
 * below does not appear in a response unless it is added here too, which is
 * the point — the apiV1 tests assert the exact key set, so a field added
 * carelessly fails the build rather than shipping quietly.
 */
function projectGroup(g, cfg, leaders) {
  return {
    id: g.id,
    name: g.name,
    facultyId: g.faculty_id || null,
    faculty: g.faculty_name || null,
    when: g.when_text || null,
    startTime: g.start_time || null,
    endTime: g.end_time || null,
    ...(visible(cfg, 'status') && { status: g.status }),
    ...(visible(cfg, 'venue') && {
      venue: g.venue_name || null,
      venuePostcode: g.venue_postcode || null,
    }),
    ...(visible(cfg, 'contact') && {
      contact: (leaders?.get(g.id) || []).join(', ') || g.enquiries || null,
    }),
    ...(visible(cfg, 'enquiries') && { enquiries: g.enquiries || null }),
    ...(visible(cfg, 'detail') && { information: g.information || null }),
  };
}

const SELECT_GROUP = `
  SELECT g.id, g.name, g.status, g.when_text, g.start_time, g.end_time,
         g.enquiries, g.information, g.faculty_id,
         f.name AS faculty_name,
         v.name AS venue_name, v.postcode AS venue_postcode
  FROM groups g
  LEFT JOIN venues v    ON v.id = g.venue_id
  LEFT JOIN faculties f ON f.id = g.faculty_id`;

/** Leader display names, loaded only when the u3a publishes contacts. */
async function loadLeaders(slug, groupIds) {
  if (groupIds.length === 0) return new Map();
  const rows = await tenantQuery(
    slug,
    `SELECT gm.group_id, m.forenames, m.surname, m.known_as
     FROM group_members gm
     JOIN members m ON m.id = gm.member_id
     WHERE gm.is_leader = true AND gm.group_id = ANY($1)`,
    [groupIds],
  );
  const map = new Map();
  for (const row of rows) {
    const first = row.known_as || row.forenames?.split(' ')[0] || row.forenames;
    const display = `${first ?? ''} ${row.surname ?? ''}`.trim();
    if (!map.has(row.group_id)) map.set(row.group_id, []);
    map.get(row.group_id).push(display);
  }
  return map;
}

// ─── GET /:slug/groups ────────────────────────────────────────────────────

router.get('/:slug/groups', async (req, res, next) => {
  try {
    if (!(await requireFeatures(req, res, ['groups']))) return;
    const { limit, offset } = pagination(req.query);
    const { faculty } = filterSchema.parse(req.query);
    const cfg = (await visibility(req)).group;

    const where = [`g.status = 'active'`, `g.type = 'group'`];
    const params = [];
    if (faculty) {
      params.push(faculty);
      where.push(`g.faculty_id = $${params.length}`);
    }
    const whereSQL = `WHERE ${where.join(' AND ')}`;

    const [[count], rows] = await Promise.all([
      tenantQuery(
        req.tenantSlug,
        `SELECT COUNT(*)::int AS total FROM groups g ${whereSQL}`,
        params,
      ),
      tenantQuery(
        req.tenantSlug,
        `${SELECT_GROUP} ${whereSQL} ORDER BY g.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    const leaders = visible(cfg, 'contact')
      ? await loadLeaders(
          req.tenantSlug,
          rows.map((g) => g.id),
        )
      : null;

    return sendCollection(
      res,
      rows.map((g) => projectGroup(g, cfg, leaders)),
      { total: count?.total ?? 0, limit, offset },
    );
  } catch (err) {
    next(err);
  }
});

// ─── GET /:slug/groups/:id ────────────────────────────────────────────────

router.get('/:slug/groups/:id', async (req, res, next) => {
  try {
    if (!(await requireFeatures(req, res, ['groups']))) return;
    const cfg = (await visibility(req)).group;

    const [row] = await tenantQuery(
      req.tenantSlug,
      `${SELECT_GROUP} WHERE g.id = $1 AND g.status = 'active' AND g.type = 'group'`,
      [req.params.id],
    );
    if (!row) return apiFail(res, 404, 'not_found', 'Not found.');

    const leaders = visible(cfg, 'contact') ? await loadLeaders(req.tenantSlug, [row.id]) : null;
    return sendOne(res, projectGroup(row, cfg, leaders));
  } catch (err) {
    next(err);
  }
});

export default router;
