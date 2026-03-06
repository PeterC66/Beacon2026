// beacon2/backend/src/routes/system.js
// System-level routes for managing u3a tenants.
// Protected by requireSysAdmin middleware.
// In production, also restrict to internal IP addresses via a reverse proxy.

import { Router } from 'express';
import { z } from 'zod';
import { requireSysAdmin } from '../middleware/auth.js';
import { prisma } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { createTenantSchema } from '../seed/createTenant.js';

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

export default router;
