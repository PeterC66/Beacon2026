// beacon2/backend/src/routes/venues.js

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);
router.use(requireFeature('venues'));

// ─── GET /venues ──────────────────────────────────────────────────────────

router.get('/', requirePrivilege('group_venues', 'view'), async (req, res, next) => {
  try {
    const rows = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, contact, address, postcode,
              telephone, email, website, notes, private_address, accessible,
              created_at, updated_at
       FROM venues
       ORDER BY name`,
      [],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ─── GET /venues/:id ──────────────────────────────────────────────────────

router.get('/:id', requirePrivilege('group_venues', 'view'), async (req, res, next) => {
  try {
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `SELECT id, name, contact, address, postcode,
              telephone, email, website, notes, private_address, accessible,
              created_at, updated_at
       FROM venues WHERE id = $1`,
      [req.params.id],
    );
    if (!row) throw AppError('Venue not found.', 404);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ─── POST /venues ─────────────────────────────────────────────────────────

const venueSchema = z.object({
  name:           z.string().min(1).max(200),
  contact:        z.string().nullable().optional(),
  address:        z.string().nullable().optional(),
  postcode:       z.string().nullable().optional(),
  telephone:      z.string().nullable().optional(),
  email:          z.string().email().nullable().optional().or(z.literal('')),
  website:        z.string().nullable().optional(),
  notes:          z.string().nullable().optional(),
  privateAddress: z.boolean().default(false),
  accessible:     z.boolean().default(false),
});

router.post('/', requirePrivilege('group_venues', 'create'), async (req, res, next) => {
  try {
    const data = venueSchema.parse(req.body);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `INSERT INTO venues
         (name, contact, address, postcode, telephone, email,
          website, notes, private_address, accessible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        data.name,
        data.contact     ?? null,
        data.address     ?? null,
        data.postcode    ?? null,
        data.telephone   ?? null,
        data.email       || null,
        data.website     ?? null,
        data.notes       ?? null,
        data.privateAddress,
        data.accessible,
      ],
    );
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /venues/:id ────────────────────────────────────────────────────

const updateVenueSchema = z.object({
  name:           z.string().min(1).max(200).optional(),
  contact:        z.string().nullable().optional(),
  address:        z.string().nullable().optional(),
  postcode:       z.string().nullable().optional(),
  telephone:      z.string().nullable().optional(),
  email:          z.string().email().nullable().optional().or(z.literal('')),
  website:        z.string().nullable().optional(),
  notes:          z.string().nullable().optional(),
  privateAddress: z.boolean().optional(),
  accessible:     z.boolean().optional(),
});

const VENUE_FIELDS = [
  ['name',           'name'],
  ['contact',        'contact'],
  ['address',        'address'],
  ['postcode',       'postcode'],
  ['telephone',      'telephone'],
  ['email',          'email'],
  ['website',        'website'],
  ['notes',          'notes'],
  ['privateAddress', 'private_address'],
  ['accessible',     'accessible'],
];

router.patch('/:id', requirePrivilege('group_venues', 'change'), async (req, res, next) => {
  try {
    const data = updateVenueSchema.parse(req.body);
    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [jsKey, col] of VENUE_FIELDS) {
      if (data[jsKey] !== undefined) {
        setClauses.push(`${col} = $${i++}`);
        values.push(jsKey === 'email' ? (data[jsKey] || null) : data[jsKey]);
      }
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }
    setClauses.push(`updated_at = now()`);
    values.push(req.params.id);
    const [row] = await tenantQuery(
      req.user.tenantSlug,
      `UPDATE venues SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    if (!row) throw AppError('Venue not found.', 404);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /venues/:id ───────────────────────────────────────────────────

router.delete('/:id', requirePrivilege('group_venues', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const [existing] = await tenantQuery(slug, `SELECT id FROM venues WHERE id = $1`, [req.params.id]);
    if (!existing) throw AppError('Venue not found.', 404);
    await tenantQuery(slug, `DELETE FROM venues WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Venue deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
