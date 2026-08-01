// beacon2026/backend/src/routes/api/faculties.js
// GET /api/v1/:slug/faculties — interest areas.
//
// Visibility note. Faculties have no entry in group_info_config, so strictly
// they are not covered by the "never more than the public pages already
// show" rule. They are included here on the narrower ground that a faculty
// is pure taxonomy — a name a u3a invented to categorise its own groups,
// carrying no personal data of any kind — and that the organising axis for
// a website's groups page is precisely what makes that page useful.
//
// Only `id` and `name` are exposed. If that judgement is ever revisited,
// this endpoint and the `faculty` field on groups are the only two places
// to change.

import { Router } from 'express';
import { tenantQuery } from '../../utils/db.js';
import { sendCollection, pagination, requireFeatures } from './helpers.js';

const router = Router();

router.get('/:slug/faculties', async (req, res, next) => {
  try {
    if (!(await requireFeatures(req, res, ['groups', 'faculties']))) return;
    const { limit, offset } = pagination(req.query);

    const [[count], rows] = await Promise.all([
      tenantQuery(req.tenantSlug, `SELECT COUNT(*)::int AS total FROM faculties`),
      tenantQuery(
        req.tenantSlug,
        `SELECT id, name FROM faculties ORDER BY name LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
    ]);

    return sendCollection(
      res,
      rows.map((f) => ({ id: f.id, name: f.name })),
      { total: count?.total ?? 0, limit, offset },
    );
  } catch (err) {
    next(err);
  }
});

export default router;
