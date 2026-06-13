// beacon2/backend/src/routes/calendar/events.js
// Calendar read side — the aggregated view of all group_events (including open
// meetings), PDF/Excel exports, member/event-type lookups for the calendar UI,
// event search, single-event lookup, and event financials. Guarded by the
// `calendar` privilege resource (financials use `event_finance`).

import { Router } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { tenantQuery, escapeLike } from '../../utils/db.js';
import { sanitizeCell } from '../../utils/spreadsheet.js';
import { AppError } from '../../middleware/errorHandler.js';
import { buildCalendarEventFilters } from '../../utils/eventFilters.js';
import { fmtDateUK, fmtTime } from './helpers.js';

const router = Router();

// Event-search (TransactionEditor event selector) result paging.
const EVENT_SEARCH_DEFAULT_LIMIT = 20;
const EVENT_SEARCH_MAX_LIMIT = 50;

// ─── GET /calendar/events ─────────────────────────────────────────────────────
// Returns all events across all groups + open meetings within a date range.
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&memberId=...&venueId=...&groupId=...
//        &eventTypeId=... (filter to a specific event type)

router.get('/events', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { where, params } = buildCalendarEventFilters(req.query);

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, g.name AS group_name, g.type AS group_type,
              ge.event_type_id, et.name AS event_type_name,
              ge.venue_id, v.name AS venue_name, v.postcode AS venue_postcode,
              ge.topic, ge.contact, ge.details, ge.is_private
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params,
    );
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/events/pdf ─────────────────────────────────────────────────
// Same filters as GET /events, but returns a PDF download.

