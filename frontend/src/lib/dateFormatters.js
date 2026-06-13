// Shared date/time formatting helpers.
// Consolidates the ~20 inline fmtDate/fmtTime/fmtTimestamp helpers that were
// previously copy-pasted across pages (Calendar, AuditLog, CreditBatches, …).
// All functions are null-safe and return '' (or a caller-supplied placeholder)
// for missing input.

export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * "05/01/2026" — UK numeric date from an ISO/date string, preserving the
 * ISO zero-padding. The most common formatter in the app.
 */
export function fmtDate(d, empty = '') {
  if (!d) return empty;
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return empty;
  return `${day}/${m}/${y}`;
}

/**
 * "Sun 5 Jan 2026" — weekday + day + short month. Parsed from the date parts
 * (no timezone shift). Used by the calendar.
 */
export function fmtDateLong(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  const dt = new Date(+y, +m - 1, +day);
  return `${WEEKDAYS_SHORT[dt.getDay()]} ${+day} ${MONTHS_SHORT[dt.getMonth()]} ${y}`;
}

/**
 * "Sun 5/01/2026" — weekday + UK numeric date. Used by the public/portal
 * calendars.
 */
export function fmtDateWeekdayNumeric(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  const dt = new Date(+y, +m - 1, +day);
  return `${WEEKDAYS_SHORT[dt.getDay()]} ${+day}/${m}/${y}`;
}

/**
 * "5 Jan 2026" — day (no padding) + short month, from a date-only string.
 */
export function fmtDateMonth(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${+day} ${MONTHS_SHORT[+m - 1]} ${y}`;
}

/**
 * "5 January 2026" — day + full month name, from a date-only string.
 */
export function fmtDateFullMonth(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${parseInt(day, 10)} ${MONTHS_FULL[parseInt(m, 10) - 1]} ${y}`;
}

/**
 * "05 Jan 2026" — padded day + short month, parsed in UTC. Used where the
 * source is a full ISO timestamp but only the calendar date should show.
 */
export function fmtDateUTC(iso, empty = '—') {
  if (!iso) return empty;
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * "14:30" — 24-hour HH:MM from a time string or ISO datetime string.
 */
export function fmtTime(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  if (idx !== -1) return s.slice(idx + 1, idx + 6);
  return s.slice(0, 5);
}

/**
 * "2.30 pm" — 12-hour time with am/pm, from a time or ISO datetime string.
 */
export function fmtTime12(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  const raw = idx !== -1 ? s.slice(idx + 1, idx + 6) : s.slice(0, 5);
  const [h, min] = raw.split(':');
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'pm' : 'am';
  const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${hr12}.${min} ${ampm}`;
}

/**
 * "5 Jan 2026 14:30" — local date + time (day not padded). Used for record
 * created/changed timestamps.
 */
export function fmtTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

/**
 * "05/01/2026 14:30" — en-GB locale date + time (no seconds).
 */
export function fmtDateTime(ts, empty = '') {
  if (!ts) return empty;
  const d = new Date(ts);
  return (
    d.toLocaleDateString('en-GB') +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * "05/01/2026, 14:30:09" — en-GB locale date + time with seconds.
 * Used by the audit log and gift-aid log.
 */
export function fmtDateTimeSeconds(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
