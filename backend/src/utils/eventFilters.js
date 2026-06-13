// beacon2/backend/src/utils/eventFilters.js
// Shared WHERE-clause builders for calendar / group-event queries.
//
// The same filter-building block was previously duplicated verbatim across the
// three calendar events endpoints (events / events/pdf / events/excel) and the
// two portal calendar endpoints (calendar / calendar/pdf). These helpers are the
// single source of truth for that logic, and they validate the incoming query
// string with Zod so a malformed date 400s at the edge instead of 500-ing on
// the `::date` cast inside Postgres.

import { z } from 'zod';

// Treat empty-string query params (e.g. `?from=&to=`) as absent rather than
// failing validation, then enforce the YYYY-MM-DD shape on anything provided.
const optDate = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
    .optional(),
);

const optStr = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

// ── Staff calendar (routes/calendar/events.js) ──────────────────────────────
// Query: from, to, venueId, groupId, groupsOnly, eventTypeId, memberId

const calendarSchema = z.object({
  from: optDate,
  to: optDate,
  venueId: optStr,
  groupId: optStr,
  groupsOnly: optStr,
  eventTypeId: optStr,
  memberId: optStr,
});

/**
 * Build the WHERE clause + params for the staff calendar event list.
 * @param {object} query - req.query
 * @returns {{ where: string, params: any[] }}
 */
export function buildCalendarEventFilters(query) {
  const { from, to, venueId, groupId, groupsOnly, eventTypeId, memberId } =
    calendarSchema.parse(query);

  const conditions = [];
  const params = [];
  let i = 1;

  if (from) {
    conditions.push(`ge.event_date >= $${i++}::date`);
    params.push(from);
  }
  if (to) {
    conditions.push(`ge.event_date <= $${i++}::date`);
    params.push(to);
  }
  if (venueId) {
    conditions.push(`ge.venue_id = $${i++}`);
    params.push(venueId);
  }
  if (groupId) {
    conditions.push(`ge.group_id = $${i++}`);
    params.push(groupId);
  } else if (groupsOnly === 'true') {
    conditions.push(`ge.group_id IS NOT NULL`);
  }
  if (eventTypeId) {
    conditions.push(`ge.event_type_id = $${i++}`);
    params.push(eventTypeId);
  }
  if (memberId) {
    conditions.push(
      `(ge.group_id IS NULL OR ge.group_id IN (SELECT group_id FROM group_members WHERE member_id = $${i++}))`,
    );
    params.push(memberId);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return { where, params };
}

// ── Member portal calendar (routes/portal.js) ───────────────────────────────
// Query: from, to, groupId, eventTypeId, filter ('all' | 'own' | 'other')

const portalCalendarSchema = z.object({
  from: optDate,
  to: optDate,
  groupId: optStr,
  eventTypeId: optStr,
  filter: z.enum(['all', 'own', 'other']).optional(),
});

/**
 * Build the WHERE clause + params for the member-portal calendar.
 * @param {object} query    - req.query
 * @param {string} memberId - the authenticated portal member's id
 * @returns {{ where: string, params: any[] }}
 */
export function buildPortalCalendarFilters(query, memberId) {
  const { from, to, groupId, eventTypeId, filter } = portalCalendarSchema.parse(query);

  const conditions = [];
  const params = [];
  let i = 1;

  if (from) {
    conditions.push(`ge.event_date >= $${i++}::date`);
    params.push(from);
  }
  if (to) {
    conditions.push(`ge.event_date <= $${i++}::date`);
    params.push(to);
  }

  if (filter === 'own') {
    // Own groups + general/open meetings
    conditions.push(
      `(ge.group_id IS NULL OR ge.group_id IN (SELECT group_id FROM group_members WHERE member_id = $${i++}))`,
    );
    params.push(memberId);
  } else if (filter === 'other') {
    // Non-group events only, optionally filtered by event type
    conditions.push('ge.group_id IS NULL');
    if (eventTypeId) {
      conditions.push(`ge.event_type_id = $${i++}`);
      params.push(eventTypeId);
    }
  } else if (groupId) {
    conditions.push(`ge.group_id = $${i++}`);
    params.push(groupId);
  }
  // 'all' = no group filter

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return { where, params };
}
