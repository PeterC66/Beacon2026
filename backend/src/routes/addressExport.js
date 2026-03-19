// beacon2/backend/src/routes/addressExport.js
// Addresses Export (doc 4.8) and address labels (doc 4.8.1).
// Exports: TAM (Excel for Third Age Matters), Labels (PDF), Excel, CSV, TSV.
// Partners sharing the same address_id are combined on one row/label.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

const MM_TO_PT = 72 / 25.4;

/** Format a member's display name for labels (title + initials/forenames + surname) */
function memberName(m) {
  const first = m.known_as || m.forenames || '';
  return [m.title, first, m.surname].filter(Boolean).join(' ');
}

/** Format the combined name for an address group (1 or 2 members at same address).
 *  Two members with the same surname: "Title1 Init1 & Title2 Init2 Surname"
 *  Two members with different surnames: full names joined by " & " */
function combinedName(members) {
  if (members.length === 1) return memberName(members[0]);
  const [a, b] = members;
  if (a.surname === b.surname) {
    const initA = (a.known_as || a.forenames || '').split(/\s+/)[0] || '';
    const initB = (b.known_as || b.forenames || '').split(/\s+/)[0] || '';
    return `${[a.title, initA].filter(Boolean).join(' ')} & ${[b.title, initB].filter(Boolean).join(' ')} ${a.surname}`.trim();
  }
  return `${memberName(a)} & ${memberName(b)}`;
}

/** Build address lines from an address object. Returns array of non-empty strings. */
function addressLines(addr) {
  const lines = [];
  const line1 = [addr.house_no, addr.street].filter(Boolean).join(' ');
  if (line1) lines.push(line1);
  if (addr.add_line1) lines.push(addr.add_line1);
  if (addr.add_line2) lines.push(addr.add_line2);
  if (addr.town) lines.push(addr.town);
  if (addr.county) lines.push(addr.county);
  if (addr.postcode) lines.push(addr.postcode);
  return lines;
}

/** Group a flat member list into address groups, sorted by postcode then town */
function groupByAddress(members) {
  const map = new Map();
  for (const m of members) {
    const key = m.address_id || `no-addr-${m.id}`;
    if (!map.has(key)) {
      map.set(key, {
        address_id: m.address_id,
        house_no:   m.house_no,
        street:     m.street,
        add_line1:  m.add_line1,
        add_line2:  m.add_line2,
        town:       m.town,
        county:     m.county,
        postcode:   m.postcode,
        members:    [],
      });
    }
    map.get(key).members.push(m);
  }
  return Array.from(map.values()).sort((a, b) => {
    const pc = (a.postcode ?? '').localeCompare(b.postcode ?? '');
    if (pc !== 0) return pc;
    return (a.town ?? '').localeCompare(b.town ?? '');
  });
}

/** Build WHERE clause + params for member filters.
 *  Returns { where, params, nextIdx } */
function buildFilters(query) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (query.status) {
    const ids = query.status.split(',').filter(Boolean);
    if (ids.length) {
      conditions.push(`m.status_id = ANY($${i++}::text[])`);
      params.push(ids);
    }
  }
  if (query.classId) {
    conditions.push(`m.class_id = $${i++}`);
    params.push(query.classId);
  }
  if (query.pollId) {
    if (query.negatePoll === '1') {
      conditions.push(`m.id NOT IN (SELECT member_id FROM poll_members WHERE poll_id = $${i++})`);
    } else {
      conditions.push(`m.id IN (SELECT member_id FROM poll_members WHERE poll_id = $${i++})`);
    }
    params.push(query.pollId);
  }
  if (query.groupId) {
    conditions.push(`m.id IN (SELECT member_id FROM group_members WHERE group_id = $${i++})`);
    params.push(query.groupId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params, nextIdx: i };
}

/** Fetch members (with addresses) from DB applying filters */
async function fetchMembers(slug, query) {
  const { where, params } = buildFilters(query);
  return tenantQuery(
    slug,
    `SELECT m.id, m.title, m.forenames, m.known_as, m.surname,
            m.email, m.mobile,
            m.status_id, m.class_id, m.membership_number,
            m.address_id,
            a.house_no, a.street, a.add_line1, a.add_line2,
            a.town, a.county, a.postcode, a.telephone
     FROM members m
     LEFT JOIN addresses a ON a.id = m.address_id
     ${where}
     ORDER BY m.surname, m.forenames`,
    params,
  );
}

