// beacon2026/backend/src/routes/backup/helpers.js
// Shared cell helpers used by both the export and restore sub-modules.

/** Coerce a value to a non-empty string, or null. */
export function str(v) {
  if (v == null) return null;
  const s = String(v);
  return s === '' ? null : s;
}
