// beacon2026/backend/src/routes/teams/members.js
// Team membership sub-resource: /teams/:id/members. Listing, downloads, and
// add/remove/bulk operations. Teams have no waiting list, so members are always
// added directly. Guarded by the `group_records_all` privilege resource.

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
  patchMemberSchema,
} from '../../schemas/common.js';
import { bulkAddToTeamSchema } from '../../schemas/teams.js';

const router = Router();

// ─── GET /teams/:id/members ──────────────────────────────────────────────
router.get(
  '/:id/members',
  requirePrivilege('group_records_all', 'view'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;

      const [team] = await tenantQuery(
        slug,
        `SELECT id FROM groups WHERE id = $1 AND type = 'team'`,
        [req.params.id],
      );
      if (!team) throw AppError('Team not found.', 404);

      const rows = await tenantQuery(
        slug,
        `SELECT gm.id AS gm_id, gm.member_id, gm.is_leader, gm.created_at AS joined_at,
              m.membership_number, m.title, m.forenames, m.surname, m.known_as,
              m.email, m.mobile, m.hide_contact, m.next_renewal,
              ms.name AS status,
              a.house_no, a.street, a.town, a.postcode, a.telephone
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN addresses a ON a.id = m.address_id
       WHERE gm.group_id = $1
       ORDER BY m.surname, m.forenames`,
        [req.params.id],
      );

      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /teams/:id/members/download ────────────────────────────────────
const TEAM_MEMBER_FIELD_DEFS = {
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
};

router.get(
  '/:id/members/download',
  requirePrivilege('group_records_all', 'view'),
  async (req, res, next) => {
    try {
      const { format = 'excel', ids = '', fields = '' } = req.query;
      const slug = req.user.tenantSlug;
      const teamId = req.params.id;

      const [team] = await tenantQuery(
        slug,
        `SELECT id, name FROM groups WHERE id = $1 AND type = 'team'`,
        [teamId],
      );
      if (!team) throw AppError('Team not found.', 404);

      const memberIds = ids
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const rows = await tenantQuery(
        slug,
        `SELECT gm.member_id, gm.is_leader,
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
        [teamId, memberIds.length ? memberIds : null],
      );

      const tenantPart = slug.replace(/^u3a_/, '');
      const safeName = team.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const stamp = new Date().toISOString().slice(0, 10);

      const activeCols = fields
        .split(',')
        .map((s) => s.trim())
        .filter((f) => f && TEAM_MEMBER_FIELD_DEFS[f]);
      const cols = activeCols.length ? activeCols : Object.keys(TEAM_MEMBER_FIELD_DEFS);

      if (format === 'excel') {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Team Members');
        ws.columns = cols.map((f) => ({ header: TEAM_MEMBER_FIELD_DEFS[f].label, width: 20 }));
        ws.getRow(1).font = { bold: true };
        for (const m of rows)
          ws.addRow(cols.map((f) => sanitizeCell(TEAM_MEMBER_FIELD_DEFS[f].get(m))));
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
        const title = `${team.name} — Members — ${stamp}`;

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
          const PHOTO_SIZE = 36;
          const PHOTO_ROW_H = PHOTO_SIZE + 6;
          const TEXT_X = MARGIN + PHOTO_SIZE + 8;
          const textW = usableW - PHOTO_SIZE - 8;

          for (const m of rows) {
            if (y + PHOTO_ROW_H > PAGE_H - MARGIN) {
              doc.addPage({ size: 'A4', layout: 'landscape' });
              y = MARGIN + 4;
            }
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
            const displayName = [m.title, m.forenames, m.surname].filter(Boolean).join(' ');
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
            doc.text(displayName, TEXT_X, y, { width: textW, lineBreak: false, ellipsis: true });
            doc.font('Helvetica').fontSize(FONT_SZ).fillColor('#333333');
            const details = cols
              .filter((f) => !['title', 'forenames', 'surname'].includes(f))
              .map((f) => TEAM_MEMBER_FIELD_DEFS[f].get(m))
              .filter(Boolean)
              .join('  |  ');
            doc.text(details, TEXT_X, y + 11, { width: textW, lineBreak: false, ellipsis: true });
            doc
              .moveTo(MARGIN, y + PHOTO_ROW_H - 3)
              .lineTo(PAGE_W - MARGIN, y + PHOTO_ROW_H - 3)
              .strokeColor('#dddddd')
              .stroke();
            y += PHOTO_ROW_H;
          }
        } else {
          const colW = usableW / cols.length;
          function drawHeader(hy) {
            doc.font('Helvetica-Bold').fontSize(FONT_SZ);
            cols.forEach((f, idx) => {
              doc.text(TEAM_MEMBER_FIELD_DEFS[f].label, MARGIN + idx * colW, hy, {
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
              doc.text(TEAM_MEMBER_FIELD_DEFS[f].get(m), MARGIN + idx * colW, y, {
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

// ─── POST /teams/:id/members ─────────────────────────────────────────────
router.post(
  '/:id/members',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const data = addMemberSchema.parse(req.body);

      const [team] = await tenantQuery(
        slug,
        `SELECT id FROM groups WHERE id = $1 AND type = 'team'`,
        [req.params.id],
      );
      if (!team) throw AppError('Team not found.', 404);

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

      const [existing] = await tenantQuery(
        slug,
        `SELECT id FROM group_members WHERE group_id = $1 AND member_id = $2`,
        [req.params.id, member.id],
      );
      if (existing) throw AppError('Member is already in this team.', 409);

      // Teams have no waiting list — always add directly
      const [gm] = await tenantQuery(
        slug,
        `INSERT INTO group_members (group_id, member_id) VALUES ($1, $2)
       RETURNING id, group_id, member_id, is_leader, created_at`,
        [req.params.id, member.id],
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

// ─── POST /teams/:id/members/bulk ───────────────────────────────────────
router.post(
  '/:id/members/bulk',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { memberIds } = bulkAddMembersSchema.parse(req.body);

      const [team] = await tenantQuery(
        slug,
        `SELECT id FROM groups WHERE id = $1 AND type = 'team'`,
        [req.params.id],
      );
      if (!team) throw AppError('Team not found.', 404);

      let added = 0;
      let skipped = 0;

      for (const memberId of memberIds) {
        const [existing] = await tenantQuery(
          slug,
          `SELECT id FROM group_members WHERE group_id = $1 AND member_id = $2`,
          [req.params.id, memberId],
        );
        if (existing) {
          skipped++;
          continue;
        }

        await tenantQuery(slug, `INSERT INTO group_members (group_id, member_id) VALUES ($1, $2)`, [
          req.params.id,
          memberId,
        ]);
        added++;
      }

      res.json({ added, skipped, waitlisted: 0 });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /teams/:id/members/:memberId ──────────────────────────────────
router.patch(
  '/:id/members/:memberId',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const data = patchMemberSchema.parse(req.body);

      if (data.isLeader === undefined) {
        return res.status(400).json({ error: 'Nothing to update.' });
      }

      const [gm] = await tenantQuery(
        slug,
        `UPDATE group_members SET is_leader = $1
       WHERE group_id = $2 AND member_id = $3
       RETURNING id, member_id, is_leader`,
        [data.isLeader, req.params.id, req.params.memberId],
      );
      if (!gm) throw AppError('Team member not found.', 404);
      res.json(gm);
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /teams/:id/members/bulk ──────────────────────────────────────
router.delete(
  '/:id/members/bulk',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { memberIds } = bulkMemberIdsSchema.parse(req.body);

      const [team] = await tenantQuery(
        slug,
        `SELECT id FROM groups WHERE id = $1 AND type = 'team'`,
        [req.params.id],
      );
      if (!team) throw AppError('Team not found.', 404);

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

// ─── POST /teams/:id/members/bulk-add ───────────────────────────────────
router.post(
  '/:id/members/bulk-add',
  requirePrivilege('group_records_all', 'change'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { memberIds, targetTeamId } = bulkAddToTeamSchema.parse(req.body);

      const [targetTeam] = await tenantQuery(
        slug,
        `SELECT id FROM groups WHERE id = $1 AND type = 'team'`,
        [targetTeamId],
      );
      if (!targetTeam) throw AppError('Target team not found.', 404);

      const existing = await tenantQuery(
        slug,
        `SELECT member_id FROM group_members WHERE group_id = $1 AND member_id = ANY($2::uuid[])`,
        [targetTeamId, memberIds],
      );
      const existingSet = new Set(existing.map((r) => r.member_id));
      const toAdd = memberIds.filter((id) => !existingSet.has(id));

      let added = 0;
      for (const memberId of toAdd) {
        await tenantQuery(slug, `INSERT INTO group_members (group_id, member_id) VALUES ($1, $2)`, [
          targetTeamId,
          memberId,
        ]);
        added++;
      }

      res.json({ added, waitlisted: 0, skipped: existingSet.size });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /teams/:id/members/:memberId ─────────────────────────────────
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
      if (!gm) throw AppError('Team member not found.', 404);
      res.json({ message: 'Member removed from team.' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
