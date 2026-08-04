// beacon2026/backend/src/routes/groupStdMessages.js
// Std Emails / Std Letters tabs on a group or team record: /groups/:id/std-messages
// and /groups/:id/std-letters (mounted identically under /teams — a team is just
// a groups row with type='team', so one router serves both).
//
// Access: ${resource}_all:* (any group/team) OR ${resource}_as_leader:* scoped
// to groups/teams this specific user leads — see hasTemplateManageAccess().
// Unlike the tenant-wide Standard Messages/Letters screens, ownership here is
// always the group/team in the URL — there is no owner picker; a leader
// cannot reassign a template to a different group.

import { Router } from 'express';
import { z } from 'zod';
import { tenantQuery } from '../utils/db.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { hasTemplateManageAccess } from '../utils/templateOwnership.js';

const router = Router();

const messageSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().max(500).default(''),
  body: z.string().default(''),
});

const letterSchema = z.object({
  name: z.string().min(1).max(200),
  body: z.string().default(''),
});

// ─── Std Emails ────────────────────────────────────────────────────────────

// GET /groups/:id/std-messages
router.get('/:id/std-messages', requireFeature('email'), async (req, res, next) => {
  try {
    const groupId = req.params.id;
    if (!(await hasTemplateManageAccess(req, 'email_standard_messages', 'view', groupId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, subject, body FROM standard_messages
       WHERE owner_group_id = $1 ORDER BY name`,
      [groupId],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /groups/:id/std-messages — create, or update-by-name if a template
// with that name already exists AND is already owned by this same group.
router.post('/:id/std-messages', requireFeature('email'), async (req, res, next) => {
  try {
    const groupId = req.params.id;
    if (!(await hasTemplateManageAccess(req, 'email_standard_messages', 'create', groupId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error: 'Validation error',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const { name, subject, body } = parsed.data;
    const slug = req.user.tenantSlug;

    const [existing] = await tenantQuery(
      slug,
      `SELECT id, owner_group_id FROM standard_messages WHERE name = $1`,
      [name],
    );
    if (existing && existing.owner_group_id !== groupId) {
      return res.status(409).json({
        error: 'A template with this name already exists and belongs to a different group/team.',
      });
    }

    const rows = await tenantQuery(
      slug,
      `INSERT INTO standard_messages (name, subject, body, owner_group_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET subject = $2, body = $3, updated_at = NOW()
       RETURNING id, name, subject, body, owner_group_id`,
      [name, subject, body, groupId],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /groups/:id/std-messages/:msgId
router.delete('/:id/std-messages/:msgId', requireFeature('email'), async (req, res, next) => {
  try {
    const groupId = req.params.id;
    if (!(await hasTemplateManageAccess(req, 'email_standard_messages', 'delete', groupId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await tenantQuery(
      req.user.tenantSlug,
      `DELETE FROM standard_messages WHERE id = $1 AND owner_group_id = $2`,
      [req.params.msgId, groupId],
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── Std Letters ───────────────────────────────────────────────────────────

// GET /groups/:id/std-letters
router.get('/:id/std-letters', requireFeature('letters'), async (req, res, next) => {
  try {
    const groupId = req.params.id;
    if (!(await hasTemplateManageAccess(req, 'letters_standard_messages', 'view', groupId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, body FROM standard_letters
       WHERE owner_group_id = $1 ORDER BY name`,
      [groupId],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /groups/:id/std-letters
router.post('/:id/std-letters', requireFeature('letters'), async (req, res, next) => {
  try {
    const groupId = req.params.id;
    if (!(await hasTemplateManageAccess(req, 'letters_standard_messages', 'create', groupId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const parsed = letterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error: 'Validation error',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const { name, body } = parsed.data;
    const slug = req.user.tenantSlug;

    const [existing] = await tenantQuery(
      slug,
      `SELECT id, owner_group_id FROM standard_letters WHERE name = $1`,
      [name],
    );
    if (existing && existing.owner_group_id !== groupId) {
      return res.status(409).json({
        error: 'A template with this name already exists and belongs to a different group/team.',
      });
    }

    const rows = await tenantQuery(
      slug,
      `INSERT INTO standard_letters (name, body, owner_group_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET body = $2, updated_at = NOW()
       RETURNING id, name, body, owner_group_id`,
      [name, body, groupId],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /groups/:id/std-letters/:letterId
router.delete('/:id/std-letters/:letterId', requireFeature('letters'), async (req, res, next) => {
  try {
    const groupId = req.params.id;
    if (!(await hasTemplateManageAccess(req, 'letters_standard_messages', 'delete', groupId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await tenantQuery(
      req.user.tenantSlug,
      `DELETE FROM standard_letters WHERE id = $1 AND owner_group_id = $2`,
      [req.params.letterId, groupId],
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
