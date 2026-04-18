// beacon2/backend/src/utils/sqlSafety.js
// Safety helpers for the SQL reports feature.
//
// The reports tool lets users run raw SELECT/WITH queries against their tenant
// schema. These helpers enforce the read-only contract:
//   1. Validate the SQL starts with SELECT or WITH and contains a single statement
//   2. Substitute named `:param` placeholders with positional `$N` placeholders
//   3. Execute the query inside a transaction with search_path set to the tenant
//      schema, statement_timeout, and transaction_read_only on.

import { prisma } from './db.js';
import { AppError } from '../middleware/errorHandler.js';

export const MAX_ROWS            = 5000;   // results truncated beyond this
export const STATEMENT_TIMEOUT_MS = 15000;  // PG statement_timeout

/**
 * Validate that a SQL string is a single SELECT/WITH query with no embedded
 * statement separators. Returns the cleaned SQL (trimmed, trailing `;` removed).
 * Throws AppError with a user-facing message if anything looks wrong.
 *
 * We cannot fully parse SQL here, but combined with runReadOnly()'s read-only
 * transaction and statement_timeout, the guard is strong enough: Postgres
 * rejects any write at the engine level, and we reject multi-statements.
 */
export function validateReadOnlySql(rawSql) {
  if (typeof rawSql !== 'string') {
    throw AppError('SQL must be a string.', 400);
  }
  let sql = rawSql.trim();
  if (!sql) throw AppError('SQL is empty.', 400);
  // Allow a single trailing semicolon but no other statement separators
  sql = sql.replace(/;+\s*$/, '');
  if (sql.includes(';')) {
    throw AppError('Multiple statements are not allowed (remove semicolons).', 400);
  }
  const leading = stripLeadingComments(sql);
  if (!/^(select|with)\b/i.test(leading)) {
    throw AppError('Only SELECT or WITH queries are allowed.', 400);
  }
  return sql;
}

function stripLeadingComments(s) {
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') { i++; continue; }
    if (ch === '-' && s[i + 1] === '-') {
      const nl = s.indexOf('\n', i);
      if (nl === -1) return '';
      i = nl + 1;
      continue;
    }
    if (ch === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      if (end === -1) return '';
      i = end + 2;
      continue;
    }
    break;
  }
  return s.slice(i);
}

/**
 * Replace `:name` placeholders in the SQL with `$1`, `$2`, ... in the order
 * parameters were defined. Only parameters whose `name` matches a declared
 * parameter are substituted; any other `:word` is left alone and Postgres
 * will raise a normal syntax error.
 *
 * @param {string} sql
 * @param {Array<{name:string,type:string}>} parameters
 * @param {Record<string,unknown>} valuesByName
 * @returns {{ sql: string, values: unknown[] }}
 */
export function substituteParameters(sql, parameters = [], valuesByName = {}) {
  const values = [];
  let out = sql;
  parameters.forEach((p, idx) => {
    const re = new RegExp(`:${escapeRegExp(p.name)}\\b`, 'g');
    out = out.replace(re, `$${idx + 1}`);
    values.push(coerceValue(valuesByName[p.name], p.type, p.required));
  });
  return { sql: out, values };
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function coerceValue(raw, type, required) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw AppError(`Parameter is required.`, 400);
    return null;
  }
  switch (type) {
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw AppError('Expected a number.', 400);
      return n;
    }
    case 'boolean':
      return raw === true || raw === 'true' || raw === 1 || raw === '1';
    case 'date':
      return String(raw);   // YYYY-MM-DD — pg casts to date as needed
    default:
      return String(raw);
  }
}

/**
 * Run a pre-validated SELECT/WITH query in a read-only transaction scoped to
 * the given tenant schema. Caps results at MAX_ROWS.
 *
 * Returns { columns, rows, rowCount, truncated, durationMs }.
 */
export async function runReadOnly(tenantSlug, sql, values = []) {
  if (!/^[a-z0-9_]+$/.test(tenantSlug)) {
    throw AppError('Invalid tenant.', 400);
  }
  const schema = `u3a_${tenantSlug}`;
  const start  = Date.now();

  const rawRows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}, public`);
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await tx.$executeRawUnsafe(`SET LOCAL transaction_read_only = on`);
    return tx.$queryRawUnsafe(sql, ...values);
  });

  const durationMs = Date.now() - start;
  const truncated  = rawRows.length > MAX_ROWS;
  const kept       = truncated ? rawRows.slice(0, MAX_ROWS) : rawRows;
  const rows       = kept.map(sanitizeRow);
  const columns    = rows.length ? Object.keys(rows[0]) : [];

  return { columns, rows, rowCount: rows.length, truncated, durationMs };
}

/**
 * Make one row safe for JSON serialisation:
 *  - BigInt values become strings (JSON.stringify cannot handle BigInt)
 *  - Date instances become ISO strings
 *  - everything else is left as-is (JSONB is already a plain object)
 */
export function sanitizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'bigint')      out[k] = v.toString();
    else if (v instanceof Date)     out[k] = v.toISOString();
    else                            out[k] = v;
  }
  return out;
}
