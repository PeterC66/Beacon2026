// beacon2/backend/src/__tests__/spreadsheet.test.js
// Regression tests for the spreadsheet formula-injection helper.

import { describe, it, expect } from 'vitest';
import { sanitizeCell, sanitizeRowForExport } from '../utils/spreadsheet.js';

describe('sanitizeCell', () => {
  it('prefixes formula-leading characters with a single quote', () => {
    expect(sanitizeCell('=HYPERLINK("http://evil")')).toBe("'=HYPERLINK(\"http://evil\")");
    expect(sanitizeCell('+evil')).toBe("'+evil");
    expect(sanitizeCell('-evil')).toBe("'-evil");
    expect(sanitizeCell('@evil')).toBe("'@evil");
    expect(sanitizeCell('\tevil')).toBe("'\tevil");
    expect(sanitizeCell('\revil')).toBe("'\revil");
  });

  it('leaves benign strings unchanged', () => {
    expect(sanitizeCell('Smith')).toBe('Smith');
    expect(sanitizeCell('peter@example.com')).toBe('peter@example.com');
    expect(sanitizeCell('')).toBe('');
  });

  it('leaves non-string values unchanged', () => {
    expect(sanitizeCell(42)).toBe(42);
    expect(sanitizeCell(null)).toBe(null);
    expect(sanitizeCell(undefined)).toBe(undefined);
    expect(sanitizeCell(true)).toBe(true);
  });
});

describe('sanitizeRowForExport', () => {
  it('sanitises each string value in an object row', () => {
    const out = sanitizeRowForExport({ name: '=cmd|"/c calc"!A0', age: 30 });
    expect(out.name).toBe("'=cmd|\"/c calc\"!A0");
    expect(out.age).toBe(30);
  });

  it('sanitises each value in an array row', () => {
    const out = sanitizeRowForExport(['=A1', 'Smith', 42]);
    expect(out).toEqual(["'=A1", 'Smith', 42]);
  });
});
