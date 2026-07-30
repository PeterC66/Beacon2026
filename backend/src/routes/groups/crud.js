// beacon2026/backend/src/routes/groups/crud.js
// Group record CRUD (single group view, create, update, delete). Guarded by the
// `group_records_all` privilege resource.

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../utils/audit.js';

const router = Router();

// ─── GET /groups/:id ──────────────────────────────────────────────────────

router.get('/:id', requirePrivilege('group_records_all', 'view'), async (req, res, next) => {
  try {
    const [group] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT g.*, f.name AS faculty_name, v.name AS venue_name
       FROM groups g
       LEFT JOIN faculties f ON f.id = g.faculty_id
       LEFT JOIN venues v ON v.id = g.venue_id
       WHERE g.id = $1 AND g.type = 'group'`,
      [req.params.id],
    );
    if (!group) throw AppError('Group not found.', 404);
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// ─── POST /groups ─────────────────────────────────────────────────────────

const groupSchema = z.object({
  name: z.string().min(1).max(200),
  shortName: z.string().max(10).nullable().optional(),
  facultyId: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  whenText: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(), // "HH:MM"
  endTime: z.string().nullable().optional(),
  venueId: z.string().nullable().optional(),
  enquiries: z.string().nullable().optional(),
  maxMembers: z.number().int().positive().nullable().optional(),
  allowOnlineJoin: z.boolean().default(false),
  enableWaitingList: z.boolean().default(false),
  notifyLeader: z.boolean().default(false),
  displayWaitingList: z.boolean().default(false),
  information: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  showAddresses: z.boolean().default(false),
});

router.post('/', requirePrivilege('group_records_all', 'create'), async (req, res, next) => {
  try {
    const data = groupSchema.parse(req.body);
    const slug = req.user.tenantSlug;

    const [group] = await tenantQuery(
      slug,
      `INSERT INTO groups
         (name, short_name, faculty_id, status, when_text, start_time, end_time, venue_id, enquiries,
          max_members, allow_online_join, enable_waiting_list, notify_leader,
          display_waiting_list, information, notes, show_addresses, type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'group')
       RETURNING *`,
      [
        data.name,
        data.shortName ?? null,
        data.facultyId ?? null,
        data.status,
        data.whenText ?? null,
        data.startTime ?? null,
        data.endTime ?? null,
        data.venueId ?? null,
        data.enquiries ?? null,
        data.maxMembers ?? null,
        data.allowOnlineJoin,
        data.enableWaitingList,
        data.notifyLeader,
        data.displayWaitingList,
        data.information ?? null,
        data.notes ?? null,
        data.showAddresses,
      ],
    );
    logAudit(slug, {
      userId: req.user.userId,
      userName: req.user.name,
      action: 'create',
      entityType: 'group',
      entityId: group.id,
      entityName: group.name,
    });
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /groups/:id ────────────────────────────────────────────────────

const updateGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  shortName: z.string().max(10).nullable().optional(),
  facultyId: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  whenText: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  venueId: z.string().nullable().optional(),
  enquiries: z.string().nullable().optional(),
  maxMembers: z.number().int().positive().nullable().optional(),
  allowOnlineJoin: z.boolean().optional(),
  enableWaitingList: z.boolean().optional(),
  notifyLeader: z.boolean().optional(),
  displayWaitingList: z.boolean().optional(),
  information: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  showAddresses: z.boolean().optional(),
});

const GROUP_FIELDS = [
  ['name', 'name'],
  ['shortName', 'short_name'],
  ['facultyId', 'faculty_id'],
  ['status', 'status'],
  ['whenText', 'when_text'],
  ['startTime', 'start_time'],
  ['endTime', 'end_time'],
  ['venueId', 'venue_id'],
  ['enquiries', 'enquiries'],
  ['maxMembers', 'max_members'],
  ['allowOnlineJoin', 'allow_online_join'],
  ['enableWaitingList', 'enable_waiting_list'],
  ['notifyLeader', 'notify_leader'],
  ['displayWaitingList', 'display_waiting_list'],
  ['information', 'information'],
  ['notes', 'notes'],
  ['showAddresses', 'show_addresses'],
];

router.patch('/:id', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = updateGroupSchema.parse(req.body);

    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [jsKey, col] of GROUP_FIELDS) {
      if (data[jsKey] !== undefined) {
        setClauses.push(`${col} = $${i++}`);
        values.push(data[jsKey]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    setClauses.push(`updated_at = now()`);
    values.push(req.params.id);

    const [group] = await tenantQuery(
      slug,
      `UPDATE groups SET ${setClauses.join(', ')} WHERE id = $${i} AND type = 'group' RETURNING *`,
      values,
    );
    if (!group) throw AppError('Group not found.', 404);
    logAudit(slug, {
      userId: req.user.userId,
      userName: req.user.name,
      action: 'update',
      entityType: 'group',
      entityId: group.id,
      entityName: group.name,
    });
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /groups/:id ───────────────────────────────────────────────────

router.delete('/:id', requirePrivilege('group_records_all', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(
      slug,
      `SELECT id, name FROM groups WHERE id = $1 AND type = 'group'`,
      [req.params.id],
    );
    if (!existing) throw AppError('Group not found.', 404);

    await tenantQuery(slug, `DELETE FROM groups WHERE id = $1 AND type = 'group'`, [req.params.id]);
    logAudit(slug, {
      userId: req.user.userId,
      userName: req.user.name,
      action: 'delete',
      entityType: 'group',
      entityId: existing.id,
      entityName: existing.name,
    });
    res.json({ message: 'Group deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
