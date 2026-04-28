/**
 * Shared coercion helpers for parsing Beacon backup xlsx rows with Zod.
 *
 * Excel cells reach JS as one of: string, number, boolean, Date, null, undefined.
 * These helpers normalise to the types we want to store. They follow the same
 * conventions as Beacon2's `restoreBeacon` import (see `backup.js`):
 *
 *   - Empty strings become null.
 *   - Booleans accept 1, '1', true, 'true' (case-insensitive).
 *   - Dates accept Excel Date, ISO YYYY-MM-DD, or UK DD/MM/YYYY; output is
 *     a YYYY-MM-DD string (or null).
 *   - Numerics accept numbers and numeric strings; output is number or null.
 */

import { z } from "zod";

/** Trim a string and return null if empty. */
const nullableString = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** Beacon-style boolean: 1 / '1' / true / 'true' → true; everything else → false. */
const parseBool = (v: unknown): boolean => {
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "1" || t === "true";
  }
  return false;
};

/** Parse a number; empty / non-numeric → null. */
const parseDec = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Parse an integer; empty / non-numeric → null. */
const parseInt0 = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? Math.trunc(v) : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};

/** Parse a date; output is YYYY-MM-DD or null. */
const parseDate = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  // ISO already?
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // UK DD/MM/YYYY
  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  // Last resort: let Date parse it
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Parse a time; output is HH:MM or null. */
const parseTime = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(11, 16);
  }
  const s = String(v).trim();
  return s ? s.slice(0, 5) : null;
};

// ---- Zod coercion primitives ------------------------------------------------

/** Required non-empty string. */
export const zString = z.preprocess(nullableString, z.string().min(1));

/** Optional string (null when empty). */
export const zStringNullable = z.preprocess(nullableString, z.string().nullable());

/** Required integer. */
export const zInt = z.preprocess(parseInt0, z.number().int());

/** Optional integer. */
export const zIntNullable = z.preprocess(parseInt0, z.number().int().nullable());

/** Required number (decimal). */
export const zDecimal = z.preprocess(parseDec, z.number());

/** Optional number (decimal). */
export const zDecimalNullable = z.preprocess(parseDec, z.number().nullable());

/** Beacon boolean (always coerces). */
export const zBool = z.preprocess(parseBool, z.boolean());

/** Required date as YYYY-MM-DD string. */
export const zDate = z.preprocess(parseDate, z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

/** Optional date as YYYY-MM-DD string or null. */
export const zDateNullable = z.preprocess(parseDate, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());

/** Optional time as HH:MM string or null. */
export const zTimeNullable = z.preprocess(parseTime, z.string().regex(/^\d{2}:\d{2}$/).nullable());