/** Fetch members by IDs */
async function fetchMembersById(slug, ids) {
  if (!ids.length) return [];
  return tenantQuery(
    slug,
    `SELECT m.id, m.title, m.forenames, m.known_as, m.surname,
            m.email, m.mobile,
            m.status_id, m.class_id, m.membership_number,
            m.address_id,
            a.house_no, a.street, a.add_line1, a.add_line2,
            a.town, a.county, a.postcode, a.telephone
     FROM members m
     LEFT JOIN addresses a ON a.id = m.address_id
     WHERE m.id = ANY($1::text[])
     ORDER BY m.surname, m.forenames`,
    [ids],
  );
}

// ── GET /address-export ────────────────────────────────────────────────────────
// Returns individual members with filters applied (frontend groups by address_id).
// Query params: status, classId, pollId, negatePoll, groupId

router.get('/', requirePrivilege('addresses_export', 'view'), async (req, res, next) => {
  try {
    const members = await fetchMembers(req.user.tenantSlug, req.query);
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ── GET /address-export/download ──────────────────────────────────────────────
// Download an address export in the chosen format.
// Query params: format (excel|csv|tsv|tam), ids (comma-separated member IDs)

router.get('/download', requirePrivilege('addresses_export', 'download'), async (req, res, next) => {
  try {
    const { format = 'excel', ids = '' } = req.query;
    const memberIds = ids.split(',').filter(Boolean);
    if (!memberIds.length) {
      return res.status(400).json({ error: 'No members selected.' });
    }

    const slug = req.user.tenantSlug;
    const allMembers = await fetchMembersById(slug, memberIds);
    const groups = groupByAddress(allMembers);

    const now = new Date();
    const stamp = now.toISOString().slice(0, 10);
    const slugPart = slug.replace(/^u3a_/, '').replace(/_/g, '-');

    if (format === 'csv' || format === 'tsv') {
      const sep = format === 'tsv' ? '\t' : ',';
      const headers = ['Name', 'Address 1', 'Address 2', 'Address 3', 'Address 4', 'Town', 'County', 'Postcode'];
      const rows = groups.map((g) => {
        const name = combinedName(g.members);
        const addrLine1 = [g.house_no, g.street].filter(Boolean).join(' ');
        return [name, addrLine1, g.add_line1 ?? '', g.add_line2 ?? '', g.town ?? '', g.county ?? '', g.postcode ?? '']
          .map((v) => (sep === ',' ? `"${String(v ?? '').replace(/"/g, '""')}"` : String(v ?? '')))
          .join(sep);
      });
      const content = [headers.map((h) => (sep === ',' ? `"${h}"` : h)).join(sep), ...rows].join('\r\n');
      const ext = format === 'tsv' ? 'tsv' : 'csv';
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${slugPart}_addresses_${stamp}.${ext}"`);
      return res.send(content);
    }

    if (format === 'tam') {
      // Third Age Matters: Excel format for TAM distribution
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('TAM Distribution');
      ws.columns = [
        { header: 'Title',    key: 'title',    width: 8 },
        { header: 'Initials', key: 'initials', width: 10 },
        { header: 'Surname',  key: 'surname',  width: 20 },
        { header: 'Address1', key: 'addr1',    width: 30 },
        { header: 'Address2', key: 'addr2',    width: 20 },
        { header: 'Address3', key: 'addr3',    width: 20 },
        { header: 'Town',     key: 'town',     width: 20 },
        { header: 'County',   key: 'county',   width: 15 },
        { header: 'Postcode', key: 'postcode', width: 12 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const g of groups) {
        // TAM uses one row per address, primary member's name fields
        const primary = g.members[0];
        const addrLine1 = [g.house_no, g.street].filter(Boolean).join(' ');
        ws.addRow({
          title:    primary.title ?? '',
          initials: (primary.known_as || primary.forenames || '').split(/\s+/).map((n) => n[0]).join(''),
          surname:  primary.surname ?? '',
          addr1:    addrLine1,
          addr2:    g.add_line1 ?? '',
          addr3:    g.add_line2 ?? '',
          town:     g.town ?? '',
          county:   g.county ?? '',
          postcode: g.postcode ?? '',
        });
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${slugPart}_tam_distribution_${stamp}.xlsx"`);
      const buffer = await wb.xlsx.writeBuffer();
      return res.send(buffer);
    }

    // Default: Excel
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Addresses');
    ws.columns = [
      { header: 'Name',     key: 'name',     width: 30 },
      { header: 'Address 1',key: 'addr1',    width: 30 },
      { header: 'Address 2',key: 'addr2',    width: 20 },
      { header: 'Address 3',key: 'addr3',    width: 20 },
      { header: 'Town',     key: 'town',     width: 20 },
      { header: 'County',   key: 'county',   width: 15 },
      { header: 'Postcode', key: 'postcode', width: 12 },
      { header: 'Telephone',key: 'telephone',width: 15 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FFE2EFDA' },
    };
    for (const g of groups) {
      const name = combinedName(g.members);
      const addrLine1 = [g.house_no, g.street].filter(Boolean).join(' ');
      const tel = g.telephone || '';
      ws.addRow({
        name,
        addr1:    addrLine1,
        addr2:    g.add_line1 ?? '',
        addr3:    g.add_line2 ?? '',
        town:     g.town ?? '',
        county:   g.county ?? '',
        postcode: g.postcode ?? '',
        telephone: tel ?? '',
      });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${slugPart}_addresses_${stamp}.xlsx"`);
    const buffer = await wb.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ── GET /address-export/labels ────────────────────────────────────────────────
// Generate a PDF of address labels.
// Query params:
//   ids          – comma-separated member IDs
//   cols         – labels per row (default 3)
//   rows         – rows per page (default 7)
//   labelWidth   – label width in mm (default 70)
//   labelHeight  – label height in mm (default 38)
//   topOffset    – top margin in mm (default 10)
//   leftOffset   – left margin in mm (default 7)
//   fontSize     – font size in pt (default 9)

router.get('/labels', requirePrivilege('address_labels', 'download'), async (req, res, next) => {
  try {
    const { ids = '' } = req.query;
    const memberIds = ids.split(',').filter(Boolean);
    if (!memberIds.length) {
      return res.status(400).json({ error: 'No members selected.' });
    }

    // Label layout settings
    const cols        = Math.max(1, parseInt(req.query.cols        ?? '3',  10));
    const rows        = Math.max(1, parseInt(req.query.rows        ?? '7',  10));
    const labelWidth  = parseFloat(req.query.labelWidth  ?? '70')  * MM_TO_PT;
    const labelHeight = parseFloat(req.query.labelHeight ?? '38')  * MM_TO_PT;
    const topOffset   = parseFloat(req.query.topOffset   ?? '10')  * MM_TO_PT;
    const leftOffset  = parseFloat(req.query.leftOffset  ?? '7')   * MM_TO_PT;
    const fontSize    = parseFloat(req.query.fontSize    ?? '9');
    const lineHeight  = fontSize * 1.3;

    const slug = req.user.tenantSlug;
    const allMembers = await fetchMembersById(slug, memberIds);
    const groups = groupByAddress(allMembers);

    const slugPart = slug.replace(/^u3a_/, '').replace(/_/g, '-');
    const stamp    = new Date().toISOString().slice(0, 10);

    // A4 page dimensions in points
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;

    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    doc.font('Helvetica').fontSize(fontSize);

    let col = 0;
    let row = 0;

    for (const g of groups) {
      // Start a new page when we've filled this one
      if (col === 0 && row === 0 && chunks.length > 0) {
        // Already on first page — do nothing
      }
      if (row >= rows) {
        doc.addPage({ size: 'A4', margin: 0 });
        row = 0;
        col = 0;
      }

      const x = leftOffset + col * labelWidth;
      const y = topOffset  + row * labelHeight;

      // Draw label content
      const name = combinedName(g.members);
      const lines = [name, ...addressLines(g)];

      let textY = y + 3; // small internal top padding
      for (const line of lines) {
        if (textY + lineHeight > y + labelHeight) break; // don't overflow label
        doc.text(line, x + 3, textY, { width: labelWidth - 6, ellipsis: true, lineBreak: false });
        textY += lineHeight;
      }

      // Advance to next label position
      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    }

    doc.end();

    await new Promise((resolve) => doc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${slugPart}_address_labels_${stamp}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
