// beacon2/backend/src/routes/groups/members.js
// Group membership sub-resource: /groups/:id/members. Listing, downloads, and
// add/remove/bulk operations. Guarded by the `group_records_all` privilege.

import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { sanitizeCell } from '../../utils/spreadsheet.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  addMemberSchema,
  bulkAddMembersSchema,
  bulkMemberIdsSchema,
} from '../../schemas/common.js';
import { patchGroupMemberSchema, bulkAddToGroupSchema } from '../../schemas/groups.js';

const router = Router();

// ─── GET /groups/:id/members ──────────────────────────────────────────────
// Query: showWaiting=true (default: show active + waiting), showWaiting=false (joined only)

router.get(
  '/:id/members',
  requirePrivilege('group_records_all', 'view'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { showWaiting = 'true' } = req.query;

      const [group] = await tenantQuery(
        slug,
        `SELECT id FROM groups WHERE id = $1 AND type = 'group'`,
        [req.params.id],
      );
      if (!group) throw AppError('Group not found.', 404);

      const waitingCondition = showWaiting === 'false' ? 'AND gm.waiting_since IS NULL' : '';

      const rows = await tenantQuery(
        slug,
        `SELECT gm.id AS gm_id, gm.member_id, gm.is_leader, gm.waiting_since, gm.created_at AS joined_at,
              m.membership_number, m.title, m.forenames, m.surname, m.known_as,
              m.email, m.mobile, m.hide_contact, m.next_renewal,
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
  },
);

// ─── GET /groups/:id/members/download ────────────────────────────────────
// Download selected group members as Excel or PDF.
// Query params: format (excel|pdf), ids (comma-separated member IDs), fields (comma-separated)

const GROUP_MEMBER_FIELD_DEFS = {
  membership_number: { label: 'Membership No', get: (m) => String(m.membership_number ?? '') },
  title: { label: 'Title', get: (m) => m.title ?? '' },
  forenames: { label: 'Forenames', get: (m) => m.forenames ?? '' },
  known_as: { label: 'Known As', get: (m) => m.known_as ?? '' },
  surname: { label: 'Surname', get: (m) => m.surname ?? '' },
  email: { label: 'Email', get: (m) => m.email ?? '' },
  mobile: { label: 'Mobile', get: (m) => m.mobile ?? '' },
  telephone: { label: 'Telephone', get: (m) => m.telephone ?? '' },
  address: { label: 'Address', get: (m) => [m.house_no, m.street].filter(Boolean).join(', ') },
  town: { label: 'Town', get: (m) => m.town ?? '' },
  postcode: { label: 'Postcode', get: (m) => m.postcode ?? '' },
  status: { label: 'Status', get: (m) => m.status ?? '' },
  is_leader: { label: 'Leader', get: (m) => (m.is_leader ? 'Yes' : '') },
  waiting_since: {
    label: 'Waiting',
    get: (m) => (m.waiting_since ? String(m.waiting_since).slice(0, 10) : ''),
  },
};

router.get(
  '/:id/members/download',
  requirePrivilege('group_records_all', 'view'),
  async (req, res, next) => {
    try {
      const { format = 'excel', ids = '', fields = '' } = req.query;
      const slug = req.user.tenantSlug;
      const groupId = req.params.id;

      const [group] = await tenantQuery(
        slug,
        `SELECT id, name FROM groups WHERE id = $1 AND type = 'group'`,
        [groupId],
      );
      if (!group) throw AppError('Group not found.', 404);

      const memberIds = ids
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const rows = await tenantQuery(
        slug,
        `SELECT gm.member_id, gm.is_leader, gm.waiting_since,
              m.membership_number, m.title, m.forenames, m.surname, m.known_as,
              m.email, m.mobile,
              m.photo_data, m.photo_mime_type,
              ms.name AS status,
              a.house_no, a.street, a.town, a.postcode, a.telephone
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN addresses a ON a.id = m.address_id
       WHERE gm.group_id = $1
         AND ($2::text[] IS NULL OR gm.member_id = ANY($2::text[]))
       ORDER BY m.surname, m.forenames`,
        [groupId, memberIds.length ? memberIds : null],
      );

      const tenantPart = slug.replace(/^u3a_/, '');
      const safeName = group.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const stamp = new Date().toISOString().slice(0, 10);

      const activeCols = fields
        .split(',')
        .map((s) => s.trim())
        .filter((f) => f && GROUP_MEMBER_FIELD_DEFS[f]);
      const cols = activeCols.length ? activeCols : Object.keys(GROUP_MEMBER_FIELD_DEFS);

      if (format === 'excel') {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Group Members');
        ws.columns = cols.map((f) => ({ header: GROUP_MEMBER_FIELD_DEFS[f].label, width: 20 }));
        ws.getRow(1).font = { bold: true };
        for (const m of rows)
          ws.addRow(cols.map((f) => sanitizeCell(GROUP_MEMBER_FIELD_DEFS[f].get(m))));
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${tenantPart}_${safeName}_members_${stamp}.xlsx"`,
        );
        await wb.xlsx.write(res);
        return res.end();
      }

      if (format === 'pdf') {
        const PAGE_W = 841.89;
        const PAGE_H = 595.28;
        const MARGIN = 36;
        const FONT_SZ = 7;
        const ROW_H = 13;
        const usableW = PAGE_W - MARGIN * 2;
        const title = `${group.name} — Members — ${stamp}`;

        // Check if any member has a photo — if so, use photo-aware layout
        const hasAnyPhoto = rows.some((m) => m.photo_data && m.photo_mime_type);

        const doc = new PDFDocument({
          margin: MARGIN,
          size: 'A4',
          layout: 'landscape',
          autoFirstPage: true,
        });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        const done = new Promise((resolve) => doc.on('end', resolve));

        let y = MARGIN + 4;
        doc.font('Helvetica-Bold').fontSize(9).text(title, MARGIN, y, { lineBreak: false });
        y += 16;

        if (hasAnyPhoto) {
          // Photo-aware layout: each row is taller to accommodate a small photo
          const PHOTO_SIZE = 36;
          const PHOTO_ROW_H = PHOTO_SIZE + 6;
          const TEXT_X = MARGIN + PHOTO_SIZE + 8;
          const textW = usableW - PHOTO_SIZE - 8;

          for (const m of rows) {
            if (y + PHOTO_ROW_H > PAGE_H - MARGIN) {
              doc.addPage({ size: 'A4', layout: 'landscape' });
              y = MARGIN + 4;
            }

            // Draw photo if available
            if (m.photo_data && m.photo_mime_type) {
              try {
                const photoBuf = Buffer.from(m.photo_data, 'base64');
                doc.image(photoBuf, MARGIN, y, {
                  width: PHOTO_SIZE,
                  height: PHOTO_SIZE,
                  fit: [PHOTO_SIZE, PHOTO_SIZE],
                });
              } catch {
                /* skip photo */
              }
            }

            // Name line
            const displayName = [m.title, m.forenames, m.surname].filter(Boolean).join(' ');
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
            doc.text(displayName, TEXT_X, y, { width: textW, lineBreak: false, ellipsis: true });

            // Details line(s)
            doc.font('Helvetica').fontSize(FONT_SZ).fillColor('#333333');
            const details = cols
              .filter((f) => !['title', 'forenames', 'surname'].includes(f))
              .map((f) => GROUP_MEMBER_FIELD_DEFS[f].get(m))
              .filter(Boolean)
              .join('  |  ');
            doc.text(details, TEXT_X, y + 11, { width: textW, lineBreak: false, ellipsis: true });

            // Separator
            doc
              .moveTo(MARGIN, y + PHOTO_ROW_H - 3)
              .lineTo(PAGE_W - MARGIN, y + PHOTO_ROW_H - 3)
              .strokeColor('#dddddd')
              .stroke();
            y += PHOTO_ROW_H;
          }
        } else {
          // Standard tabular layout (no photos)
          const colW = usableW / cols.length;

          function drawHeader(hy) {
            doc.font('Helvetica-Bold').fontSize(FONT_SZ);
            cols.forEach((f, idx) => {
              doc.text(GROUP_MEMBER_FIELD_DEFS[f].label, MARGIN + idx * colW, hy, {
                width: colW - 3,
                lineBreak: false,
                ellipsis: true,
              });
            });
            return hy + ROW_H;
          }

          y = drawHeader(y);
          doc
            .moveTo(MARGIN, y - 2)
            .lineTo(PAGE_W - MARGIN, y - 2)
            .strokeColor('#aaaaaa')
            .stroke();

          doc.font('Helvetica').fontSize(FONT_SZ);
          for (const m of rows) {
            if (y + ROW_H > PAGE_H - MARGIN) {
              doc.addPage({ size: 'A4', layout: 'landscape' });
              y = MARGIN + 4;
              y = drawHeader(y);
              doc
                .moveTo(MARGIN, y - 2)
                .lineTo(PAGE_W - MARGIN, y - 2)
                .strokeColor('#aaaaaa')
                .stroke();
              doc.font('Helvetica').fontSize(FONT_SZ);
            }
            cols.forEach((f, idx) => {
              doc.text(GROUP_MEMBER_FIELD_DEFS[f].get(m), MARGIN + idx * colW, y, {
                width: colW - 3,
                lineBreak: false,
                ellipsis: true,
              });
            });
            y += ROW_H;
          }
        }

        doc.end();
        await done;
        const buf = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${tenantPart}_${safeName}_members_${stamp}.pdf"`,
        );
        return res.send(buf);
      }

      throw AppError('Invalid format.', 400);
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /groups/:id/members ─────────────────────────────────────────────
// Add member by memberId OR membershipNumber

