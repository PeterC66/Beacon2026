// beacon2/backend/src/routes/groups.js

import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
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

    const conditions = [`g.type = 'group'`];
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

    const where = `WHERE ${conditions.join(' AND ')}`;

    const groups = await tenantQuery(
      slug,
      `SELECT g.id, g.name, g.short_name, g.faculty_id, f.name AS faculty_name,
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

// ─── GET /groups/download ─────────────────────────────────────────────────
// Download selected groups as Excel or PDF.
// Query params: format (excel|pdf), ids (comma-separated group IDs), fields (comma-separated)

const GROUP_LIST_FIELD_DEFS = {
  name:         { label: 'Group',        get: (g) => g.name ?? '' },
  when_text:    { label: 'When',         get: (g) => g.when_text ?? '' },
  leaders:      { label: 'Leader(s)',    get: (g) => (g.leaders ?? []).map((l) => `${l.forenames} ${l.surname}`).join(', ') },
  member_count: { label: 'Members',      get: (g) => g.member_count ?? 0 },
  status:       { label: 'Status',       get: (g) => g.status ?? '' },
  faculty_name: { label: 'Faculty',      get: (g) => g.faculty_name ?? '' },
  enquiries:    { label: 'Enquiries',    get: (g) => g.enquiries ?? '' },
  information:  { label: 'Information',  get: (g) => g.information ?? '' },
};

router.get('/download', requirePrivilege('groups_list', 'download'), async (req, res, next) => {
  try {
    const { format = 'excel', ids = '', fields = '' } = req.query;
    const slug = req.user.tenantSlug;

    const groupIds = ids.split(',').map((s) => s.trim()).filter(Boolean);
    if (groupIds.length === 0) throw AppError('No groups selected.', 400);

    const rows = await tenantQuery(
      slug,
      `SELECT g.id, g.name, g.short_name, g.faculty_id, f.name AS faculty_name,
              g.status, g.when_text, g.enquiries, g.information,
              (SELECT COUNT(*)::int FROM group_members gm
               WHERE gm.group_id = g.id AND gm.waiting_since IS NULL) AS member_count,
              (SELECT COALESCE(
                 json_agg(json_build_object(
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
       WHERE g.id = ANY($1::text[]) AND g.type = 'group'
       ORDER BY g.name`,
      [groupIds],
    );

    const activeCols = fields.split(',').map((s) => s.trim()).filter((f) => f && GROUP_LIST_FIELD_DEFS[f]);
    const cols = activeCols.length ? activeCols : Object.keys(GROUP_LIST_FIELD_DEFS);

    const tenantPart = slug.replace(/^u3a_/, '');
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Groups');
      ws.columns = cols.map((f) => ({ header: GROUP_LIST_FIELD_DEFS[f].label, width: 22 }));
      ws.getRow(1).font = { bold: true };
      for (const g of rows) ws.addRow(cols.map((f) => GROUP_LIST_FIELD_DEFS[f].get(g)));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${tenantPart}_groups_${stamp}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    if (format === 'pdf') {
      const PAGE_W = 841.89; const PAGE_H = 595.28;
      const MARGIN = 36; const FONT_SZ = 8; const ROW_H = 14;
      const usableW = PAGE_W - MARGIN * 2;
      const title = `Groups — ${stamp}`;

      const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape', autoFirstPage: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      const done = new Promise((resolve) => doc.on('end', resolve));

      let y = MARGIN + 4;
      doc.font('Helvetica-Bold').fontSize(10).text(title, MARGIN, y, { lineBreak: false });
      y += 18;

      const colW = usableW / cols.length;

      function drawHeader(hy) {
        doc.font('Helvetica-Bold').fontSize(FONT_SZ);
        cols.forEach((f, idx) => {
          doc.text(GROUP_LIST_FIELD_DEFS[f].label, MARGIN + idx * colW, hy, { width: colW - 3, lineBreak: false, ellipsis: true });
        });
        return hy + ROW_H;
      }

      y = drawHeader(y);
      doc.moveTo(MARGIN, y - 2).lineTo(PAGE_W - MARGIN, y - 2).strokeColor('#aaaaaa').stroke();

      doc.font('Helvetica').fontSize(FONT_SZ);
      for (const g of rows) {
        if (y + ROW_H > PAGE_H - MARGIN) {
          doc.addPage({ size: 'A4', layout: 'landscape' });
          y = MARGIN + 4;
          y = drawHeader(y);
          doc.moveTo(MARGIN, y - 2).lineTo(PAGE_W - MARGIN, y - 2).strokeColor('#aaaaaa').stroke();
          doc.font('Helvetica').fontSize(FONT_SZ);
        }
        cols.forEach((f, idx) => {
          const val = GROUP_LIST_FIELD_DEFS[f].get(g);
          doc.text(String(val), MARGIN + idx * colW, y, { width: colW - 3, lineBreak: false, ellipsis: true });
        });
        y += ROW_H;
      }

      doc.end();
      await done;
      const buf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${tenantPart}_groups_${stamp}.pdf"`);
      return res.send(buf);
    }

    throw AppError('Invalid format.', 400);
  } catch (err) { next(err); }
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
  name:                z.string().min(1).max(200),
  shortName:           z.string().max(10).nullable().optional(),
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
         (name, short_name, faculty_id, status, when_text, start_time, end_time, venue_id, enquiries,
          max_members, allow_online_join, enable_waiting_list, notify_leader,
          display_waiting_list, information, notes, show_addresses, type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'group')
       RETURNING *`,
      [
        data.name,
        data.shortName     ?? null,
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
  shortName:           z.string().max(10).nullable().optional(),
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
  ['shortName',          'short_name'],
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
      `UPDATE groups SET ${setClauses.join(', ')} WHERE id = $${i} AND type = 'group' RETURNING *`,
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
    const [existing] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1 AND type = 'group'`, [req.params.id]);
    if (!existing) throw AppError('Group not found.', 404);

    await tenantQuery(slug, `DELETE FROM groups WHERE id = $1 AND type = 'group'`, [req.params.id]);
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

    const [group] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1 AND type = 'group'`, [req.params.id]);
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
});

// ─── GET /groups/:id/members/download ────────────────────────────────────
// Download selected group members as Excel or PDF.
// Query params: format (excel|pdf), ids (comma-separated member IDs), fields (comma-separated)

const GROUP_MEMBER_FIELD_DEFS = {
  membership_number: { label: 'Membership No', get: (m) => String(m.membership_number ?? '') },
  title:        { label: 'Title',       get: (m) => m.title ?? '' },
  forenames:    { label: 'Forenames',   get: (m) => m.forenames ?? '' },
  known_as:     { label: 'Known As',    get: (m) => m.known_as ?? '' },
  surname:      { label: 'Surname',     get: (m) => m.surname ?? '' },
  email:        { label: 'Email',       get: (m) => m.email ?? '' },
  mobile:       { label: 'Mobile',      get: (m) => m.mobile ?? '' },
  telephone:    { label: 'Telephone',   get: (m) => m.telephone ?? '' },
  address:      { label: 'Address',     get: (m) => [m.house_no, m.street].filter(Boolean).join(', ') },
  town:         { label: 'Town',        get: (m) => m.town ?? '' },
  postcode:     { label: 'Postcode',    get: (m) => m.postcode ?? '' },
  status:       { label: 'Status',      get: (m) => m.status ?? '' },
  is_leader:    { label: 'Leader',      get: (m) => m.is_leader ? 'Yes' : '' },
  waiting_since:{ label: 'Waiting',     get: (m) => m.waiting_since ? String(m.waiting_since).slice(0, 10) : '' },
};

router.get('/:id/members/download', requirePrivilege('group_records_all', 'view'), async (req, res, next) => {
  try {
    const { format = 'excel', ids = '', fields = '' } = req.query;
    const slug = req.user.tenantSlug;
    const groupId = req.params.id;

    const [group] = await tenantQuery(slug, `SELECT id, name FROM groups WHERE id = $1 AND type = 'group'`, [groupId]);
    if (!group) throw AppError('Group not found.', 404);

    const memberIds = ids.split(',').map((s) => s.trim()).filter(Boolean);

    const rows = await tenantQuery(slug,
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
    const safeName   = group.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const stamp      = new Date().toISOString().slice(0, 10);

    const activeCols = fields.split(',').map((s) => s.trim()).filter((f) => f && GROUP_MEMBER_FIELD_DEFS[f]);
    const cols = activeCols.length ? activeCols : Object.keys(GROUP_MEMBER_FIELD_DEFS);

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Group Members');
      ws.columns = cols.map((f) => ({ header: GROUP_MEMBER_FIELD_DEFS[f].label, width: 20 }));
      ws.getRow(1).font = { bold: true };
      for (const m of rows) ws.addRow(cols.map((f) => GROUP_MEMBER_FIELD_DEFS[f].get(m)));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${tenantPart}_${safeName}_members_${stamp}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    if (format === 'pdf') {
      const PAGE_W = 841.89; const PAGE_H = 595.28;
      const MARGIN = 36; const FONT_SZ = 7; const ROW_H = 13;
      const usableW = PAGE_W - MARGIN * 2;
      const title = `${group.name} — Members — ${stamp}`;

      // Check if any member has a photo — if so, use photo-aware layout
      const hasAnyPhoto = rows.some((m) => m.photo_data && m.photo_mime_type);

      const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape', autoFirstPage: true });
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
              doc.image(photoBuf, MARGIN, y, { width: PHOTO_SIZE, height: PHOTO_SIZE, fit: [PHOTO_SIZE, PHOTO_SIZE] });
            } catch { /* skip photo */ }
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
          doc.moveTo(MARGIN, y + PHOTO_ROW_H - 3).lineTo(PAGE_W - MARGIN, y + PHOTO_ROW_H - 3).strokeColor('#dddddd').stroke();
          y += PHOTO_ROW_H;
        }
      } else {
        // Standard tabular layout (no photos)
        const colW = usableW / cols.length;

        function drawHeader(hy) {
          doc.font('Helvetica-Bold').fontSize(FONT_SZ);
          cols.forEach((f, idx) => {
            doc.text(GROUP_MEMBER_FIELD_DEFS[f].label, MARGIN + idx * colW, hy, { width: colW - 3, lineBreak: false, ellipsis: true });
          });
          return hy + ROW_H;
        }

        y = drawHeader(y);
        doc.moveTo(MARGIN, y - 2).lineTo(PAGE_W - MARGIN, y - 2).strokeColor('#aaaaaa').stroke();

        doc.font('Helvetica').fontSize(FONT_SZ);
        for (const m of rows) {
          if (y + ROW_H > PAGE_H - MARGIN) {
            doc.addPage({ size: 'A4', layout: 'landscape' });
            y = MARGIN + 4;
            y = drawHeader(y);
            doc.moveTo(MARGIN, y - 2).lineTo(PAGE_W - MARGIN, y - 2).strokeColor('#aaaaaa').stroke();
            doc.font('Helvetica').fontSize(FONT_SZ);
          }
          cols.forEach((f, idx) => {
            doc.text(GROUP_MEMBER_FIELD_DEFS[f].get(m), MARGIN + idx * colW, y, { width: colW - 3, lineBreak: false, ellipsis: true });
          });
          y += ROW_H;
        }
      }

      doc.end();
      await done;
      const buf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${tenantPart}_${safeName}_members_${stamp}.pdf"`);
      return res.send(buf);
    }

    throw AppError('Invalid format.', 400);
  } catch (err) { next(err); }
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

    const [group] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1 AND type = 'group'`, [req.params.id]);
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

// ─── POST /groups/:id/members/bulk ───────────────────────────────────────
// Bulk-add multiple members to a group (from Members list "Add to group").
// Respects max-members / waiting-list logic per member.

const bulkAddMembersSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1),
});

router.post('/:id/members/bulk', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { memberIds } = bulkAddMembersSchema.parse(req.body);

    const [group] = await tenantQuery(slug, `SELECT id, max_members, enable_waiting_list FROM groups WHERE id = $1 AND type = 'group'`, [req.params.id]);
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
      if (existing) { skipped++; continue; }

      // Determine whether to add to waiting list
      const addToWaiting = group.enable_waiting_list &&
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

// ─── DELETE /groups/:id/members/bulk ──────────────────────────────────────
// Bulk-remove multiple members from a group.
// NOTE: Must be registered before /:memberId to avoid Express treating "bulk" as a param.

const bulkRemoveSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
});

router.delete('/:id/members/bulk', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { memberIds } = bulkRemoveSchema.parse(req.body);

    const [group] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1 AND type = 'group'`, [req.params.id]);
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
});

