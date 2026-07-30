// beacon2026/backend/src/routes/teams/list.js
// Team listing and list-level downloads (Excel/PDF). Guarded by the
// `groups_list` privilege resource (teams share group privileges).

import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery } from '../../utils/db.js';
import { sanitizeCell } from '../../utils/spreadsheet.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

// ─── GET /teams ───────────────────────────────────────────────────────────
router.get('/', requirePrivilege('groups_list', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { activeOnly = 'true', letter } = req.query;

    const conditions = [`g.type = 'team'`];
    const params = [];
    let i = 1;

    if (activeOnly !== 'false') {
      conditions.push(`g.status = 'active'`);
    }
    if (letter && /^[A-Z]$/i.test(letter)) {
      conditions.push(`upper(g.name) LIKE $${i++}`);
      params.push(letter.toUpperCase() + '%');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const teams = await tenantQuery(
      slug,
      `SELECT g.id, g.name, g.short_name, g.status, g.show_addresses,
              (SELECT COUNT(*)::int FROM group_members gm
               WHERE gm.group_id = g.id) AS member_count,
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
       ${where}
       ORDER BY g.name`,
      params,
    );

    res.json(teams);
  } catch (err) {
    next(err);
  }
});

// ─── GET /teams/download ─────────────────────────────────────────────────
const TEAM_LIST_FIELD_DEFS = {
  name: { label: 'Team', get: (g) => g.name ?? '' },
  leaders: {
    label: 'Leader(s)',
    get: (g) => (g.leaders ?? []).map((l) => `${l.forenames} ${l.surname}`).join(', '),
  },
  member_count: { label: 'Members', get: (g) => g.member_count ?? 0 },
  status: { label: 'Status', get: (g) => g.status ?? '' },
  information: { label: 'Information', get: (g) => g.information ?? '' },
};

router.get('/download', requirePrivilege('groups_list', 'download'), async (req, res, next) => {
  try {
    const { format = 'excel', ids = '', fields = '' } = req.query;
    const slug = req.user.tenantSlug;

    const teamIds = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (teamIds.length === 0) throw AppError('No teams selected.', 400);

    const rows = await tenantQuery(
      slug,
      `SELECT g.id, g.name, g.short_name, g.status, g.information,
              (SELECT COUNT(*)::int FROM group_members gm
               WHERE gm.group_id = g.id) AS member_count,
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
       WHERE g.id = ANY($1::text[]) AND g.type = 'team'
       ORDER BY g.name`,
      [teamIds],
    );

    const activeCols = fields
      .split(',')
      .map((s) => s.trim())
      .filter((f) => f && TEAM_LIST_FIELD_DEFS[f]);
    const cols = activeCols.length ? activeCols : Object.keys(TEAM_LIST_FIELD_DEFS);

    const tenantPart = slug.replace(/^u3a_/, '');
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Teams');
      ws.columns = cols.map((f) => ({ header: TEAM_LIST_FIELD_DEFS[f].label, width: 22 }));
      ws.getRow(1).font = { bold: true };
      for (const g of rows)
        ws.addRow(cols.map((f) => sanitizeCell(TEAM_LIST_FIELD_DEFS[f].get(g))));
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${tenantPart}_teams_${stamp}.xlsx"`,
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
      const title = `Teams — ${stamp}`;

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
          doc.text(TEAM_LIST_FIELD_DEFS[f].label, MARGIN + idx * colW, hy, {
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
          const val = TEAM_LIST_FIELD_DEFS[f].get(g);
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
        `attachment; filename="${tenantPart}_teams_${stamp}.pdf"`,
      );
      return res.send(buf);
    }

    throw AppError('Invalid format.', 400);
  } catch (err) {
    next(err);
  }
});

export default router;