router.get('/events/pdf', requirePrivilege('calendar', 'download'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { from, to } = req.query; // retained for the PDF title label
    const { where, params } = buildCalendarEventFilters(req.query);

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, g.name AS group_name,
              ge.event_type_id, et.name AS event_type_name,
              ge.venue_id, v.name AS venue_name,
              ge.topic, ge.contact, ge.details
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params,
    );

    // Build PDF
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      autoFirstPage: true,
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const fromLabel = from || '?';
    const toLabel = to || '?';
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(`Calendar ${fmtDateUK(fromLabel)} to ${fmtDateUK(toLabel)}`, { align: 'center' });
    doc.moveDown(0.5);

    // Table header
    const cols = [
      { label: 'Date & Time', x: 40, w: 130 },
      { label: 'Until', x: 170, w: 50 },
      { label: 'Group', x: 220, w: 120 },
      { label: 'Venue', x: 340, w: 120 },
      { label: 'Topic', x: 460, w: 180 },
      { label: 'Enquiries', x: 640, w: 160 },
    ];

    function drawHeader(y) {
      doc.font('Helvetica-Bold').fontSize(8);
      for (const col of cols) {
        doc.text(col.label, col.x, y, { width: col.w, ellipsis: true });
      }
      doc
        .moveTo(40, y + 12)
        .lineTo(800, y + 12)
        .lineWidth(0.5)
        .stroke();
      return y + 16;
    }

    let y = drawHeader(doc.y);

    doc.font('Helvetica').fontSize(8);
    for (const ev of events) {
      if (y > 540) {
        doc.addPage();
        y = drawHeader(40);
        doc.font('Helvetica').fontSize(8);
      }

      const dateStr =
        fmtDateUK(ev.event_date) + (ev.start_time ? ' ' + fmtTime(ev.start_time) : '');
      const endStr = fmtTime(ev.end_time);
      const group = ev.group_name || ev.event_type_name || 'Open Meeting';
      const venue = ev.venue_name || '';
      const topic = ev.topic || '';
      const contact = ev.contact || '';

      doc.text(dateStr, cols[0].x, y, { width: cols[0].w, ellipsis: true });
      doc.text(endStr, cols[1].x, y, { width: cols[1].w, ellipsis: true });
      doc.text(group, cols[2].x, y, { width: cols[2].w, ellipsis: true });
      doc.text(venue, cols[3].x, y, { width: cols[3].w, ellipsis: true });
      doc.text(topic, cols[4].x, y, { width: cols[4].w, ellipsis: true });
      doc.text(contact, cols[5].x, y, { width: cols[5].w, ellipsis: true });

      y += 14;
    }

    doc.end();
    await new Promise((resolve) => doc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);
    const tenantPart = slug.replace(/^u3a_/, '');
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${tenantPart}_calendar_${stamp}.pdf"`,
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/events/excel ───────────────────────────────────────────────
// Same filters as GET /events, but returns an Excel (.xlsx) download.

router.get('/events/excel', requirePrivilege('calendar', 'download'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { from, to } = req.query; // retained for the worksheet title label
    const { where, params } = buildCalendarEventFilters(req.query);

    const events = await tenantQuery(
      slug,
      `SELECT ge.event_date, ge.start_time, ge.end_time,
              g.name AS group_name, et.name AS event_type_name,
              v.name AS venue_name, v.postcode AS venue_postcode,
              ge.topic, ge.contact, ge.details
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params,
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Events');

    ws.addRow([`Events ${fmtDateUK(from || '?')} to ${fmtDateUK(to || '?')}`]).font = {
      bold: true,
      size: 14,
    };
    ws.addRow([]);

    const header = ws.addRow([
      'Date',
      'Start',
      'End',
      'Group / Type',
      'Topic',
      'Venue',
      'Postcode',
      'Contact',
      'Details',
    ]);
    header.font = { bold: true };

    for (const ev of events) {
      ws.addRow([
        fmtDateUK(ev.event_date),
        fmtTime(ev.start_time),
        fmtTime(ev.end_time),
        sanitizeCell(ev.group_name || ev.event_type_name || ''),
        sanitizeCell(ev.topic || ''),
        sanitizeCell(ev.venue_name || ''),
        sanitizeCell(ev.venue_postcode || ''),
        sanitizeCell(ev.contact || ''),
        sanitizeCell(ev.details || ''),
      ]);
    }

    ws.columns.forEach((col) => {
      col.width = Math.max(
        10,
        (col.values || []).reduce((m, v) => Math.max(m, String(v ?? '').length + 2), 0),
      );
    });

    const tenantPart = slug.replace(/^u3a_/, '');
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${tenantPart}_events_${stamp}.xlsx"`,
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/members/search ─────────────────────────────────────────────
// Search members by name for the calendar member filter.
// Query: ?q=search_term

router.get('/members/search', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const members = await tenantQuery(
      slug,
      `SELECT id, member_no, first_name, last_name
       FROM members
       WHERE (first_name || ' ' || last_name) ILIKE '%' || $1 || '%'
          OR last_name ILIKE $1 || '%'
       ORDER BY last_name, first_name
       LIMIT 20`,
      [escapeLike(q)],
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/event-types ────────────────────────────────────────────────
// Returns all event types for the calendar UI dropdown (requires calendar:view).

router.get('/event-types', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, description, is_default FROM event_types ORDER BY is_default DESC, name`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENT SEARCH  (for TransactionEditor event selector)
// Defined before GET /events/:eventId so the literal `search` segment is not
// captured by the :eventId param.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/events/search', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const q = String(req.query.q || '').trim();
    const limit = Math.min(
      parseInt(req.query.limit, 10) || EVENT_SEARCH_DEFAULT_LIMIT,
      EVENT_SEARCH_MAX_LIMIT,
    );
    if (q.length < 2) return res.json([]);

    const rows = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time,
              ge.group_id, g.name AS group_name,
              ge.event_type_id, et.name AS event_type_name,
              ge.topic
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       WHERE ge.topic ILIKE '%' || $1 || '%'
          OR g.name ILIKE '%' || $1 || '%'
          OR ge.event_date::text ILIKE '%' || $1 || '%'
       ORDER BY ge.event_date DESC
       LIMIT $2`,
      [q, limit],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE EVENT  (for EventRecord page)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/events/:eventId', requirePrivilege('calendar', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [ev] = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, g.name AS group_name, g.type AS group_type,
              ge.event_type_id, et.name AS event_type_name,
              ge.venue_id, v.name AS venue_name, v.postcode AS venue_postcode,
              ge.topic, ge.contact, ge.details, ge.is_private,
              ge.created_at, ge.updated_at,
              (SELECT COUNT(*) FROM event_members em WHERE em.event_id = ge.id)::int AS member_count
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       WHERE ge.id = $1`,
      [req.params.eventId],
    );
    if (!ev) throw AppError('Event not found.', 404);
    res.json(ev);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENT FINANCIALS  (summary of transactions linked to an event)
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/events/:eventId/financials',
  requirePrivilege('event_finance', 'view'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { eventId } = req.params;

      const transactions = await tenantQuery(
        slug,
        `SELECT t.id, t.transaction_number, t.date, t.type, t.from_to, t.amount,
              t.payment_method, t.detail, t.remarks,
              a.name AS account_name
       FROM transactions t
       JOIN finance_accounts a ON a.id = t.account_id
       WHERE t.event_id = $1
       ORDER BY t.date, t.transaction_number`,
        [eventId],
      );

      const income = transactions.filter((t) => t.type === 'in');
      const costs = transactions.filter((t) => t.type === 'out');
      const totalIncome = income.reduce((s, t) => s + parseFloat(t.amount), 0);
      const totalCosts = costs.reduce((s, t) => s + parseFloat(t.amount), 0);

      const [countRow] = await tenantQuery(
        slug,
        `SELECT COUNT(*)::int AS count FROM event_members WHERE event_id = $1`,
        [eventId],
      );

      res.json({
        income,
        costs,
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalCosts: Math.round(totalCosts * 100) / 100,
        netBalance: Math.round((totalIncome - totalCosts) * 100) / 100,
        attendeeCount: countRow?.count || 0,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
