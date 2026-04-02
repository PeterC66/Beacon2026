// beacon2/backend/src/routes/membershipCards.js
// Membership Cards (doc 4.7) — download PDF cards, blank cards, Excel card data,
// mark cards as printed, and list members for card selection.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery, prisma } from '../utils/db.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

const router = Router();
router.use(requireAuth);

// ── Constants ─────────────────────────────────────────────────────────────────

const MM_TO_PT = 72 / 25.4;

// Standard business card: 85 x 54 mm (Avery C32011, C32026, C32070, C32075)
const CARD_W_MM = 85;
const CARD_H_MM = 54;
const CARD_W = CARD_W_MM * MM_TO_PT;
const CARD_H = CARD_H_MM * MM_TO_PT;

// A4 page: 210 x 297 mm → 10 cards (2 columns × 5 rows)
const COLS = 2;
const ROWS = 5;

// Centre the cards on an A4 page
const PAGE_W = 595.28; // A4 width in points
const PAGE_H = 841.89; // A4 height in points
const LEFT_MARGIN = (PAGE_W - COLS * CARD_W) / 2;
const TOP_MARGIN  = (PAGE_H - ROWS * CARD_H) / 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Display name: known_as or forenames + surname */
function memberDisplayName(m) {
  const first = m.known_as || m.forenames || '';
  return `${first} ${m.surname}`.trim();
}

/** Fetch tenant settings needed for cards (display name, card colour, year dates) */
async function getCardSettings(slug) {
  const [tenant, [s]] = await Promise.all([
    prisma.sysTenant.findUnique({ where: { slug } }),
    tenantQuery(
      slug,
      `SELECT card_colour, year_start_month, year_start_day
       FROM tenant_settings WHERE id = 'singleton'`,
    ),
  ]);
  return {
    u3aName:        tenant?.name || slug,
    cardColour:     s?.card_colour  || '#0066cc',
    yearStartMonth: s?.year_start_month ?? 1,
    yearStartDay:   s?.year_start_day   ?? 1,
  };
}

/** Calculate expiry date for a member's card.
 *  Uses next_renewal if set, otherwise the day before the next year_start date. */
function cardExpiryDate(member, settings, advanceYear) {
  let expiry;
  if (member.next_renewal) {
    expiry = new Date(member.next_renewal);
  } else {
    // Day before the next year_start_month/year_start_day
    const now = new Date();
    let year = now.getFullYear();
    let nextStart = new Date(year, settings.yearStartMonth - 1, settings.yearStartDay);
    if (nextStart <= now) {
      nextStart = new Date(year + 1, settings.yearStartMonth - 1, settings.yearStartDay);
    }
    expiry = new Date(nextStart);
    expiry.setDate(expiry.getDate() - 1);
  }
  if (advanceYear) {
    expiry.setFullYear(expiry.getFullYear() + 1);
  }
  return expiry;
}

