// beacon2026/backend/src/routes/portal/calendar.js
// Members Portal — Calendar (doc 10.2.3): view upcoming events and download a
// PDF of the calendar.

import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { tenantQuery, prisma } from '../../utils/db.js';
import { buildPortalCalendarFilters } from '../../utils/eventFilters.js';
import { fmtDateUK, fmtTime } from './helpers.js';

const router = Router({ mergeParams: true });

router.get('/calendar', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [settings] = await tenantQuery(
      slug,
      `SELECT portal_config, calendar_config
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    const portalConfig = { calendar: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.calendar) {
      return res
        .status(403)
        .json({ error: 'Calendar viewing is not enabled for this organisation.' });
    }

    const calConfig = {
      venue: { members: false },
      topic: { members: false },
      enquiries: { members: false },
      detail: { members: false },
      download: { members: false },
      ...(settings?.calendar_config ?? {}),
    };

    const { where, params } = buildPortalCalendarFilters(req.query, memberId);

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, g.name AS group_name,
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

    // Filter fields based on calendarConfig
    const result = events.map((ev) => ({
      id: ev.id,
      eventDate: ev.event_date,
      startTime: ev.start_time,
      endTime: ev.end_time,
      groupId: ev.group_id,
      groupName: ev.group_name || ev.event_type_name || 'Open Meeting',
      eventTypeId: ev.event_type_id,
      eventTypeName: ev.event_type_name,
      ...(calConfig.venue?.members && {
        venue: ev.venue_name || null,
        venuePostcode: ev.venue_postcode || null,
      }),
      ...(calConfig.topic?.members && { topic: ev.topic || null }),
      ...(calConfig.enquiries?.members && { contact: ev.contact || null }),
      ...(calConfig.detail?.members && { details: ev.details || null }),
    }));

    // Also return groups list for filter dropdown
    const groups = await tenantQuery(
      slug,
      `SELECT DISTINCT g.id, g.name
       FROM groups g
       WHERE g.status = 'active'
       ORDER BY g.name`,
    );

    // Also return event types for the "Other" filter
    const eventTypes = await tenantQuery(
      slug,
      `SELECT id, name FROM event_types ORDER BY is_default DESC, name`,
    );

    res.json({
      events: result,
      groups,
      eventTypes,
      canDownload: calConfig.download?.members ?? false,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /calendar/pdf ───────────────────────────────────────────────────────

router.get('/calendar/pdf', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const { from, to } = req.query; // retained for the PDF title label

    const [settings] = await tenantQuery(
      slug,
      `SELECT calendar_config FROM tenant_settings WHERE id = 'singleton'`,
    );
    const calConfig = { download: { members: false }, ...(settings?.calendar_config ?? {}) };
    if (!calConfig.download?.members) {
      return res.status(403).json({ error: 'Calendar download is not enabled.' });
    }

    const { where, params } = buildPortalCalendarFilters(req.query, memberId);
    const events = await tenantQuery(
      slug,
      `SELECT ge.event_date, ge.start_time, ge.end_time,
              g.name AS group_name, et.name AS event_type_name,
              v.name AS venue_name,
              ge.topic, ge.contact, ge.details
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params,
    );

    const tenant = await prisma.sysTenant.findUnique({ where: { slug } });
    const u3aName = tenant?.name ?? slug;

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      autoFirstPage: true,
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    doc.font('Helvetica-Bold').fontSize(16).text(`${u3aName} Calendar`, { align: 'center' });
    if (from || to) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`${fmtDateUK(from)} to ${fmtDateUK(to)}`, { align: 'center' });
    }
    doc.moveDown(0.5);

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
      doc.text(dateStr, cols[0].x, y, { width: cols[0].w, ellipsis: true });
      doc.text(fmtTime(ev.end_time), cols[1].x, y, { width: cols[1].w, ellipsis: true });
      doc.text(ev.group_name || ev.event_type_name || 'Open Meeting', cols[2].x, y, {
        width: cols[2].w,
        ellipsis: true,
      });
      doc.text(ev.venue_name || '', cols[3].x, y, { width: cols[3].w, ellipsis: true });
      doc.text(ev.topic || '', cols[4].x, y, { width: cols[4].w, ellipsis: true });
      doc.text(ev.contact || '', cols[5].x, y, { width: cols[5].w, ellipsis: true });
      y += 14;
    }

    doc.end();
    await new Promise((resolve) => doc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="calendar_${stamp}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
