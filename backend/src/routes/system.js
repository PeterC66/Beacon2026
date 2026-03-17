// beacon2/backend/src/routes/system.js
// System-level routes for managing u3a tenants.
// Protected by requireSysAdmin middleware.
// In production, also restrict to internal IP addresses via a reverse proxy.

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireSysAdmin } from '../middleware/auth.js';
import { prisma } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { createTenantSchema } from '../seed/createTenant.js';
import { clearTenantData, resetSequences, restoreBeacon2, restoreBeacon } from './backup.js';
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

    res.json({ ok: true, format, message: `Restore complete (${format === 'beacon' ? 'migrated from Beacon' : 'Beacon2 format'}).` });
  } catch (err) {
    next(err);
  }
});

export default router;
