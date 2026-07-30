// beacon2026/backend/src/routes/calendar/eventMembers.js
// Event members — attendance/organiser tracking per event:
// /calendar/events/:eventId/members. Gated by the `eventAttendance` feature and
// guarded by the `event_attendance` privilege resource.

import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../utils/audit.js';
import { fmtDateUK } from './helpers.js';

const router = Router();

// ─── GET /calendar/events/:eventId/members ───────────────────────────────────

router.get(
  '/events/:eventId/members',
  requireFeature('eventAttendance'),
  requirePrivilege('event_attendance', 'view'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const rows = await tenantQuery(
        slug,
        `SELECT em.id, em.event_id, em.member_id, em.is_organiser, em.notes, em.created_at,
              m.membership_number, m.forenames, m.surname, m.email
       FROM event_members em
       JOIN members m ON m.id = em.member_id
       WHERE em.event_id = $1
       ORDER BY em.is_organiser DESC, m.surname, m.forenames`,
        [req.params.eventId],
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /calendar/events/:eventId/members ──────────────────────────────────

const addEventMembersSchema = z.object({
  memberIds: z.array(z.string()).min(1),
  isOrganiser: z.boolean().default(false),
});

router.post(
  '/events/:eventId/members',
  requireFeature('eventAttendance'),
  requirePrivilege('event_attendance', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { eventId } = req.params;
      const data = addEventMembersSchema.parse(req.body);

      // Verify event exists
      const [ev] = await tenantQuery(slug, `SELECT id FROM group_events WHERE id = $1`, [eventId]);
      if (!ev) throw AppError('Event not found.', 404);

      const inserted = [];
      for (const memberId of data.memberIds) {
        const [row] = await tenantQuery(
          slug,
          `INSERT INTO event_members (event_id, member_id, is_organiser)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, member_id) DO NOTHING
         RETURNING *`,
          [eventId, memberId, data.isOrganiser],
        );
        if (row) inserted.push(row);
      }

      await logAudit(
        slug,
        req.user,
        'add_event_members',
        'group_events',
        eventId,
        null,
        `Added ${inserted.length} member(s) to event`,
      );

      res.status(201).json(inserted);
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /calendar/events/:eventId/members/from-group ───────────────────────

router.post(
  '/events/:eventId/members/from-group',
  requireFeature('eventAttendance'),
  requirePrivilege('event_attendance', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { eventId } = req.params;

      // Verify event exists and has a group
      const [ev] = await tenantQuery(slug, `SELECT id, group_id FROM group_events WHERE id = $1`, [
        eventId,
      ]);
      if (!ev) throw AppError('Event not found.', 404);
      if (!ev.group_id) throw AppError('Event is not linked to a group.', 400);

      // Copy group members in a single INSERT...SELECT
      const result = await tenantQuery(
        slug,
        `INSERT INTO event_members (event_id, member_id, is_organiser)
       SELECT $1, gm.member_id, gm.is_leader
       FROM group_members gm
       WHERE gm.group_id = $2
       ON CONFLICT (event_id, member_id) DO NOTHING
       RETURNING id`,
        [eventId, ev.group_id],
      );

      await logAudit(
        slug,
        req.user,
        'copy_group_to_event',
        'group_events',
        eventId,
        null,
        `Copied ${result.length} member(s) from group`,
      );

      res.status(201).json({ added: result.length });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /calendar/events/:eventId/members/:memberId ───────────────────────

const updateEventMemberSchema = z.object({
  isOrganiser: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

router.patch(
  '/events/:eventId/members/:memberId',
  requireFeature('eventAttendance'),
  requirePrivilege('event_attendance', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { eventId, memberId } = req.params;
      const data = updateEventMemberSchema.parse(req.body);

      const setClauses = [];
      const values = [];
      let i = 1;
      if (data.isOrganiser !== undefined) {
        setClauses.push(`is_organiser = $${i++}`);
        values.push(data.isOrganiser);
      }
      if (data.notes !== undefined) {
        setClauses.push(`notes = $${i++}`);
        values.push(data.notes);
      }
      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'Nothing to update.' });
      }

      values.push(eventId, memberId);
      const [row] = await tenantQuery(
        slug,
        `UPDATE event_members SET ${setClauses.join(', ')}
       WHERE event_id = $${i++} AND member_id = $${i}
       RETURNING *`,
        values,
      );
      if (!row) throw AppError('Event member not found.', 404);
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /calendar/events/:eventId/members ────────────────────────────────

router.delete(
  '/events/:eventId/members',
  requireFeature('eventAttendance'),
  requirePrivilege('event_attendance', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { eventId } = req.params;
      const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);

      const placeholders = ids.map((_, idx) => `$${idx + 2}`).join(', ');
      const result = await tenantQuery(
        slug,
        `DELETE FROM event_members
       WHERE event_id = $1 AND member_id IN (${placeholders})
       RETURNING id`,
        [eventId, ...ids],
      );

      await logAudit(
        slug,
        req.user,
        'remove_event_members',
        'group_events',
        eventId,
        null,
        `Removed ${result.length} member(s) from event`,
      );

      res.json({ deleted: result.length });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /calendar/events/:eventId/members/download ──────────────────────────

router.get(
  '/events/:eventId/members/download',
  requireFeature('eventAttendance'),
  requirePrivilege('event_attendance', 'download'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { eventId } = req.params;

      // Get event info for the title
      const [ev] = await tenantQuery(
        slug,
        `SELECT ge.event_date, ge.topic, g.name AS group_name
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       WHERE ge.id = $1`,
        [eventId],
      );
      if (!ev) throw AppError('Event not found.', 404);

      const rows = await tenantQuery(
        slug,
        `SELECT m.membership_number, m.forenames, m.surname, m.email,
              em.is_organiser, em.notes
       FROM event_members em
       JOIN members m ON m.id = em.member_id
       WHERE em.event_id = $1
       ORDER BY em.is_organiser DESC, m.surname, m.forenames`,
        [eventId],
      );

      const title = ev.topic || ev.group_name || 'Event';
      const dateStr = fmtDateUK(ev.event_date);

      // Build PDF
      const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));

      doc.font('Helvetica-Bold').fontSize(14).text(`${title} — ${dateStr}`, { align: 'center' });
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).text(`${rows.length} member(s)`, { align: 'center' });
      doc.moveDown(0.5);

      const cols = [
        { label: 'No', x: 40, w: 50 },
        { label: 'Name', x: 90, w: 160 },
        { label: 'Email', x: 250, w: 180 },
        { label: 'Role', x: 430, w: 70 },
        { label: 'Notes', x: 500, w: 60 },
      ];

      function drawHeader(y) {
        doc.font('Helvetica-Bold').fontSize(8);
        for (const col of cols) {
          doc.text(col.label, col.x, y, { width: col.w, ellipsis: true });
        }
        doc
          .moveTo(40, y + 12)
          .lineTo(560, y + 12)
          .lineWidth(0.5)
          .stroke();
        return y + 16;
      }

      let y = drawHeader(doc.y);
      doc.font('Helvetica').fontSize(8);

      for (const r of rows) {
        if (y > 780) {
          doc.addPage();
          y = drawHeader(40);
          doc.font('Helvetica').fontSize(8);
        }
        doc.text(r.membership_number || '', cols[0].x, y, { width: cols[0].w, ellipsis: true });
        doc.text(`${r.surname}, ${r.forenames}`, cols[1].x, y, {
          width: cols[1].w,
          ellipsis: true,
        });
        doc.text(r.email || '', cols[2].x, y, { width: cols[2].w, ellipsis: true });
        doc.text(r.is_organiser ? 'Organiser' : 'Member', cols[3].x, y, {
          width: cols[3].w,
          ellipsis: true,
        });
        doc.text(r.notes || '', cols[4].x, y, { width: cols[4].w, ellipsis: true });
        y += 14;
      }

      doc.end();
      await new Promise((resolve) => doc.on('end', resolve));

      const pdfBuffer = Buffer.concat(chunks);
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="event_members_${stamp}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