/** Format a date as "31st May 2026" */
function formatCardDate(d) {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const day = d.getDate();
  const suffix = (day === 1 || day === 21 || day === 31) ? 'st'
               : (day === 2 || day === 22) ? 'nd'
               : (day === 3 || day === 23) ? 'rd' : 'th';
  return `${day}${suffix} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Generate Code 128 barcode PNG buffer for a membership number */
async function generateBarcode(membershipNumber) {
  const png = await bwipjs.toBuffer({
    bcid:        'code128',
    text:        String(membershipNumber),
    scale:       2,
    height:      8,
    includetext: false,
  });
  return png;
}

/** Hex colour string to {r,g,b} 0-255 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/** Draw a single membership card at position (x, y) in the PDF doc */
async function drawCard(doc, x, y, member, settings, expiryDate, barcodePng) {
  const { u3aName, cardColour } = settings;
  const rgb = hexToRgb(cardColour);

  // Card border (light grey)
  doc.save();
  doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.5).strokeColor('#cccccc').stroke();

  // ── Top section: u3a branding ──
  const pad = 8;
  const textX = x + pad;

  // "u3a" logo text
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#003366');
  doc.text('u3a', textX, y + 6, { width: CARD_W - 2 * pad });

  // u3a name
  doc.font('Helvetica').fontSize(8).fillColor('#003366');
  doc.text(u3aName, textX, y + 26, { width: CARD_W - 2 * pad });

  // "Membership valid to <date>"
  doc.font('Helvetica').fontSize(7).fillColor('#003366');
  doc.text(`Membership valid`, textX, y + 36, { width: CARD_W - 2 * pad });
  doc.text(`to ${formatCardDate(expiryDate)}`, textX, y + 44, { width: CARD_W - 2 * pad });

  // ── Member photo (top right area) ──
  const photoSize = 40;
  const photoX = x + CARD_W - photoSize - pad;
  const photoY = y + 6;
  if (member.photo_data && member.photo_mime_type) {
    try {
      const photoBuf = Buffer.from(member.photo_data, 'base64');
      doc.image(photoBuf, photoX, photoY, { width: photoSize, height: photoSize, fit: [photoSize, photoSize] });
    } catch { /* skip photo if rendering fails */ }
  }

  // ── Class name (top right area, above photo or standalone) ──
  if (member.class_name) {
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#003366');
    const classText = member.class_name.toUpperCase();
    const classY = member.photo_data ? photoY + photoSize + 2 : y + 6;
    doc.text(classText, x + CARD_W - 90, classY, { width: 82, align: 'right' });
  }

  // ── Coloured band at bottom ──
  const bandHeight = 22;
  const bandY = y + CARD_H - bandHeight;
  doc.rect(x, bandY, CARD_W, bandHeight).fill([rgb.r, rgb.g, rgb.b]);

  // ── Member name (on coloured band) ──
  // Determine text colour: white for dark backgrounds, black for light
  const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  const textCol = lum < 128 ? '#ffffff' : '#000000';
  doc.font('Helvetica-Bold').fontSize(8).fillColor(textCol);
  doc.text(memberDisplayName(member), textX, bandY + 2, {
    width: CARD_W - 2 * pad, ellipsis: true, lineBreak: false,
  });

  // ── Membership number (on coloured band) ──
  doc.font('Helvetica').fontSize(7).fillColor(textCol);
  doc.text(`Membership Number ${member.membership_number}`, textX, bandY + 12, {
    width: CARD_W - 2 * pad, ellipsis: true, lineBreak: false,
  });

  // ── Barcode (above the coloured band, right side) ──
  if (barcodePng) {
    const barcodeWidth = 70;
    const barcodeHeight = 18;
    doc.image(barcodePng, x + CARD_W - barcodeWidth - pad, bandY - barcodeHeight - 4, {
      width: barcodeWidth, height: barcodeHeight,
    });
  }

  doc.restore();
}

/** Draw a single blank membership card at position (x, y) */
function drawBlankCard(doc, x, y, settings, expiryDate) {
  const { u3aName, cardColour } = settings;
  const rgb = hexToRgb(cardColour);

  doc.save();
  doc.rect(x, y, CARD_W, CARD_H).lineWidth(0.5).strokeColor('#cccccc').stroke();

  const pad = 8;
  const textX = x + pad;

  // "u3a" logo
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#003366');
  doc.text('u3a', textX, y + 6, { width: CARD_W - 2 * pad });

  // u3a name
  doc.font('Helvetica').fontSize(8).fillColor('#003366');
  doc.text(u3aName, textX, y + 26, { width: CARD_W - 2 * pad });

  // Membership valid to
  doc.font('Helvetica').fontSize(7).fillColor('#003366');
  doc.text(`Membership valid`, textX, y + 36, { width: CARD_W - 2 * pad });
  doc.text(`to ${formatCardDate(expiryDate)}`, textX, y + 44, { width: CARD_W - 2 * pad });

  // Coloured band
  const bandHeight = 22;
  const bandY = y + CARD_H - bandHeight;
  doc.rect(x, bandY, CARD_W, bandHeight).fill([rgb.r, rgb.g, rgb.b]);

  // "Membership Number" placeholder text
  const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  const textCol = lum < 128 ? '#ffffff' : '#000000';
  doc.font('Helvetica').fontSize(7).fillColor(textCol);
  doc.text('Membership Number', textX, bandY + 12, {
    width: CARD_W - 2 * pad, ellipsis: true, lineBreak: false,
  });

  doc.restore();
}

// ── Fetch members for card page ──────────────────────────────────────────────

function buildCardFilters(query) {
  const conditions = [];
  const params = [];
  let i = 1;

  // Always filter to current members by default
  const statusNames = ['Current'];

  // Show mode
  const show = query.show || 'outstanding';

  if (show === 'outstanding' || show === 'outstanding_and_poll') {
    conditions.push('m.card_printed = false');
    conditions.push(`ms.name ILIKE ANY($${i++}::text[])`);
    params.push(statusNames.map(s => `%${s}%`));
  } else if (show === 'all') {
    conditions.push(`ms.name ILIKE ANY($${i++}::text[])`);
    params.push(statusNames.map(s => `%${s}%`));
  } else if (show === 'poll') {
    // Poll only — no outstanding filter, but still current
    conditions.push(`ms.name ILIKE ANY($${i++}::text[])`);
    params.push(statusNames.map(s => `%${s}%`));
  }

  // Poll filter
  if (query.pollId && (show === 'poll' || show === 'outstanding_and_poll')) {
    conditions.push(`m.id IN (SELECT member_id FROM poll_members WHERE poll_id = $${i++})`);
    params.push(query.pollId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

async function fetchCardMembers(slug, query) {
  const { where, params } = buildCardFilters(query);
  return tenantQuery(
    slug,
    `SELECT m.id, m.membership_number, m.title, m.forenames, m.known_as,
            m.surname, m.initials, m.suffix, m.email, m.mobile,
            m.status_id, m.class_id, m.next_renewal,
            m.card_printed, m.joined_on,
            ms.name AS status_name,
            mc.name AS class_name,
            a.house_no, a.street, a.add_line1, a.add_line2,
            a.town, a.county, a.postcode, a.telephone
     FROM members m
     LEFT JOIN member_statuses ms ON ms.id = m.status_id
     LEFT JOIN member_classes  mc ON mc.id = m.class_id
     LEFT JOIN addresses       a  ON a.id  = m.address_id
     ${where}
     ORDER BY m.surname, m.forenames`,
    params,
  );
}

async function fetchMembersById(slug, ids) {
  if (!ids.length) return [];
  return tenantQuery(
    slug,
    `SELECT m.id, m.membership_number, m.title, m.forenames, m.known_as,
            m.surname, m.initials, m.suffix, m.email, m.mobile,
            m.status_id, m.class_id, m.next_renewal,
            m.card_printed, m.joined_on,
            m.photo_data, m.photo_mime_type,
            ms.name AS status_name,
            mc.name AS class_name,
            a.house_no, a.street, a.add_line1, a.add_line2,
            a.town, a.county, a.postcode, a.telephone
     FROM members m
     LEFT JOIN member_statuses ms ON ms.id = m.status_id
     LEFT JOIN member_classes  mc ON mc.id = m.class_id
     LEFT JOIN addresses       a  ON a.id  = m.address_id
     WHERE m.id = ANY($1::text[])
     ORDER BY m.surname, m.forenames`,
    [ids],
  );
}

// ── GET /membership-cards ────────────────────────────────────────────────────
// List members for card selection.
// Query params: show (outstanding|poll|outstanding_and_poll|all), pollId

router.get('/', requirePrivilege('membership_cards', 'view'), async (req, res, next) => {
  try {
    const members = await fetchCardMembers(req.user.tenantSlug, req.query);
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ── GET /membership-cards/download ───────────────────────────────────────────
// Download membership cards as PDF.
// Query params: ids (comma-separated), advanceYear (0|1)

router.get('/download', requirePrivilege('membership_cards', 'download_and_mark'), async (req, res, next) => {
  try {
    const { ids = '', advanceYear = '0' } = req.query;
    const memberIds = ids.split(',').filter(Boolean);
    if (!memberIds.length) {
      return res.status(400).json({ error: 'No members selected.' });
    }

    const slug = req.user.tenantSlug;
    const members = await fetchMembersById(slug, memberIds);
    const settings = await getCardSettings(slug);
    const advance = advanceYear === '1';

    const slugPart = slug.replace(/^u3a_/, '').replace(/_/g, '-');
    const stamp = new Date().toISOString().slice(0, 10);

    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    let col = 0;
    let row = 0;
    let pageStarted = true;

    for (const member of members) {
      if (row >= ROWS) {
        doc.addPage({ size: 'A4', margin: 0 });
        row = 0;
        col = 0;
      }

      const x = LEFT_MARGIN + col * CARD_W;
      const y = TOP_MARGIN  + row * CARD_H;

      const expiryDate = cardExpiryDate(member, settings, advance);
      let barcodePng = null;
      try {
        barcodePng = await generateBarcode(member.membership_number);
      } catch (_) { /* skip barcode if generation fails */ }

      await drawCard(doc, x, y, member, settings, expiryDate, barcodePng);

      col++;
      if (col >= COLS) {
        col = 0;
        row++;
      }
    }

    doc.end();
    await new Promise((resolve) => doc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${slugPart}_membership_cards_${stamp}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// ── GET /membership-cards/blank ──────────────────────────────────────────────
// Download a page of 10 blank membership cards as PDF.
// Query params: advanceYear (0|1)

router.get('/blank', requirePrivilege('membership_cards', 'download_and_mark'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const settings = await getCardSettings(slug);
    const advance = req.query.advanceYear === '1';

    // Compute expiry for blank cards (no member-specific renewal)
    const expiryDate = cardExpiryDate({}, settings, advance);

    const slugPart = slug.replace(/^u3a_/, '').replace(/_/g, '-');
    const stamp = new Date().toISOString().slice(0, 10);

    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = LEFT_MARGIN + col * CARD_W;
        const y = TOP_MARGIN  + row * CARD_H;
        drawBlankCard(doc, x, y, settings, expiryDate);
      }
    }

    doc.end();
    await new Promise((resolve) => doc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${slugPart}_blank_cards_${stamp}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// ── GET /membership-cards/excel ──────────────────────────────────────────────
// Download card data as Excel.
// Query params: ids (comma-separated), advanceYear (0|1)

router.get('/excel', requirePrivilege('membership_cards', 'download_and_mark'), async (req, res, next) => {
  try {
    const { ids = '', advanceYear = '0' } = req.query;
    const memberIds = ids.split(',').filter(Boolean);
    if (!memberIds.length) {
      return res.status(400).json({ error: 'No members selected.' });
    }

    const slug = req.user.tenantSlug;
    const members = await fetchMembersById(slug, memberIds);
    const settings = await getCardSettings(slug);
    const advance = advanceYear === '1';

    const slugPart = slug.replace(/^u3a_/, '').replace(/_/g, '-');
    const stamp = new Date().toISOString().slice(0, 10);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Membership Cards');

    // Title row
    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `${settings.u3aName} Membership cards data export - ${settings.u3aName} - ${stamp}`;
    titleCell.font = { bold: true };

    // Empty row 2
    // Header row 3
    ws.getRow(3).values = [
      'Membership number',
      'Familiar name / Forename',
      'Surname',
      'Valid to date',
      'Membership class',
      'Email address',
    ];
    ws.getRow(3).font = { bold: true };

    // Column widths
    ws.getColumn(1).width = 20;
    ws.getColumn(2).width = 25;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 20;
    ws.getColumn(6).width = 30;

    // Data rows
    for (const m of members) {
      const expiry = cardExpiryDate(m, settings, advance);
      ws.addRow([
        m.membership_number,
        m.known_as || m.forenames,
        m.surname,
        formatCardDate(expiry),
        m.class_name || '',
        m.email || '',
      ]);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${slugPart}_card_data_${stamp}.xlsx"`);
    const buffer = await wb.xlsx.writeBuffer();
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ── POST /membership-cards/mark-printed ──────────────────────────────────────
// Mark selected members' cards as printed.
// Body: { memberIds: string[] }

