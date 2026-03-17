// beacon2/backend/src/routes/audit.js
// Audit log viewer — doc 9.2(a)

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// ─── GET /audit ───────────────────────────────────────────────────────────
// Query params:
//   from  – ISO date string (default: 3 months ago)
//   to    – ISO date string (default: today)
// Returns entries sorted newest first, capped at 500 rows.

router.get('/', requirePrivilege('audit_trail', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;

    // Default window: 3 months ago → today
    const now   = new Date();
    const dfrom = new Date(now);
    dfrom.setMonth(dfrom.getMonth() - 3);

    const fromStr = req.query.from || dfrom.toISOString().slice(0, 10);
    const toStr   = req.query.to   || now.toISOString().slice(0, 10);

    // Validate date strings
    const fromDate = new Date(fromStr);
    const toDate   = new Date(toStr);
    if (isNaN(fromDate) || isNaN(toDate)) throw AppError('Invalid date range.', 400);

    // Cap to 3-month window
    const diffMs   = toDate - fromDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 93) throw AppError('Date range cannot exceed 3 months.', 400);

    const rows = await tenantQuery(
      slug,
      `SELECT id, user_id, user_name, action, entity_type, entity_id, entity_name, detail, created_at
       FROM audit_log
       WHERE created_at >= $1::date
         AND created_at <  $2::date + INTERVAL '1 day'
       ORDER BY created_at DESC
       LIMIT 500`,
      [fromStr, toStr],
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── DELETE /audit ────────────────────────────────────────────────────────
// Body: { before: 'YYYY-MM-DD' }
// Deletes all entries strictly before the given date.

router.delete('/', requirePrivilege('audit_trail', 'delete'), async (req, res, next) => {
  try {
    const { before } = z.object({ before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body);
    const slug = req.user.tenantSlug;
    const result = await tenantQuery(
      slug,
      `WITH deleted AS (DELETE FROM audit_log WHERE created_at < $1::date RETURNING id)
       SELECT COUNT(*) AS count FROM deleted`,
      [before],
    );
    const count = parseInt(result[0]?.count ?? 0, 10);
    res.json({ deleted: count });
  } catch (err) { next(err); }
});

export default router;
