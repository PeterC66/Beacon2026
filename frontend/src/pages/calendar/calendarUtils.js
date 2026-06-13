// beacon2/frontend/src/pages/calendar/calendarUtils.js
// Pure helpers shared by Calendar and its extracted table components.

export function defaultFrom() {
  return new Date().toISOString().slice(0, 10);
}

export function defaultTo() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export function googleMapsUrl(postcode) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(postcode)}`;
}
