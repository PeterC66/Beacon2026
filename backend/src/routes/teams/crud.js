// beacon2026/backend/src/routes/teams/crud.js
// Team record CRUD (single team view, create, update, delete). Guarded by the
// `group_records_all` privilege resource (teams share group privileges).

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../utils/audit.js';

const router = Router();

// ─── GET /teams/:id ──────────────────────────────────────────────────────
router.get('/:id', requirePrivilege('group_records_all', 'view'), async (req, res, next) => {
  try {
    const [team] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT * FROM groups WHERE id = $1 AND type = 'team'`,
      [req.params.id],
    );
    if (!team) throw AppError('Team not found.', 404);
    res.json(team);
  } catch (err) {
    next(err);
  }
});

// ─── POST /teams ─────────────────────────────────────────────────────────
const teamSchema = z.object({
  name: z.string().min(1).max(200),
  shortName: z.string().max(10).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  information: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  showAddresses: z.boolean().default(false),
});

router.post('/', requirePrivilege('group_records_all', 'create'), async (req, res, next) => {
  try {
    const data = teamSchema.parse(req.body);
    const slug = req.user.tenantSlug;

    const [team] = await tenantQuery(
      slug,
      `INSERT INTO groups (name, short_name, status, information, notes, show_addresses, type)
       VALUES ($1,$2,$3,$4,$5,$6,'team')
       RETURNING *`,
      [
        data.name,
        data.shortName ?? null,
        data.status,
        data.information ?? null,
        data.notes ?? null,
        data.showAddresses,
      ],
    );
    logAudit(slug, {
      userId: req.user.userId,
      userName: req.user.name,
      action: 'create',
      entityType: 'team',
      entityId: team.id,
      entityName: team.name,
    });
    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /teams/:id ────────────────────────────────────────────────────
const updateTeamSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  shortName: z.string().max(10).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  information: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  showAddresses: z.boolean().optional(),
});

const TEAM_FIELDS = [
  ['name', 'name'],
  ['shortName', 'short_name'],
  ['status', 'status'],
  ['information', 'information'],
  ['notes', 'notes'],
  ['showAddresses', 'show_addresses'],
];

router.patch('/:id', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = updateTeamSchema.parse(req.body);

    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [jsKey, col] of TEAM_FIELDS) {
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

    const [team] = await tenantQuery(
      slug,
      `UPDATE groups SET ${setClauses.join(', ')} WHERE id = $${i} AND type = 'team' RETURNING *`,
      values,
    );
    if (!team) throw AppError('Team not found.', 404);
    logAudit(slug, {
      userId: req.user.userId,
      userName: req.user.name,
      action: 'update',
      entityType: 'team',
      entityId: team.id,
      entityName: team.name,
    });
    res.json(team);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /teams/:id ───────────────────────────────────────────────────
router.delete('/:id', requirePrivilege('group_records_all', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(
      slug,
      `SELECT id, name FROM groups WHERE id = $1 AND type = 'team'`,
      [req.params.id],
    );
    if (!existing) throw AppError('Team not found.', 404);

    await tenantQuery(slug, `DELETE FROM groups WHERE id = $1 AND type = 'team'`, [req.params.id]);
    logAudit(slug, {
      userId: req.user.userId,
      userName: req.user.name,
      action: 'delete',
      entityType: 'team',
      entityId: existing.id,
      entityName: existing.name,
    });
    res.json({ message: 'Team deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
