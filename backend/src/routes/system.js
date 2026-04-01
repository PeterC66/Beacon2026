// beacon2/backend/src/routes/system.js
// System-level routes for managing u3a tenants.
// Protected by requireSysAdmin middleware.
// In production, also restrict to internal IP addresses via a reverse proxy.

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireSysAdmin } from '../middleware/auth.js';
import { prisma, tenantQuery } from '../utils/db.js';
import { hashPassword } from '../utils/password.js';
import { AppError } from '../middleware/errorHandler.js';
import { createTenantSchema } from '../seed/createTenant.js';
import { clearTenantData, resetSequences, restoreBeacon2, restoreBeacon, BEACON_DEFAULT_PASSWORD } from './backup.js';
import { syncDefaultRolePrivileges } from '../utils/migrate.js';
import ExcelJS from 'exceljs';

const router = Router();
router.use(requireSysAdmin);

// ─── GET /system/tenants ──────────────────────────────────────────────────
router.get('/tenants', async (_req, res, next) => {
  try {
    const tenants = await prisma.sysTenant.findMany({ orderBy: { name: 'asc' } });
    res.json(tenants);
  } catch (err) {
    next(err);
  }
});

// ─── POST /system/tenants ─────────────────────────────────────────────────
// Create a new u3a tenant: creates the DB schema, seeds default roles and privileges,
// and creates the first admin user.

const newTenantSchema = z.object({
  name:           z.string().min(1),
  slug:           z.string().regex(/^[a-z0-9_]+$/, 'Slug must be lowercase alphanumeric with underscores'),
  adminEmail:     z.string().email(),
  adminName:      z.string().min(1),
  adminPassword:  z.string().min(8),
  adminUsername:  z.string().regex(/^[a-z0-9]+$/, 'Username must be lowercase letters and numbers only'),
});

