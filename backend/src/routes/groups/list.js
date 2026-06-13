// beacon2/backend/src/routes/groups/list.js
// Group listing and list-level downloads (Excel/PDF). Guarded by the
// `groups_list` privilege resource.

import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { sanitizeCell } from '../../utils/spreadsheet.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

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
  name: { label: 'Group', get: (g) => g.name ?? '' },
  when_text: { label: 'When', get: (g) => g.when_text ?? '' },
  leaders: {
    label: 'Leader(s)',
    get: (g) => (g.leaders ?? []).map((l) => `${l.forenames} ${l.surname}`).join(', '),
  },
  member_count: { label: 'Members', get: (g) => g.member_count ?? 0 },
  status: { label: 'Status', get: (g) => g.status ?? '' },
  faculty_name: { label: 'Faculty', get: (g) => g.faculty_name ?? '' },
  enquiries: { label: 'Enquiries', get: (g) => g.enquiries ?? '' },
  information: { label: 'Information', get: (g) => g.information ?? '' },
};

router.get('/download', requirePrivilege('groups_list', 'download'), async (req, res, next) => {
  try {
    const { format = 'excel', ids = '', fields = '' } = req.query;
    const slug = req.user.tenantSlug;

    const groupIds = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
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

    const activeCols = fields
      .split(',')
      .map((s) => s.trim())
      .filter((f) => f && GROUP_LIST_FIELD_DEFS[f]);
    const cols = activeCols.length ? activeCols : Object.keys(GROUP_LIST_FIELD_DEFS);

    const tenantPart = slug.replace(/^u3a_/, '');
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Groups');
      ws.columns = cols.map((f) => ({ header: GROUP_LIST_FIELD_DEFS[f].label, width: 22 }));
      ws.getRow(1).font = { bold: true };
      for (const g of rows)
        ws.addRow(cols.map((f) => sanitizeCell(GROUP_LIST_FIELD_DEFS[f].get(g))));
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${tenantPart}_groups_${stamp}.xlsx"`,
      );
      await wb.xlsx.write(res);
      return res.end();
    }

    if (format === 'pdf') {
      const PAGE_W = 841.89;
      const PAGE_H = 595.28;
      const MARGIN = 36;
      const FONT_SZ = 8;
      const ROW_H = 14;
      const usableW = PAGE_W - MARGIN * 2;
      const title = `Groups — ${stamp}`;

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
      doc.font('Helvetica-Bold').fontSize(10).text(title, MARGIN, y, { lineBreak: false });
      y += 18;

      const colW = usableW / cols.length;

      function drawHeader(hy) {
        doc.font('Helvetica-Bold').fontSize(FONT_SZ);
        cols.forEach((f, idx) => {
          doc.text(GROUP_LIST_FIELD_DEFS[f].label, MARGIN + idx * colW, hy, {
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
      for (const g of rows) {
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
          const val = GROUP_LIST_FIELD_DEFS[f].get(g);
          doc.text(String(val), MARGIN + idx * colW, y, {
            width: colW - 3,
            lineBreak: false,
            ellipsis: true,
          });
        });
        y += ROW_H;
      }

      doc.end();
      await done;
      const buf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${tenantPart}_groups_${stamp}.pdf"`,
      );
      return res.send(buf);
    }

    throw AppError('Invalid format.', 400);
  } catch (err) {
    next(err);
  }
});

export default router;
