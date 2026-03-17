// beacon2/backend/src/routes/groups.js

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// ─── GET /groups ───────────────────────────────────────────────────────────
// Query params:
//   activeOnly – 'true' (default) | 'false'
//   facultyId  – filter by faculty
//   letter     – single letter to filter group name start

router.get('/', requirePrivilege('groups_list', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { activeOnly = 'true', facultyId, letter } = req.query;

    const conditions = [];
    const params = [];
    let i = 1;

    if (activeOnly !== 'false') {
      conditions.push(`g.status = 'active'`);
    }
    if (facultyId) {
      conditions.push(`g.faculty_id = $${i++}`);
      params.push(facultyId);
    }
    if (letter && /^[A-Z]$/i.test(letter)) {
      conditions.push(`upper(g.name) LIKE $${i++}`);
      params.push(letter.toUpperCase() + '%');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const groups = await tenantQuery(
      slug,
      `SELECT g.id, g.name, g.faculty_id, f.name AS faculty_name,
              g.status, g.when_text, g.max_members, g.show_addresses,
              (SELECT COUNT(*)::int FROM group_members gm
               WHERE gm.group_id = g.id AND gm.waiting_since IS NULL) AS member_count,
              (SELECT COALESCE(
                 json_agg(json_build_object(
                   'id',       m.id,
                   'forenames', m.forenames,
                   'surname',   m.surname
                 ) ORDER BY m.surname, m.forenames),
                 '[]'::json
               )
               FROM group_members gm
               JOIN members m ON m.id = gm.member_id
               WHERE gm.group_id = g.id AND gm.is_leader = true) AS leaders
       FROM groups g
       LEFT JOIN faculties f ON f.id = g.faculty_id
       ${where}
       ORDER BY g.name`,
      params,
    );

    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// ─── GET /groups/:id ──────────────────────────────────────────────────────

router.get('/:id', requirePrivilege('group_records_all', 'view'), async (req, res, next) => {
  try {
    const [group] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT g.*, f.name AS faculty_name, v.name AS venue_name
       FROM groups g
       LEFT JOIN faculties f ON f.id = g.faculty_id
       LEFT JOIN venues v ON v.id = g.venue_id
       WHERE g.id = $1`,
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
  name:                z.string().min(1).max(200),
  facultyId:           z.string().nullable().optional(),
  status:              z.enum(['active', 'inactive']).default('active'),
  whenText:            z.string().nullable().optional(),
  startTime:           z.string().nullable().optional(),  // "HH:MM"
  endTime:             z.string().nullable().optional(),
  venueId:             z.string().nullable().optional(),
  enquiries:           z.string().nullable().optional(),
  maxMembers:          z.number().int().positive().nullable().optional(),
  allowOnlineJoin:     z.boolean().default(false),
  enableWaitingList:   z.boolean().default(false),
  notifyLeader:        z.boolean().default(false),
  displayWaitingList:  z.boolean().default(false),
  information:         z.string().nullable().optional(),
  notes:               z.string().nullable().optional(),
  showAddresses:       z.boolean().default(false),
});

router.post('/', requirePrivilege('group_records_all', 'create'), async (req, res, next) => {
  try {
    const data = groupSchema.parse(req.body);
    const slug = req.user.tenantSlug;

    const [group] = await tenantQuery(
      slug,
      `INSERT INTO groups
         (name, faculty_id, status, when_text, start_time, end_time, venue_id, enquiries,
          max_members, allow_online_join, enable_waiting_list, notify_leader,
          display_waiting_list, information, notes, show_addresses)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        data.name,
        data.facultyId     ?? null,
        data.status,
        data.whenText      ?? null,
        data.startTime     ?? null,
        data.endTime       ?? null,
        data.venueId       ?? null,
        data.enquiries     ?? null,
        data.maxMembers    ?? null,
        data.allowOnlineJoin,
        data.enableWaitingList,
        data.notifyLeader,
        data.displayWaitingList,
        data.information   ?? null,
        data.notes         ?? null,
        data.showAddresses,
      ],
    );
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /groups/:id ────────────────────────────────────────────────────

const updateGroupSchema = z.object({
  name:                z.string().min(1).max(200).optional(),
  facultyId:           z.string().nullable().optional(),
  status:              z.enum(['active', 'inactive']).optional(),
  whenText:            z.string().nullable().optional(),
  startTime:           z.string().nullable().optional(),
  endTime:             z.string().nullable().optional(),
  venueId:             z.string().nullable().optional(),
  enquiries:           z.string().nullable().optional(),
  maxMembers:          z.number().int().positive().nullable().optional(),
  allowOnlineJoin:     z.boolean().optional(),
  enableWaitingList:   z.boolean().optional(),
  notifyLeader:        z.boolean().optional(),
  displayWaitingList:  z.boolean().optional(),
  information:         z.string().nullable().optional(),
  notes:               z.string().nullable().optional(),
  showAddresses:       z.boolean().optional(),
});

const GROUP_FIELDS = [
  ['name',               'name'],
  ['facultyId',          'faculty_id'],
  ['status',             'status'],
  ['whenText',           'when_text'],
  ['startTime',          'start_time'],
  ['endTime',            'end_time'],
  ['venueId',            'venue_id'],
  ['enquiries',          'enquiries'],
  ['maxMembers',         'max_members'],
  ['allowOnlineJoin',    'allow_online_join'],
  ['enableWaitingList',  'enable_waiting_list'],
  ['notifyLeader',       'notify_leader'],
  ['displayWaitingList', 'display_waiting_list'],
  ['information',        'information'],
  ['notes',              'notes'],
  ['showAddresses',      'show_addresses'],
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
      `UPDATE groups SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    if (!group) throw AppError('Group not found.', 404);
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /groups/:id ───────────────────────────────────────────────────

router.delete('/:id', requirePrivilege('group_records_all', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Group not found.', 404);

    await tenantQuery(slug, `DELETE FROM groups WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Group deleted.' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GROUP MEMBERS  sub-resource:  /groups/:id/members
// ─────────────────────────────────────────────────────────────────────────

// ─── GET /groups/:id/members ──────────────────────────────────────────────
// Query: showWaiting=true (default: show active + waiting), showWaiting=false (joined only)

router.get('/:id/members', requirePrivilege('group_records_all', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { showWaiting = 'true' } = req.query;

    const [group] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1`, [req.params.id]);
    if (!group) throw AppError('Group not found.', 404);

    const waitingCondition = showWaiting === 'false' ? 'AND gm.waiting_since IS NULL' : '';

    const rows = await tenantQuery(
      slug,
      `SELECT gm.id AS gm_id, gm.member_id, gm.is_leader, gm.waiting_since, gm.created_at AS joined_at,
              m.membership_number, m.title, m.forenames, m.surname, m.known_as,
              m.email, m.mobile, m.hide_contact,
              ms.name AS status,
              a.house_no, a.street, a.town, a.postcode, a.telephone
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN addresses a ON a.id = m.address_id
       WHERE gm.group_id = $1 ${waitingCondition}
       ORDER BY m.surname, m.forenames`,
      [req.params.id],
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── POST /groups/:id/members ─────────────────────────────────────────────
// Add member by memberId OR membershipNumber

const addMemberSchema = z.union([
  z.object({ memberId: z.string().min(1) }),
  z.object({ membershipNumber: z.coerce.number().int().positive() }),
]);

router.post('/:id/members', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;

    // Validate body first so invalid input returns 422 before any DB call
    const data = addMemberSchema.parse(req.body);

    const [group] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1`, [req.params.id]);
    if (!group) throw AppError('Group not found.', 404);

    let member;
    if ('memberId' in data) {
      const [row] = await tenantQuery(
        slug,
        `SELECT id, membership_number, forenames, surname FROM members WHERE id = $1`,
        [data.memberId],
      );
      member = row;
    } else {
      const [row] = await tenantQuery(
        slug,
        `SELECT id, membership_number, forenames, surname FROM members WHERE membership_number = $1`,
        [data.membershipNumber],
      );
      member = row;
    }

    if (!member) throw AppError('Member not found.', 404);

    // Check not already in group
    const [existing] = await tenantQuery(
      slug,
      `SELECT id FROM group_members WHERE group_id = $1 AND member_id = $2`,
      [req.params.id, member.id],
    );
    if (existing) throw AppError('Member is already in this group.', 409);

    // Determine whether to add to waiting list
    const [groupInfo] = await tenantQuery(
      slug,
      `SELECT max_members, enable_waiting_list,
              (SELECT COUNT(*)::int FROM group_members WHERE group_id = $1 AND waiting_since IS NULL) AS joined_count
       FROM groups WHERE id = $1`,
      [req.params.id],
    );
    const addToWaiting = groupInfo?.enable_waiting_list &&
      groupInfo?.max_members !== null &&
      groupInfo?.joined_count >= groupInfo?.max_members;

    const waitingSince = addToWaiting ? new Date().toISOString().slice(0, 10) : null;

    const [gm] = await tenantQuery(
      slug,
      `INSERT INTO group_members (group_id, member_id, waiting_since) VALUES ($1, $2, $3::date)
       RETURNING id, group_id, member_id, is_leader, waiting_since, created_at`,
      [req.params.id, member.id, waitingSince],
    );

    res.status(201).json({
      ...gm,
      membership_number: member.membership_number,
      forenames: member.forenames,
      surname: member.surname,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /groups/:id/members/:memberId ──────────────────────────────────
// Toggle leader status; or promote from waiting list (waitingSince: null)

const patchMemberSchema = z.object({
  isLeader:     z.boolean().optional(),
  waitingSince: z.null().optional(),   // pass null to promote from waiting list
});

router.patch('/:id/members/:memberId', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = patchMemberSchema.parse(req.body);

    const setClauses = [];
    const values = [];
    let i = 1;

    if (data.isLeader !== undefined) {
      setClauses.push(`is_leader = $${i++}`);
      values.push(data.isLeader);
    }
    if ('waitingSince' in data && data.waitingSince === null) {
      setClauses.push(`waiting_since = NULL`);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    values.push(req.params.id, req.params.memberId);

    const [gm] = await tenantQuery(
      slug,
      `UPDATE group_members SET ${setClauses.join(', ')}
       WHERE group_id = $${i} AND member_id = $${i + 1}
       RETURNING id, member_id, is_leader, waiting_since`,
      values,
    );
    if (!gm) throw AppError('Group member not found.', 404);
    res.json(gm);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /groups/:id/members/:memberId ─────────────────────────────────

router.delete('/:id/members/:memberId', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [gm] = await tenantQuery(
      slug,
      `DELETE FROM group_members WHERE group_id = $1 AND member_id = $2 RETURNING id`,
      [req.params.id, req.params.memberId],
    );
    if (!gm) throw AppError('Group member not found.', 404);
    res.json({ message: 'Member removed from group.' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GROUP EVENTS  (schedule)  sub-resource:  /groups/:id/events
// ─────────────────────────────────────────────────────────────────────────

// ─── GET /groups/:id/events ───────────────────────────────────────────────

router.get('/:id/events', requirePrivilege('group_records_all', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [group] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1`, [req.params.id]);
    if (!group) throw AppError('Group not found.', 404);

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.venue_id, v.name AS venue_name,
              ge.contact, ge.details, ge.is_private,
              ge.created_at, ge.updated_at
       FROM group_events ge
       LEFT JOIN venues v ON v.id = ge.venue_id
       WHERE ge.group_id = $1
       ORDER BY ge.event_date, ge.start_time`,
      [req.params.id],
    );
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// ─── POST /groups/:id/events ──────────────────────────────────────────────
// Create one or more events (recurring support via repeat count)

const eventSchema = z.object({
  eventDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:  z.string().nullable().optional(),
  endTime:    z.string().nullable().optional(),
  venueId:    z.string().nullable().optional(),
  contact:    z.string().nullable().optional(),
  details:    z.string().nullable().optional(),
  isPrivate:  z.boolean().default(false),
  // Recurrence
  repeatEvery:  z.number().int().positive().nullable().optional(),
  repeatUnit:   z.enum(['days', 'weeks', 'months']).optional(),
  repeatUntil:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

router.post('/:id/events', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [group] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1`, [req.params.id]);
    if (!group) throw AppError('Group not found.', 404);

    const data = eventSchema.parse(req.body);

    // Build list of dates
    const dates = [data.eventDate];
    if (data.repeatEvery && data.repeatUnit && data.repeatUntil) {
      let current = new Date(data.eventDate);
      const until  = new Date(data.repeatUntil);
      let safety = 0;
      while (safety++ < 500) {
        // Advance by repeatEvery units
        if (data.repeatUnit === 'days') {
          current = new Date(current.getTime() + data.repeatEvery * 86400000);
        } else if (data.repeatUnit === 'weeks') {
          current = new Date(current.getTime() + data.repeatEvery * 7 * 86400000);
        } else {
          // months
          const d = new Date(current);
          d.setMonth(d.getMonth() + data.repeatEvery);
          current = d;
        }
        if (current > until) break;
        dates.push(current.toISOString().slice(0, 10));
      }
    }

    const created = [];
    for (const date of dates) {
      const [ev] = await tenantQuery(
        slug,
        `INSERT INTO group_events
           (group_id, event_date, start_time, end_time, venue_id, contact, details, is_private)
         VALUES ($1,$2::date,$3::time,$4::time,$5,$6,$7,$8)
         RETURNING *`,
        [
          req.params.id,
          date,
          data.startTime  ?? null,
          data.endTime    ?? null,
          data.venueId    ?? null,
          data.contact    ?? null,
          data.details    ?? null,
          data.isPrivate,
        ],
      );
      created.push(ev);
    }

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /groups/:id/events/:eventId ────────────────────────────────────

const updateEventSchema = z.object({
  eventDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime:  z.string().nullable().optional(),
  endTime:    z.string().nullable().optional(),
  venueId:    z.string().nullable().optional(),
  contact:    z.string().nullable().optional(),
  details:    z.string().nullable().optional(),
  isPrivate:  z.boolean().optional(),
});

// [jsKey, col, cast?]
const EVENT_FIELDS = [
  ['eventDate', 'event_date', '::date'],
  ['startTime', 'start_time', '::time'],
  ['endTime',   'end_time',   '::time'],
  ['venueId',   'venue_id'],
  ['contact',   'contact'],
  ['details',   'details'],
  ['isPrivate', 'is_private'],
];

router.patch('/:id/events/:eventId', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = updateEventSchema.parse(req.body);

    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [jsKey, col, cast = ''] of EVENT_FIELDS) {
      if (data[jsKey] !== undefined) {
        setClauses.push(`${col} = $${i++}${cast}`);
        values.push(data[jsKey] ?? null);
      }
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }
    setClauses.push(`updated_at = now()`);
    values.push(req.params.eventId, req.params.id);

    const [ev] = await tenantQuery(
      slug,
      `UPDATE group_events SET ${setClauses.join(', ')}
       WHERE id = $${i} AND group_id = $${i + 1}
       RETURNING *`,
      values,
    );
    if (!ev) throw AppError('Event not found.', 404);
    res.json(ev);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /groups/:id/events ─────────────────────────────────────────────
// Body: { ids: ['...', '...'] }

router.delete('/:id/events', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);

    const placeholders = ids.map((_, idx) => `$${idx + 2}`).join(', ');
    const result = await tenantQuery(
      slug,
      `DELETE FROM group_events WHERE group_id = $1 AND id IN (${placeholders}) RETURNING id`,
      [req.params.id, ...ids],
    );
    res.json({ deleted: result.length });
  } catch (err) {
    next(err);
  }
});

export default router;
