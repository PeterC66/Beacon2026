// beacon2026/backend/src/routes/api/ics.js
// GET /api/v1/:slug/events.ics — the public calendar as a subscribable feed.
//
// Phase 2 of docs/API-design.md. Unlike every other route here this one has no
// client to write and no integration to maintain: a member pastes the URL into
// Google, Apple or Outlook Calendar and their u3a's programme stays current by
// itself.
//
// Field visibility is exactly that of GET /events — the same `calendar_config`
// toggles, all of which default to not-public. Anything not ticked simply does
// not appear in the VEVENT, so a u3a cannot publish more through the feed than
// through its own calendar page.

import { Router } from 'express';
import { z } from 'zod';
import { tenantQuery } from '../../utils/db.js';
import { requireFeatures, visibility, visible, MAX_AGE_SECONDS } from './helpers.js';

const router = Router();

// ─── Feed shape ───────────────────────────────────────────────────────────
// A subscription feed is fetched whole, repeatedly, forever, so it needs a
// bound that /events does not: `?limit=` makes no sense when the client is a
// calendar application. The window below is that bound, and it is part of the
// published contract — see docs/API-design.md.

/** How far back the feed reaches. Roughly two terms of history. */
const PAST_WINDOW_DAYS = 180;

/** Hard ceiling on VEVENTs, so one busy u3a cannot serve a huge file. */
const MAX_EVENTS = 5000;

/** Advisory poll interval for clients that honour it. */
const REFRESH_INTERVAL = 'PT12H';

/** u3as are UK organisations and event times are local wall-clock times. */
const TZID = 'Europe/London';

const filterSchema = z.object({
  group: z.string().max(64).optional(),
});

// ─── RFC 5545 serialisation ───────────────────────────────────────────────

/**
 * Escape a TEXT value: backslash first (or it would double-escape the escapes
 * added after it), then the separators, then newlines, then the control
 * characters iCalendar has no representation for at all.
 */
function escapeText(value) {
  return (
    String(value)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n')
      // Control characters have no iCalendar representation at all; real line
      // breaks have already become the literal \n above.
      .replace(/\p{Cc}/gu, '')
  );
}

/**
 * Fold a content line to 75 **octets**, continuing with CRLF + one space.
 *
 * The limit is in octets, not characters, so this works on the UTF-8 bytes and
 * backs off a split that would land inside a multi-byte character — a group
 * name with an accent or a dash would otherwise be cut in half and arrive as
 * mojibake in the subscriber's calendar.
 */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end > start + 1 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // continuation lines spend one octet on the leading space
  }
  return parts.join('\r\n ');
}

/** '2026-09-01' → '20260901'. */
function icsDate(value) {
  return String(value).slice(0, 10).replace(/-/g, '');
}

/** '14:30:00' → '143000'. Tolerates '14:30' and fractional seconds. */
function icsTime(value) {
  const [h = '0', m = '0', s = '0'] = String(value).split(':');
  return `${h.padStart(2, '0')}${m.padStart(2, '0')}${s.slice(0, 2).padStart(2, '0')}`;
}

