// beacon2/backend/src/routes/reports.js
// SQL reports — library of saved parameterised queries plus an ad-hoc raw SQL
// editor for site administrators.
//
// Privilege model:
//   - reports:view  — list and view saved reports
//   - reports:run   — run saved reports + download results as Excel
//   - Creating, editing, deleting saved reports AND running ad-hoc SQL
//     require `is_site_admin` (not a privilege) because it is the user who
//     writes the SQL.  A single mistake could expose the whole tenant, so we
//     gate at the admin level rather than via a delegable privilege.

import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { logAudit } from '../utils/audit.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  validateReadOnlySql,
  substituteParameters,
  runReadOnly,
  sanitizeRow,
} from '../utils/sqlSafety.js';

const router = Router();
router.use(requireAuth);

function requireSiteAdmin(req, _res, next) {
  if (!req.user?.isSiteAdmin) {
    return next(AppError('Site administrator privilege required.', 403));
  }
  next();
}

// ─── Zod schemas ──────────────────────────────────────────────────────────

const parameterSchema = z.object({
  name:     z.string().regex(/^[a-z_][a-z0-9_]*$/i).min(1).max(60),
  label:    z.string().min(1).max(120),
  type:     z.enum(['text', 'number', 'date', 'boolean']),
  required: z.boolean().optional().default(false),
  default:  z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const createSchema = z.object({
  name:        z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  sqlText:     z.string().min(1).max(10000),
  parameters:  z.array(parameterSchema).max(20).default([]),
});

const updateSchema = createSchema.partial();

const runSchema = z.object({
  params: z.record(z.string(), z.unknown()).optional().default({}),
});

const adhocSqlSchema = z.object({
  sql: z.string().min(1).max(20000),
});

// ─── Helpers ──────────────────────────────────────────────────────────────

async function fetchReport(slug, id) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    throw AppError('Report not found.', 404);
  }
  const [row] = await tenantQuery(
    slug,
    `SELECT id, name, description, sql_text, parameters, created_at, updated_at
     FROM saved_reports WHERE id = $1`,
    [numId],
  );
  if (!row) throw AppError('Report not found.', 404);
  return row;
}

async function buildExcelBuffer(name, result) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  const cols = result.columns.length ? result.columns : ['(no rows)'];
  ws.columns = cols.map((c) => ({ header: c, key: c, width: 18 }));
  ws.getRow(1).font = { bold: true };
  for (const row of result.rows) ws.addRow(sanitizeRow(row));
  return wb.xlsx.writeBuffer();
}

function safeFilename(name) {
  const base = String(name ?? 'report').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
  return base || 'report';
}

// ─── GET /reports — list ─────────────────────────────────────────────────

router.get('/', requirePrivilege('reports', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, description, parameters, updated_at
       FROM saved_reports ORDER BY name`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── POST /reports/sql/run — raw SQL (site admin) ──────────────────────
// Declared BEFORE /:id/run so that `/sql/run` isn't caught as `id=sql`.

router.post('/sql/run', requireSiteAdmin, async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { sql: rawSql } = adhocSqlSchema.parse(req.body ?? {});
    const cleaned = validateReadOnlySql(rawSql);
    const result = await runReadOnly(slug, cleaned, []);
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'run', entityType: 'adhoc_sql',
      detail: rawSql.slice(0, 500),
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ─── POST /reports/sql/download — Excel of raw SQL (site admin) ────────

router.post('/sql/download', requireSiteAdmin, async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { sql: rawSql } = adhocSqlSchema.parse(req.body ?? {});
    const cleaned = validateReadOnlySql(rawSql);
    const result = await runReadOnly(slug, cleaned, []);
    const buffer = await buildExcelBuffer('adhoc-sql', result);
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'download', entityType: 'adhoc_sql',
      detail: rawSql.slice(0, 500),
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="adhoc-sql.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) { next(err); }
});

// ─── GET /reports/:id ────────────────────────────────────────────────────

router.get('/:id', requirePrivilege('reports', 'view'), async (req, res, next) => {
  try {
    const row = await fetchReport(req.user.tenantSlug, req.params.id);
    res.json(row);
  } catch (err) { next(err); }
});

// ─── POST /reports — create (site admin) ────────────────────────────────

router.post('/', requireSiteAdmin, async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = createSchema.parse(req.body);
    validateReadOnlySql(data.sqlText);
    const [created] = await tenantQuery(
      slug,
      `INSERT INTO saved_reports (name, description, sql_text, parameters)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, name, description, sql_text, parameters, created_at, updated_at`,
      [data.name, data.description ?? null, data.sqlText, JSON.stringify(data.parameters)],
    );
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'create', entityType: 'saved_report',
      entityId: String(created.id), entityName: created.name,
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// ─── PATCH /reports/:id — update (site admin) ───────────────────────────

router.patch('/:id', requireSiteAdmin, async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = updateSchema.parse(req.body);
    if (data.sqlText !== undefined) validateReadOnlySql(data.sqlText);

    await fetchReport(slug, req.params.id);  // 404 if missing

    const sets = [];
    const values = [];
    let i = 1;
    if (data.name !== undefined)        { sets.push(`name = $${i++}`);             values.push(data.name); }
    if (data.description !== undefined) { sets.push(`description = $${i++}`);      values.push(data.description); }
    if (data.sqlText !== undefined)     { sets.push(`sql_text = $${i++}`);         values.push(data.sqlText); }
    if (data.parameters !== undefined)  { sets.push(`parameters = $${i++}::jsonb`); values.push(JSON.stringify(data.parameters)); }
    if (!sets.length) throw AppError('Nothing to update.', 400);
    sets.push('updated_at = now()');
    values.push(Number(req.params.id));

    const [updated] = await tenantQuery(
      slug,
      `UPDATE saved_reports SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, name, description, sql_text, parameters, created_at, updated_at`,
      values,
    );
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'update', entityType: 'saved_report',
      entityId: String(updated.id), entityName: updated.name,
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ─── DELETE /reports/:id (site admin) ───────────────────────────────────

router.delete('/:id', requireSiteAdmin, async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const existing = await fetchReport(slug, req.params.id);
    await tenantQuery(slug, `DELETE FROM saved_reports WHERE id = $1`, [existing.id]);
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'delete', entityType: 'saved_report',
      entityId: String(existing.id), entityName: existing.name,
    });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ─── POST /reports/:id/run — execute saved report ───────────────────────

router.post('/:id/run', requirePrivilege('reports', 'run'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { params } = runSchema.parse(req.body ?? {});
    const report = await fetchReport(slug, req.params.id);
    const cleaned = validateReadOnlySql(report.sql_text);
    const { sql, values } = substituteParameters(cleaned, report.parameters ?? [], params);
    const result = await runReadOnly(slug, sql, values);
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'run', entityType: 'saved_report',
      entityId: String(report.id), entityName: report.name,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ─── POST /reports/:id/download — Excel of saved report result ─────────

router.post('/:id/download', requirePrivilege('reports', 'run'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { params } = runSchema.parse(req.body ?? {});
    const report = await fetchReport(slug, req.params.id);
    const cleaned = validateReadOnlySql(report.sql_text);
    const { sql, values } = substituteParameters(cleaned, report.parameters ?? [], params);
    const result = await runReadOnly(slug, sql, values);
    const buffer = await buildExcelBuffer(report.name, result);
    logAudit(slug, {
      userId: req.user.userId, userName: req.user.name,
      action: 'download', entityType: 'saved_report',
      entityId: String(report.id), entityName: report.name,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(report.name)}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) { next(err); }
});

export default router;
