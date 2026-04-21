// beacon2/backend/src/routes/eventTypes.js
// Event types CRUD — manage event categories for non-group events.

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { tenantQuery } from '../utils/db.js';
import { logAudit } from '../utils/audit.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);
router.use(requireFeature('eventTypes'));

// ─── GET /event-types ────────────────────────────────────────────────────────

router.get('/', requirePrivilege('event_types', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, description, is_default, created_at, updated_at
       FROM event_types ORDER BY is_default DESC, name`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── POST /event-types ───────────────────────────────────────────────────────

const createSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

router.post('/', requirePrivilege('event_types', 'create'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = createSchema.parse(req.body);

    const [et] = await tenantQuery(slug,
      `INSERT INTO event_types (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, is_default, created_at, updated_at`,
      [data.name, data.description ?? null],
    );
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'create', entityType: 'event_type', entityId: et.id, entityName: et.name,
    });
    res.status(201).json(et);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /event-types/:id ──────────────────────────────────────────────────

const updateSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

router.patch('/:id', requirePrivilege('event_types', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = updateSchema.parse(req.body);

    // Check if it's the default type — block rename
    const [existing] = await tenantQuery(slug,
      `SELECT id, name, is_default FROM event_types WHERE id = $1`,
      [req.params.id],
    );
    if (!existing) throw AppError('Event type not found.', 404);
    if (existing.is_default && data.name && data.name !== existing.name) {
      throw AppError('The default event type cannot be renamed.', 400);
    }

    const setClauses = [];
    const values = [];
    let i = 1;
    if (data.name !== undefined) {
      setClauses.push(`name = $${i++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${i++}`);
      values.push(data.description);
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }
    setClauses.push('updated_at = now()');
    values.push(req.params.id);

    const [updated] = await tenantQuery(slug,
      `UPDATE event_types SET ${setClauses.join(', ')}
       WHERE id = $${i}
       RETURNING id, name, description, is_default, created_at, updated_at`,
      values,
    );
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'update', entityType: 'event_type', entityId: updated.id, entityName: updated.name,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /event-types/:id ─────────────────────────────────────────────────

router.delete('/:id', requirePrivilege('event_types', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;

    const [existing] = await tenantQuery(slug,
      `SELECT id, name, is_default FROM event_types WHERE id = $1`,
      [req.params.id],
    );
    if (!existing) throw AppError('Event type not found.', 404);
    if (existing.is_default) {
      throw AppError('The default event type cannot be deleted.', 400);
    }

    // Check for events using this type
    const [count] = await tenantQuery(slug,
      `SELECT COUNT(*)::int AS cnt FROM group_events WHERE event_type_id = $1`,
      [req.params.id],
    );
    if (count.cnt > 0) {
      throw AppError(`Cannot delete: ${count.cnt} event(s) are using this type.`, 400);
    }

    await tenantQuery(slug,
      `DELETE FROM event_types WHERE id = $1`,
      [req.params.id],
    );
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'delete', entityType: 'event_type', entityId: existing.id, entityName: existing.name,
    });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