/** '20260901' → '20260902', for the exclusive DTEND of an all-day event. */
function nextDay(compact) {
  const y = Number(compact.slice(0, 4));
  const m = Number(compact.slice(4, 6));
  const d = Number(compact.slice(6, 8));
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Europe/London, spelled out so timed events land on the right hour whatever
 * the subscriber's own timezone. Emitting floating times instead would look
 * correct in Britain and be an hour out for a member reading their calendar
 * from Spain; emitting UTC would lose the summer-time transition entirely.
 */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T010000',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0100',
  'TZNAME:BST',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'DTSTART:19701025T020000',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0000',
  'TZNAME:GMT',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/**
 * One VEVENT.
 *
 * `UID` is derived from the event id and the u3a slug, and never changes, so a
 * subscriber's calendar updates an event in place rather than accumulating a
 * fresh copy on every poll. `DTSTAMP` comes from the row's `updated_at` rather
 * than from the clock, which keeps the whole feed byte-identical between polls
 * and lets the `ETag` do its job.
 */
function eventLines(ev, cfg, slug) {
  const date = icsDate(ev.event_date);
  const stamp = ev.stamp || `${date}T000000Z`;

  const lines = ['BEGIN:VEVENT', `UID:${ev.id}@${slug}.beacon2026`, `DTSTAMP:${stamp}`];

  if (ev.start_time) {
    const from = icsTime(ev.start_time);
    lines.push(`DTSTART;TZID=${TZID}:${date}T${from}`);
    // A DTEND at or before DTSTART is invalid, and some clients reject the
    // whole calendar rather than the one event. Omitting it is legal.
    if (ev.end_time && icsTime(ev.end_time) > from) {
      lines.push(`DTEND;TZID=${TZID}:${date}T${icsTime(ev.end_time)}`);
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${date}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(date)}`);
  }

  const name = ev.group_name || ev.event_type_name || 'Open Meeting';
  const topic = visible(cfg, 'topic') ? ev.topic : null;
  lines.push(`SUMMARY:${escapeText(topic ? `${name}: ${topic}` : name)}`);

  if (visible(cfg, 'venue')) {
    const where = [ev.venue_name, ev.venue_postcode].filter(Boolean).join(', ');
    if (where) lines.push(`LOCATION:${escapeText(where)}`);
  }

  const description = [];
  if (visible(cfg, 'detail') && ev.details) description.push(ev.details);
  if (visible(cfg, 'enquiries') && ev.contact) description.push(`Enquiries: ${ev.contact}`);
  if (description.length) lines.push(`DESCRIPTION:${escapeText(description.join('\n\n'))}`);

  lines.push(`LAST-MODIFIED:${stamp}`);
  lines.push('END:VEVENT');
  return lines;
}

/** Wrap the events in a VCALENDAR and serialise, folded, CRLF-terminated. */
function buildCalendar(rows, cfg, { slug, calendarName }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//beacon2026//Public read API v1//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${escapeText(calendarName)}`,
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${TZID}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`,
    `X-PUBLISHED-TTL:${REFRESH_INTERVAL}`,
    ...VTIMEZONE,
    ...rows.flatMap((ev) => eventLines(ev, cfg, slug)),
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// ─── GET /:slug/events.ics ────────────────────────────────────────────────

const SELECT_EVENT = `
  SELECT ge.id,
         ge.event_date::text AS event_date,
         ge.start_time::text AS start_time,
         ge.end_time::text   AS end_time,
         g.name  AS group_name,
         et.name AS event_type_name,
         v.name AS venue_name, v.postcode AS venue_postcode,
         ge.topic, ge.contact, ge.details,
         to_char(ge.updated_at AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') AS stamp
  FROM group_events ge
  LEFT JOIN groups g       ON g.id  = ge.group_id
  LEFT JOIN venues v       ON v.id  = ge.venue_id
  LEFT JOIN event_types et ON et.id = ge.event_type_id`;

router.get('/:slug/events.ics', async (req, res, next) => {
  try {
    if (!(await requireFeatures(req, res, ['events']))) return;
    const { group } = filterSchema.parse(req.query);
    const cfg = (await visibility(req)).calendar;

    const since = new Date(Date.now() - PAST_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
    const params = [since];
    let whereSQL = `WHERE ge.is_private IS NOT TRUE AND ge.event_date >= $1::date`;
    if (group) {
      params.push(group);
      whereSQL += ` AND ge.group_id = $${params.length}`;
    }

    const rows = await tenantQuery(
      req.tenantSlug,
      `${SELECT_EVENT} ${whereSQL}
       ORDER BY ge.event_date, ge.start_time, g.name
       LIMIT $${params.length + 1}`,
      [...params, MAX_EVENTS],
    );

    // A member subscribing to two group feeds needs to tell them apart in the
    // calendar sidebar, so a filtered feed carries the group's name.
    const u3a = req.tenant.name || req.tenantSlug;
    const groupName = group ? rows.find((r) => r.group_name)?.group_name : null;
    const calendarName = groupName ? `${u3a} — ${groupName}` : u3a;

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Cache-Control', `public, max-age=${MAX_AGE_SECONDS}`);
    res.set('Content-Disposition', `inline; filename="${req.tenantSlug}-events.ics"`);
    return res.send(buildCalendar(rows, cfg, { slug: req.tenantSlug, calendarName }));
  } catch (err) {
    next(err);
  }
});

export default router;