// ─── POST /groups/:id/members/bulk-add ───────────────────────────────────
// Add multiple members to another group (from the current group's member list).
// NOTE: Must be registered before the POST /:id/members route.

const bulkAddSchema = z.object({
  memberIds:    z.array(z.string().uuid()).min(1),
  targetGroupId: z.string().uuid(),
});

router.post('/:id/members/bulk-add', requirePrivilege('group_records_all', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { memberIds, targetGroupId } = bulkAddSchema.parse(req.body);

    const [targetGroup] = await tenantQuery(slug, `SELECT id, max_members, enable_waiting_list FROM groups WHERE id = $1 AND type = 'group'`, [targetGroupId]);
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
    let capacity = targetGroup.max_members !== null ? targetGroup.max_members - joinedCount : Infinity;

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
    const [group] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1 AND type = 'group'`, [req.params.id]);
    if (!group) throw AppError('Group not found.', 404);

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.venue_id, v.name AS venue_name,
              ge.topic, ge.contact, ge.details, ge.is_private,
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
  topic:      z.string().nullable().optional(),
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
    const [group] = await tenantQuery(slug, `SELECT id FROM groups WHERE id = $1 AND type = 'group'`, [req.params.id]);
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
           (group_id, event_date, start_time, end_time, venue_id, topic, contact, details, is_private)
         VALUES ($1,$2::date,$3::time,$4::time,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          req.params.id,
          date,
          data.startTime  ?? null,
          data.endTime    ?? null,
          data.venueId    ?? null,
          data.topic      ?? null,
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
  topic:      z.string().nullable().optional(),
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
  ['topic',     'topic'],
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

// ─── Group Ledger (doc 5.5) ────────────────────────────────────────────────
// Access: group_ledger_all:* (any group) OR group_ledger_as_leader:* (own groups only).
// requireAuth is already applied to all routes via router.use() at the top.

async function hasLedgerAccess(req, groupId, action) {
  const { userId, tenantSlug, privileges } = req.user;
  if (privileges.includes(`group_ledger_all:${action}`)) return true;
  if (privileges.includes(`group_ledger_as_leader:${action}`)) {
    const rows = await tenantQuery(
      tenantSlug,
      `SELECT 1 FROM users u
       JOIN members m ON m.id = u.member_id
       JOIN group_members gm ON gm.member_id = m.id
       WHERE u.id = $1 AND gm.group_id = $2 AND gm.is_leader = true`,
      [userId, groupId],
    );
    return rows.length > 0;
  }
  return false;
}

const ledgerEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payee:     z.string().max(200).nullable().optional(),
  detail:    z.string().max(500).nullable().optional(),
  moneyIn:   z.number().nonnegative().nullable().optional(),
  moneyOut:  z.number().nonnegative().nullable().optional(),
});

// GET /groups/:id/ledger?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns { broughtForward, entries }
router.get('/:id/ledger', async (req, res, next) => {
  try {
    const groupId = req.params.id;
    if (!await hasLedgerAccess(req, groupId, 'view')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const slug = req.user.tenantSlug;

    const year = new Date().getFullYear();
    const from = req.query.from || `${year}-01-01`;
    const to   = req.query.to   || `${year}-12-31`;

    // "Brought forward": net balance of all entries BEFORE the from date
    const bfRows = await tenantQuery(
      slug,
      `SELECT COALESCE(SUM(money_in),0) - COALESCE(SUM(money_out),0) AS bf
       FROM group_ledger_entries
       WHERE group_id = $1 AND entry_date < $2::date`,
      [groupId, from],
    );
    const broughtForward = parseFloat(bfRows[0]?.bf ?? 0);

    // Entries within the date range, ordered by date then created_at
    const entries = await tenantQuery(
      slug,
      `SELECT id, entry_date, payee, detail, money_in, money_out, created_at
       FROM group_ledger_entries
       WHERE group_id = $1 AND entry_date >= $2::date AND entry_date <= $3::date
       ORDER BY entry_date, created_at`,
      [groupId, from, to],
    );

    res.json({ broughtForward, entries });
  } catch (err) {
    next(err);
  }
});

// POST /groups/:id/ledger
router.post('/:id/ledger', async (req, res, next) => {
  try {
    const groupId = req.params.id;
    if (!await hasLedgerAccess(req, groupId, 'create')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const data = ledgerEntrySchema.parse(req.body);
    const slug = req.user.tenantSlug;

    const [entry] = await tenantQuery(
      slug,
      `INSERT INTO group_ledger_entries (group_id, entry_date, payee, detail, money_in, money_out)
       VALUES ($1, $2::date, $3, $4, $5::numeric, $6::numeric)
       RETURNING *`,
      [groupId, data.entryDate, data.payee ?? null, data.detail ?? null,
       data.moneyIn ?? null, data.moneyOut ?? null],
    );
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// PATCH /groups/:id/ledger/:entryId
router.patch('/:id/ledger/:entryId', async (req, res, next) => {
  try {
    const { id: groupId, entryId } = req.params;
    if (!await hasLedgerAccess(req, groupId, 'change')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const data = ledgerEntrySchema.partial().parse(req.body);
    const slug = req.user.tenantSlug;

    const fields = [];
    const vals   = [];
    let pi = 1;
    if (data.entryDate !== undefined) { fields.push(`entry_date = $${pi++}::date`); vals.push(data.entryDate); }
    if (data.payee     !== undefined) { fields.push(`payee      = $${pi++}`);       vals.push(data.payee ?? null); }
    if (data.detail    !== undefined) { fields.push(`detail     = $${pi++}`);       vals.push(data.detail ?? null); }
    if (data.moneyIn   !== undefined) { fields.push(`money_in   = $${pi++}::numeric`); vals.push(data.moneyIn ?? null); }
    if (data.moneyOut  !== undefined) { fields.push(`money_out  = $${pi++}::numeric`); vals.push(data.moneyOut ?? null); }
    if (fields.length === 0) return res.json({});

    fields.push(`updated_at = now()`);
    const [updated] = await tenantQuery(
      slug,
      `UPDATE group_ledger_entries SET ${fields.join(', ')}
       WHERE id = $${pi++} AND group_id = $${pi++}
       RETURNING *`,
      [...vals, entryId, groupId],
    );
    if (!updated) return res.status(404).json({ error: 'Entry not found.' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /groups/:id/ledger/download  – Excel download
router.get('/:id/ledger/download', async (req, res, next) => {
  try {
    const groupId = req.params.id;
    if (!await hasLedgerAccess(req, groupId, 'download')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const slug = req.user.tenantSlug;
    const { from, to } = req.query;

    const conditions = ['gle.group_id = $1'];
    const params = [groupId];
    let pi = 2;
    if (from) { conditions.push(`gle.entry_date >= $${pi++}::date`); params.push(from); }
    if (to)   { conditions.push(`gle.entry_date <= $${pi++}::date`); params.push(to); }

    const [[groupRow], entries] = await Promise.all([
      tenantQuery(slug, `SELECT name FROM groups WHERE id = $1 AND type = 'group'`, [groupId]),
      tenantQuery(slug,
        `SELECT gle.entry_date, gle.payee, gle.detail, gle.money_in, gle.money_out
         FROM group_ledger_entries gle
         WHERE ${conditions.join(' AND ')}
         ORDER BY gle.entry_date, gle.created_at`,
        params,
      ),
    ]);

    const groupName = groupRow?.name ?? 'Group';
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Group Ledger');
    ws.columns = [
      { header: 'Date',    key: 'date',      width: 14 },
      { header: 'Payee',   key: 'payee',     width: 24 },
      { header: 'Detail',  key: 'detail',    width: 36 },
      { header: 'In (£)',  key: 'money_in',  width: 12 },
      { header: 'Out (£)', key: 'money_out', width: 12 },
      { header: 'Balance', key: 'balance',   width: 12 },
    ];
    let balance = 0;
    for (const e of entries) {
      const inn  = parseFloat(e.money_in)  || 0;
      const out  = parseFloat(e.money_out) || 0;
      balance += inn - out;
      ws.addRow({
        date:      e.entry_date ? String(e.entry_date).slice(0, 10) : '',
        payee:     e.payee     ?? '',
        detail:    e.detail    ?? '',
        money_in:  e.money_in  != null ? parseFloat(e.money_in)  : null,
        money_out: e.money_out != null ? parseFloat(e.money_out) : null,
        balance:   parseFloat(balance.toFixed(2)),
      });
    }

    const tenantPart = req.user.tenantSlug.replace(/^u3a_/, '');
    const safeName   = groupName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr    = new Date().toISOString().slice(0, 10);
    const filename   = `${tenantPart}_${safeName}_ledger_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// DELETE /groups/:id/ledger/:entryId
router.delete('/:id/ledger/:entryId', async (req, res, next) => {
  try {
    const { id: groupId, entryId } = req.params;
    if (!await hasLedgerAccess(req, groupId, 'delete')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const slug = req.user.tenantSlug;
    await tenantQuery(
      slug,
      `DELETE FROM group_ledger_entries WHERE id = $1 AND group_id = $2`,
      [entryId, groupId],
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
