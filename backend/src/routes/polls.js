// beacon2/backend/src/routes/polls.js
// Poll set-up and poll-member management — doc 8.8

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);
router.use(requireFeature('polls'));

// ─── GET /polls ───────────────────────────────────────────────────────────
// Returns all polls with member count.

router.get('/', requirePrivilege('poll_set_up', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT p.id, p.name, p.description, p.member_can_set,
              COUNT(pm.member_id)::int AS member_count
       FROM polls p
       LEFT JOIN poll_members pm ON pm.poll_id = p.id
       GROUP BY p.id
       ORDER BY p.name`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── POST /polls ──────────────────────────────────────────────────────────

const pollSchema = z.object({
  name:          z.string().min(1).max(100),
  description:   z.string().max(500).default(''),
  memberCanSet:  z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.memberCanSet && !data.description.trim()) {
    ctx.addIssue({ code: 'custom', path: ['description'], message: 'Description is required when members can set this poll.' });
  }
});

router.post('/', requirePrivilege('poll_set_up', 'create'), async (req, res, next) => {
  try {
    const data = pollSchema.parse(req.body);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO polls (name, description, member_can_set)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, member_can_set, 0 AS member_count`,
      [data.name, data.description, data.memberCanSet],
    );
    logAudit(req.user.tenantSlug, { userId: req.user.userId, userName: req.user.name, action: 'create', entityType: 'poll', entityId: row.id, entityName: row.name });
    res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') return next(AppError('A poll with that name already exists.', 409));
    next(err);
  }
});

// ─── PATCH /polls/:id ─────────────────────────────────────────────────────

router.patch('/:id', requirePrivilege('poll_set_up', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id FROM polls WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Poll not found.', 404);

    const data = pollSchema.parse(req.body);
    const [row] = await tenantQuery(
      slug,
      `UPDATE polls SET name = $1, description = $2, member_can_set = $3, updated_at = now()
       WHERE id = $4
       RETURNING id, name, description, member_can_set`,
      [data.name, data.description, data.memberCanSet, req.params.id],
    );
    logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'update', entityType: 'poll', entityId: row.id, entityName: row.name });
    res.json(row);
  } catch (err) {
    if (err.code === '23505') return next(AppError('A poll with that name already exists.', 409));
    next(err);
  }
});

// ─── DELETE /polls/:id ────────────────────────────────────────────────────

router.delete('/:id', requirePrivilege('poll_set_up', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id, name FROM polls WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Poll not found.', 404);
    await tenantQuery(slug, `DELETE FROM polls WHERE id = $1`, [req.params.id]);
    logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'delete', entityType: 'poll', entityId: existing.id, entityName: existing.name });
    res.json({ message: 'Poll deleted.' });
  } catch (err) { next(err); }
});

// ─── POST /polls/:id/clear ────────────────────────────────────────────────
// Remove all members from a poll.

router.post('/:id/clear', requirePrivilege('poll_set_up', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id, name FROM polls WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Poll not found.', 404);
    await tenantQuery(slug, `DELETE FROM poll_members WHERE poll_id = $1`, [req.params.id]);
    logAudit(slug, { userId: req.user.userId, userName: req.user.name, action: 'clear', entityType: 'poll', entityId: existing.id, entityName: existing.name });
    res.json({ message: 'All assignments cleared.' });
  } catch (err) { next(err); }
});

// ─── POST /polls/:id/members ──────────────────────────────────────────────
// Add one or more members to a poll (bulk "Add to poll" from member list).

const addMembersSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1),
});

router.post('/:id/members', requirePrivilege('poll_set_up', 'change'), async (req, res, next) => {
  try {
    const { memberIds } = addMembersSchema.parse(req.body);

    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id FROM polls WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Poll not found.', 404);

    for (const memberId of memberIds) {
      await tenantQuery(
        slug,
        `INSERT INTO poll_members (poll_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, memberId],
      );
    }
    res.json({ added: memberIds.length });
  } catch (err) { next(err); }
});

// ─── PUT /members/:memberId/polls (mounted as /polls/by-member/:memberId) ─
// Set exact poll membership for one member (from member record tick boxes).

router.put('/by-member/:memberId', requirePrivilege('poll_set_up', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { memberId } = req.params;
    const { pollIds } = z.object({ pollIds: z.array(z.string()) }).parse(req.body);

    await tenantQuery(slug, `DELETE FROM poll_members WHERE member_id = $1`, [memberId]);
    for (const pollId of pollIds) {
      await tenantQuery(
        slug,
        `INSERT INTO poll_members (poll_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [pollId, memberId],
      );
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