router.post('/mark-printed', requirePrivilege('membership_cards', 'download_and_mark'), async (req, res, next) => {
  try {
    const { memberIds } = req.body;
    if (!Array.isArray(memberIds) || !memberIds.length) {
      return res.status(400).json({ error: 'No member IDs provided.' });
    }

    const slug = req.user.tenantSlug;
    await tenantQuery(
      slug,
      `UPDATE members SET card_printed = true, updated_at = now()
       WHERE id = ANY($1::text[])`,
      [memberIds],
    );

    res.json({ marked: memberIds.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /membership-cards/single-pdf ─────────────────────────────────────────
// Generate a single-card PDF for one member (used for email attachments).
// Query params: memberId, advanceYear (0|1)

router.get('/single-pdf', requirePrivilege('membership_cards', 'download_and_mark'), async (req, res, next) => {
  try {
    const { memberId, advanceYear = '0' } = req.query;
    if (!memberId) {
      return res.status(400).json({ error: 'memberId is required.' });
    }

    const slug = req.user.tenantSlug;
    const advance = advanceYear === '1';

    let result;
    try {
      result = await generateSingleCardPdf(slug, memberId, advance);
    } catch (genErr) {
      if (genErr.message.includes('not found')) {
        return res.status(404).json({ error: 'Member not found.' });
      }
      throw genErr;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// ── Exported helpers for email attachment ────────────────────────────────────

/**
 * Generate a single-card PDF buffer for one member.
 * Returns { pdfBuffer: Buffer, filename: string }.
 * Throws if the member is not found.
 */
export async function generateSingleCardPdf(slug, memberId, advanceYear = false) {
  const members = await fetchMembersById(slug, [memberId]);
  if (!members.length) throw new Error(`Member ${memberId} not found`);

  const member = members[0];
  const settings = await getCardSettings(slug);
  const expiryDate = cardExpiryDate(member, settings, advanceYear);

  let barcodePng = null;
  try { barcodePng = await generateBarcode(member.membership_number); }
  catch (_) { /* skip barcode */ }

  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const x = (PAGE_W - CARD_W) / 2;
  const y = (PAGE_H - CARD_H) / 2;
  await drawCard(doc, x, y, member, settings, expiryDate, barcodePng);

  doc.end();
  await new Promise((resolve) => doc.on('end', resolve));

  const pdfBuffer = Buffer.concat(chunks);
  const filename = `${settings.u3aName} ${member.membership_number}`.replace(/\s+/g, '_') + '.pdf';
  return { pdfBuffer, filename };
}

export default router;