router.post(
  '/:id/members',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;

      // Validate body first so invalid input returns 422 before any DB call
      const data = addMemberSchema.parse(req.body);

      const [group] = await tenantQuery(
        slug,
        `SELECT id FROM groups WHERE id = $1 AND type = 'group'`,
        [req.params.id],
      );
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
       FROM groups WHERE id = $1 AND type = 'group'`,
        [req.params.id],
      );
      const addToWaiting =
        groupInfo?.enable_waiting_list &&
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
  },
);

// ─── POST /groups/:id/members/bulk ───────────────────────────────────────
// Bulk-add multiple members to a group (from Members list "Add to group").
// Respects max-members / waiting-list logic per member.

router.post(
  '/:id/members/bulk',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { memberIds } = bulkAddMembersSchema.parse(req.body);

      const [group] = await tenantQuery(
        slug,
        `SELECT id, max_members, enable_waiting_list FROM groups WHERE id = $1 AND type = 'group'`,
        [req.params.id],
      );
      if (!group) throw AppError('Group not found.', 404);

      // Current joined count (excluding waiting list)
      const [{ count: joinedCount }] = await tenantQuery(
        slug,
        `SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1 AND waiting_since IS NULL`,
        [req.params.id],
      );

      let added = 0;
      let skipped = 0;
      let waitlisted = 0;
      let currentJoined = joinedCount;

      for (const memberId of memberIds) {
        // Skip if already in group
        const [existing] = await tenantQuery(
          slug,
          `SELECT id FROM group_members WHERE group_id = $1 AND member_id = $2`,
          [req.params.id, memberId],
        );
        if (existing) {
          skipped++;
          continue;
        }

        // Determine whether to add to waiting list
        const addToWaiting =
          group.enable_waiting_list &&
          group.max_members !== null &&
          currentJoined >= group.max_members;

        const waitingSince = addToWaiting ? new Date().toISOString().slice(0, 10) : null;

        await tenantQuery(
          slug,
          `INSERT INTO group_members (group_id, member_id, waiting_since) VALUES ($1, $2, $3::date)`,
          [req.params.id, memberId, waitingSince],
        );

        if (addToWaiting) {
          waitlisted++;
        } else {
          currentJoined++;
          added++;
        }
      }

      res.json({ added, skipped, waitlisted });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /groups/:id/members/:memberId ──────────────────────────────────
// Toggle leader status; or promote from waiting list (waitingSince: null)

router.patch(
  '/:id/members/:memberId',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const data = patchGroupMemberSchema.parse(req.body);

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
  },
);

// ─── DELETE /groups/:id/members/bulk ──────────────────────────────────────
// Bulk-remove multiple members from a group.
// NOTE: Must be registered before /:memberId to avoid Express treating "bulk" as a param.

router.delete(
  '/:id/members/bulk',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { memberIds } = bulkMemberIdsSchema.parse(req.body);

      const [group] = await tenantQuery(
        slug,
        `SELECT id FROM groups WHERE id = $1 AND type = 'group'`,
        [req.params.id],
      );
      if (!group) throw AppError('Group not found.', 404);

      const result = await tenantQuery(
        slug,
        `DELETE FROM group_members WHERE group_id = $1 AND member_id = ANY($2::uuid[]) RETURNING member_id`,
        [req.params.id, memberIds],
      );
      res.json({ removed: result.length });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /groups/:id/members/bulk-add ───────────────────────────────────
// Add multiple members to another group (from the current group's member list).
// NOTE: Must be registered before the POST /:id/members route.

router.post(
  '/:id/members/bulk-add',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { memberIds, targetGroupId } = bulkAddToGroupSchema.parse(req.body);

      const [targetGroup] = await tenantQuery(
        slug,
        `SELECT id, max_members, enable_waiting_list FROM groups WHERE id = $1 AND type = 'group'`,
        [targetGroupId],
      );
      if (!targetGroup) throw AppError('Target group not found.', 404);

      // Get current joined count for waiting-list logic
      const [{ count: joinedCount }] = await tenantQuery(
        slug,
        `SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1 AND waiting_since IS NULL`,
        [targetGroupId],
      );

      // Find which members are already in the target group
      const existing = await tenantQuery(
        slug,
        `SELECT member_id FROM group_members WHERE group_id = $1 AND member_id = ANY($2::uuid[])`,
        [targetGroupId, memberIds],
      );
      const existingSet = new Set(existing.map((r) => r.member_id));
      const toAdd = memberIds.filter((id) => !existingSet.has(id));

      let added = 0;
      let waitlisted = 0;
      let capacity =
        targetGroup.max_members !== null ? targetGroup.max_members - joinedCount : Infinity;

      for (const memberId of toAdd) {
        const addToWaiting = targetGroup.enable_waiting_list && capacity <= 0;
        const waitingSince = addToWaiting ? new Date().toISOString().slice(0, 10) : null;

        await tenantQuery(
          slug,
          `INSERT INTO group_members (group_id, member_id, waiting_since) VALUES ($1, $2, $3::date)`,
          [targetGroupId, memberId, waitingSince],
        );

        if (addToWaiting) {
          waitlisted++;
        } else {
          added++;
          capacity--;
        }
      }

      res.json({ added, waitlisted, skipped: existingSet.size });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /groups/:id/members/:memberId ─────────────────────────────────

router.delete(
  '/:id/members/:memberId',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
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
  },
);

export default router;
