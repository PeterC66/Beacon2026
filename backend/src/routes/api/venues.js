// beacon2026/backend/src/routes/api/venues.js
// GET /api/v1/:slug/venues  and  /venues/:id — where groups meet.
//
// Gated on the tenant's `venue` public toggle: a u3a that has chosen not to
// show venues on its public groups page does not expose them here either,
// and the whole collection 404s.
//
// Only `name` and `postcode` are exposed — the same two fields the public
// groups page renders. Address lines are deliberately not included; the
// postcode is enough to link to a map, which is the actual use case.

import { Router } from 'express';
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

/** Venues are only public at all if the u3a publishes venues on its groups page. */
async function venuesArePublic(req, res) {
  if (!(await requireFeatures(req, res, ['groups', 'venues']))) return false;
  const vis = await visibility(req);
  if (!visible(vis.group, 'venue')) {
    apiFail(res, 404, 'not_found', 'Not found.');
    return false;
  }
  return true;
}

router.get('/:slug/venues', async (req, res, next) => {
  try {
    if (!(await venuesArePublic(req, res))) return;
    const { limit, offset } = pagination(req.query);

    const [[count], rows] = await Promise.all([
      tenantQuery(req.tenantSlug, `SELECT COUNT(*)::int AS total FROM venues`),
      tenantQuery(
        req.tenantSlug,
        `SELECT id, name, postcode FROM venues ORDER BY name LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
    ]);

    return sendCollection(
      res,
      rows.map((v) => ({ id: v.id, name: v.name, postcode: v.postcode || null })),
      { total: count?.total ?? 0, limit, offset },
    );
  } catch (err) {
    next(err);
  }
});

router.get('/:slug/venues/:id', async (req, res, next) => {
  try {
    if (!(await venuesArePublic(req, res))) return;

    const [row] = await tenantQuery(
      req.tenantSlug,
      `SELECT id, name, postcode FROM venues WHERE id = $1`,
      [req.params.id],
    );
    if (!row) return apiFail(res, 404, 'not_found', 'Not found.');

    return sendOne(res, { id: row.id, name: row.name, postcode: row.postcode || null });
  } catch (err) {
    next(err);
  }
});

export default router;
