// beacon2026/backend/src/routes/calendar/helpers.js
// Shared UK date/time formatters used by the calendar export (PDF/Excel) and
// event-member download handlers.

export function fmtDateUK(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

export function fmtTime(t) {
  if (!t) return '';
  const s = String(t);
  const idx = s.indexOf('T');
  if (idx !== -1) return s.slice(idx + 1, idx + 6);
  return s.slice(0, 5);
}
