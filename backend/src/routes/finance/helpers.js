// beacon2/backend/src/routes/finance/helpers.js
// Shared helper functions used across multiple finance sub-route files.

/** Compute financial year start and end date strings for a given named year. */
export function computeYearBounds(yearNum, startMonth, startDay) {
  const m = String(startMonth).padStart(2, '0');
  const d = String(startDay).padStart(2, '0');
  const yearStart = `${yearNum}-${m}-${d}`;
  // End = one day before next year's start
  const next = new Date(Date.UTC(yearNum + 1, startMonth - 1, startDay));
  next.setUTCDate(next.getUTCDate() - 1);
  const yearEnd = next.toISOString().slice(0, 10);
  return { yearStart, yearEnd };
}