router.post('/tenants', async (req, res, next) => {
  try {
    const data = newTenantSchema.parse(req.body);

    // Check slug not already taken
    const existing = await prisma.sysTenant.findUnique({ where: { slug: data.slug } });
    if (existing) throw AppError('A u3a with that slug already exists.', 409);

    const tenant = await createTenantSchema(data);
    res.status(201).json(tenant);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /system/tenants/:id ────────────────────────────────────────────
router.patch('/tenants/:id', async (req, res, next) => {
  try {
    const { name, active } = z.object({
      name:   z.string().min(1).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const tenant = await prisma.sysTenant.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(active !== undefined && { active }) },
    });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /system/tenants/:id ───────────────────────────────────────────
// Permanently deletes a tenant: drops the Postgres schema and removes the record.
router.delete('/tenants/:id', async (req, res, next) => {
  try {
    const tenant = await prisma.sysTenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) throw AppError('Tenant not found.', 404);

    const schemaName = `u3a_${tenant.slug}`;
    // Drop schema and all its contents
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await prisma.sysTenant.delete({ where: { id: req.params.id } });

    res.json({ ok: true, message: `Tenant "${tenant.name}" deleted.` });
  } catch (err) {
    next(err);
  }
});

// ─── POST /system/tenants/:id/set-temp-password ──────────────────────────────
// Sets the password of ALL users in a tenant to a supplied temporary password.
// Useful for accessing a tenant after a Beacon restore or when all admins are locked out.
router.post('/tenants/:id/set-temp-password', async (req, res, next) => {
  try {
    const { password } = z.object({ password: z.string().min(6) }).parse(req.body);
    const tenant = await prisma.sysTenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) throw AppError('Tenant not found.', 404);

    const hash = await hashPassword(password);
    const result = await tenantQuery(
      tenant.slug,
      `UPDATE users SET password_hash = $1, must_change_password = true RETURNING username, name`,
      [hash],
    );
    res.json({ ok: true, updated: result.length, users: result.map((u) => u.username || u.name) });
  } catch (err) {
    next(err);
  }
});

// ─── Ensure sys_settings table uses snake_case columns ───────────────────────
// The table may already exist with camelCase columns from an earlier deploy,
// or with snake_case from Prisma @map. This helper normalises it once.
async function ensureSysSettings() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sys_settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      system_message TEXT NOT NULL DEFAULT '<<System Message here>>',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // If the table was created with camelCase columns, rename them
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE sys_settings RENAME COLUMN "systemMessage" TO system_message`);
  } catch { /* column already snake_case — ignore */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE sys_settings RENAME COLUMN "createdAt" TO created_at`);
  } catch { /* already snake_case */ }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE sys_settings RENAME COLUMN "updatedAt" TO updated_at`);
  } catch { /* already snake_case */ }
}

// ─── GET /system/settings ─────────────────────────────────────────────────────
router.get('/settings', async (_req, res, next) => {
  try {
    await ensureSysSettings();
    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO sys_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING RETURNING system_message`
    );
    let msg = rows[0]?.system_message;
    if (msg == null) {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT system_message FROM sys_settings WHERE id = 'singleton'`
      );
      msg = existing[0]?.system_message;
    }
    res.json({ systemMessage: msg ?? '<<System Message here>>' });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /system/settings ──────────────────────────────────────────────────
router.patch('/settings', async (req, res, next) => {
  try {
    const { systemMessage } = z.object({
      systemMessage: z.string().optional(),
    }).parse(req.body);

    await ensureSysSettings();
    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO sys_settings (id, system_message, updated_at) VALUES ('singleton', $1, now())
       ON CONFLICT (id) DO UPDATE SET system_message = $1, updated_at = now()
       RETURNING system_message`,
      systemMessage,
    );
    res.json({ systemMessage: rows[0]?.system_message ?? '' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /system/restore/:tenantSlug ────────────────────────────────────────
// Restore a full tenant backup (Beacon2 or Beacon legacy format).
// System-admin only (requireSysAdmin already applied above).

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/restore/:tenantSlug', upload.single('backup'), async (req, res, next) => {
  try {
    const { tenantSlug } = req.params;
    if (!/^[a-z0-9_]+$/.test(tenantSlug)) {
      return next(AppError('Invalid tenant slug.', 400));
    }
    if (!req.file) {
      return next(AppError('No backup file uploaded.', 400));
    }

    // Check tenant exists
    const tenant = await prisma.sysTenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return next(AppError('Tenant not found.', 404));

    // Parse workbook from buffer
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);

    // Detect format: Members sheet first column header 'mkey' → Beacon; 'id' → Beacon2
    const membersWs = wb.getWorksheet('Members');
    if (!membersWs) return next(AppError('Invalid backup file: no Members sheet found.', 400));
    const firstHeader = String(membersWs.getRow(1).getCell(1).value ?? '').trim().toLowerCase();
    const format = firstHeader === 'mkey' ? 'beacon' : 'beacon2';

    const schema = `u3a_${tenantSlug}`;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET search_path TO ${schema}, public`);
      await clearTenantData(tx);
      if (format === 'beacon2') {
        await restoreBeacon2(tx, wb);
      } else {
        await restoreBeacon(tx, wb);
        await resetSequences(tx);
      }
    }, { timeout: 300_000 });

    // Ensure default-named roles (Administration, Treasurer, etc.) have their
    // canonical privileges.  For Beacon restores this is essential because the
    // Beacon export has no privileges sheet — roles are created but empty.
    // For Beacon2 restores it fills any gaps from backups predating new resources.
    await syncDefaultRolePrivileges(tenantSlug);

    const msg = format === 'beacon'
      ? `Restore complete (migrated from Beacon).\nImported users have been given the temporary password: ${BEACON_DEFAULT_PASSWORD}\nPlease ask each user to change their password after first login.`
      : 'Restore complete (Beacon2 format).';
    res.json({ ok: true, format, message: msg });
  } catch (err) {
    next(err);
  }
});

export default router;
