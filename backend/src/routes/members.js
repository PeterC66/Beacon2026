// beacon2/backend/src/routes/members.js

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePrivilege } from '../middleware/requirePrivilege.js';
import { tenantQuery } from '../utils/db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// ─── helpers ──────────────────────────────────────────────────────────────

/** Derive initials from a forenames string: "William John" → "WJ" */
function deriveInitials(forenames) {
  return (forenames ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join('');
}

// ─── GET /members ─────────────────────────────────────────────────────────
// Query params:
//   status   – comma-separated list of status IDs  (default: all)
//   classId  – single class ID
//   q        – free-text search
//   letter   – single letter to filter surname start

router.get('/', requirePrivilege('members_list', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const { status, classId, q, letter } = req.query;

    const conditions = [];
    const params = [];
    let i = 1;

    if (status) {
      const ids = status.split(',').filter(Boolean);
      if (ids.length) {
        conditions.push(`m.status_id = ANY($${i++}::text[])`);
        params.push(ids);
      }
    }

    if (classId) {
      conditions.push(`m.class_id = $${i++}`);
      params.push(classId);
    }

    if (letter && /^[A-Z]$/i.test(letter)) {
      conditions.push(`upper(m.surname) LIKE $${i++}`);
      params.push(letter.toUpperCase() + '%');
    }

    if (q) {
      const like = `%${q}%`;
      conditions.push(`(
        m.surname        ILIKE $${i}   OR
        m.forenames      ILIKE $${i}   OR
        m.known_as       ILIKE $${i}   OR
        m.email          ILIKE $${i}   OR
        m.mobile         ILIKE $${i}   OR
        a.street         ILIKE $${i}   OR
        a.town           ILIKE $${i}   OR
        a.postcode       ILIKE $${i}   OR
        m.membership_number::text = $${i + 1}
      )`);
      params.push(like, q.trim());
      i += 2;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const members = await tenantQuery(
      slug,
      `SELECT m.id, m.membership_number, m.title, m.forenames, m.surname,
              m.known_as, m.email, m.mobile, m.hide_contact,
              ms.id AS status_id, ms.name AS status,
              mc.id AS class_id,  mc.name AS class,
              a.house_no, a.street, a.town, a.postcode,
              m.joined_on, m.next_renewal, m.partner_id
       FROM members m
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN member_classes  mc ON mc.id = m.class_id
       LEFT JOIN addresses        a ON a.id  = m.address_id
       ${where}
       ORDER BY m.surname, m.forenames`,
      params,
    );

    res.json(members);
  } catch (err) {
    next(err);
  }
});

// ─── GET /members/:id ─────────────────────────────────────────────────────

router.get('/:id', requirePrivilege('member_record', 'view'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;

    const [member] = await tenantQuery(
      slug,
      `SELECT m.*,
              ms.name AS status_name,
              mc.name AS class_name,
              mc.is_associate,
              a.house_no, a.street, a.add_line1, a.add_line2,
              a.town, a.county, a.postcode, a.telephone,
              p.forenames AS partner_forenames, p.surname AS partner_surname,
              p.membership_number AS partner_number
       FROM members m
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN member_classes  mc ON mc.id = m.class_id
       LEFT JOIN addresses        a ON a.id  = m.address_id
       LEFT JOIN members          p ON p.id  = m.partner_id
       WHERE m.id = $1`,
      [req.params.id],
    );

    if (!member) throw AppError('Member not found.', 404);
    res.json(member);
  } catch (err) {
    next(err);
  }
});

// ─── POST /members ────────────────────────────────────────────────────────

const addressSchema = z.object({
  houseNo:   z.string().optional(),
  street:    z.string().optional(),
  addLine1:  z.string().optional(),
  addLine2:  z.string().optional(),
  town:      z.string().optional(),
  county:    z.string().optional(),
  postcode:  z.string().optional(),
  telephone: z.string().optional(),
});

const createMemberSchema = z.object({
  title:       z.string().max(20).optional(),
  forenames:   z.string().min(1).max(100),
  surname:     z.string().min(1).max(100),
  knownAs:     z.string().max(50).optional(),
  suffix:      z.string().max(30).optional(),
  email:       z.string().email().optional().or(z.literal('')),
  mobile:      z.string().max(30).optional(),
  statusId:    z.string().min(1),
  classId:     z.string().min(1),
  joinedOn:    z.string().min(1, 'Date joined is required'),  // ISO date string
  nextRenewal: z.string().optional(),
  giftAidFrom: z.string().optional(),
  homeU3a:     z.string().max(100).optional(),
  notes:       z.string().optional(),
  hideContact: z.boolean().default(false),
  // Address — either a new address object or an existing partner's id
  address:        addressSchema.optional(),
  existingPartnerId: z.string().optional(),  // reuse this member's address_id
}).superRefine((val, ctx) => {
  // Postcode is required when not sharing a partner's address
  if (!val.existingPartnerId && !val.address?.postcode?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address', 'postcode'],
      message: 'Postcode is required',
    });
  }
});

router.post('/', requirePrivilege('member_record', 'create'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = createMemberSchema.parse(req.body);

    // Duplicate name check — warn but proceed (frontend must have confirmed)
    const duplicateCheck = !req.query.confirmed;
    if (duplicateCheck) {
      const dupes = await tenantQuery(
        slug,
        `SELECT id FROM members
         WHERE lower(forenames) = lower($1) AND lower(surname) = lower($2)`,
        [data.forenames, data.surname],
      );
      if (dupes.length > 0) {
        return res.status(409).json({
          error: 'A member with that name already exists.',
          code: 'DUPLICATE_NAME',
          existingId: dupes[0].id,
        });
      }
    }

    // Resolve address_id
    let addressId = null;

    if (data.existingPartnerId) {
      // Share address with an existing member
      const [partner] = await tenantQuery(
        slug,
        `SELECT id, address_id FROM members WHERE id = $1`,
        [data.existingPartnerId],
      );
      if (!partner) throw AppError('Partner member not found.', 404);
      addressId = partner.address_id;
    } else if (data.address) {
      const addr = data.address;
      const [newAddr] = await tenantQuery(
        slug,
        `INSERT INTO addresses (house_no, street, add_line1, add_line2, town, county, postcode, telephone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          addr.houseNo   ?? null, addr.street   ?? null,
          addr.addLine1  ?? null, addr.addLine2  ?? null,
          addr.town      ?? null, addr.county    ?? null,
          addr.postcode  ?? null, addr.telephone ?? null,
        ],
      );
      addressId = newAddr.id;
    }

    const initials = deriveInitials(data.forenames);
    const email = data.email ? data.email.toLowerCase() : null;

    const [member] = await tenantQuery(
      slug,
      `INSERT INTO members
         (title, forenames, surname, known_as, initials, suffix, email, mobile,
          address_id, status_id, class_id, joined_on, next_renewal, gift_aid_from,
          home_u3a, notes, hide_contact, partner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14::date,$15,$16,$17,$18)
       RETURNING id, membership_number, title, forenames, surname, known_as,
                 initials, suffix, email, mobile, status_id, class_id,
                 joined_on, next_renewal, gift_aid_from, home_u3a, notes,
                 hide_contact, partner_id, address_id, created_at`,
      [
        data.title      ?? null,
        data.forenames,
        data.surname,
        data.knownAs    ?? null,
        initials,
        data.suffix     ?? null,
        email,
        data.mobile     ?? null,
        addressId,
        data.statusId,
        data.classId,
        data.joinedOn   ?? null,
        data.nextRenewal ?? null,
        data.giftAidFrom ?? null,
        data.homeU3a    ?? null,
        data.notes      ?? null,
        data.hideContact,
        data.existingPartnerId ?? null,
      ],
    );

    // If partner specified, set partner_id on both sides (bi-directional)
    if (data.existingPartnerId) {
      await tenantQuery(
        slug,
        `UPDATE members SET partner_id = $1, updated_at = now() WHERE id = $2`,
        [member.id, data.existingPartnerId],
      );
    }

    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /members/:id ───────────────────────────────────────────────────

const updateMemberSchema = z.object({
  title:       z.string().max(20).optional(),
  forenames:   z.string().min(1).max(100).optional(),
  surname:     z.string().min(1).max(100).optional(),
  knownAs:     z.string().max(50).nullable().optional(),
  suffix:      z.string().max(30).nullable().optional(),
  email:       z.string().email().optional().or(z.literal('')).nullable(),
  mobile:      z.string().max(30).nullable().optional(),
  statusId:    z.string().optional(),
  classId:     z.string().optional(),
  joinedOn:    z.string().nullable().optional(),
  nextRenewal: z.string().nullable().optional(),
  giftAidFrom: z.string().nullable().optional(),
  homeU3a:     z.string().max(100).nullable().optional(),
  notes:       z.string().nullable().optional(),
  hideContact: z.boolean().optional(),
  partnerId:   z.string().nullable().optional(),
  // Address fields — updates the linked address record
  address: z.object({
    houseNo:   z.string().nullable().optional(),
    street:    z.string().nullable().optional(),
    addLine1:  z.string().nullable().optional(),
    addLine2:  z.string().nullable().optional(),
    town:      z.string().nullable().optional(),
    county:    z.string().nullable().optional(),
    postcode:  z.string().nullable().optional(),
    telephone: z.string().nullable().optional(),
  }).optional(),
});

router.patch('/:id', requirePrivilege('member_record', 'change'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const data = updateMemberSchema.parse(req.body);
    const memberId = req.params.id;

    // Early empty-body check (before any DB call)
    const MEMBER_FIELDS = ['title','forenames','surname','knownAs','suffix','email','mobile',
      'statusId','classId','joinedOn','nextRenewal','giftAidFrom','homeU3a','notes','hideContact','partnerId'];
    if (!data.address && !MEMBER_FIELDS.some((f) => data[f] !== undefined)) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    // Fetch current member to get address_id
    const [current] = await tenantQuery(
      slug,
      `SELECT id, address_id, forenames FROM members WHERE id = $1`,
      [memberId],
    );
    if (!current) throw AppError('Member not found.', 404);

    // Update address if address fields supplied
    if (data.address) {
      const addr = data.address;
      if (current.address_id) {
        // Update existing address record (affects all members sharing it)
        const addrFields = [];
        const addrVals = [];
        let ai = 1;
        if (addr.houseNo   !== undefined) { addrFields.push(`house_no = $${ai++}`);   addrVals.push(addr.houseNo); }
        if (addr.street    !== undefined) { addrFields.push(`street = $${ai++}`);     addrVals.push(addr.street); }
        if (addr.addLine1  !== undefined) { addrFields.push(`add_line1 = $${ai++}`);  addrVals.push(addr.addLine1); }
        if (addr.addLine2  !== undefined) { addrFields.push(`add_line2 = $${ai++}`);  addrVals.push(addr.addLine2); }
        if (addr.town      !== undefined) { addrFields.push(`town = $${ai++}`);       addrVals.push(addr.town); }
        if (addr.county    !== undefined) { addrFields.push(`county = $${ai++}`);     addrVals.push(addr.county); }
        if (addr.postcode  !== undefined) { addrFields.push(`postcode = $${ai++}`);   addrVals.push(addr.postcode); }
        if (addr.telephone !== undefined) { addrFields.push(`telephone = $${ai++}`);  addrVals.push(addr.telephone); }
        if (addrFields.length) {
          addrFields.push(`updated_at = now()`);
          addrVals.push(current.address_id);
          await tenantQuery(
            slug,
            `UPDATE addresses SET ${addrFields.join(', ')} WHERE id = $${ai}`,
            addrVals,
          );
        }
      } else {
        // Create a new address record and link it
        const [newAddr] = await tenantQuery(
          slug,
          `INSERT INTO addresses (house_no, street, add_line1, add_line2, town, county, postcode, telephone)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            addr.houseNo ?? null, addr.street ?? null,
            addr.addLine1 ?? null, addr.addLine2 ?? null,
            addr.town ?? null, addr.county ?? null,
            addr.postcode ?? null, addr.telephone ?? null,
          ],
        );
        data._newAddressId = newAddr.id;
      }
    }

    // Build member UPDATE
    const fields = [];
    const values = [];
    let i = 1;

    if (data.title       !== undefined) { fields.push(`title = $${i++}`);        values.push(data.title); }
    if (data.forenames   !== undefined) { fields.push(`forenames = $${i++}`);    values.push(data.forenames);
                                          fields.push(`initials = $${i++}`);     values.push(deriveInitials(data.forenames)); }
    if (data.surname     !== undefined) { fields.push(`surname = $${i++}`);      values.push(data.surname); }
    if (data.knownAs     !== undefined) { fields.push(`known_as = $${i++}`);     values.push(data.knownAs); }
    if (data.suffix      !== undefined) { fields.push(`suffix = $${i++}`);       values.push(data.suffix); }
    if (data.email       !== undefined) { fields.push(`email = $${i++}`);        values.push(data.email ? data.email.toLowerCase() : null); }
    if (data.mobile      !== undefined) { fields.push(`mobile = $${i++}`);       values.push(data.mobile); }
    if (data.statusId    !== undefined) { fields.push(`status_id = $${i++}`);    values.push(data.statusId); }
    if (data.classId     !== undefined) { fields.push(`class_id = $${i++}`);     values.push(data.classId); }
    if (data.joinedOn    !== undefined) { fields.push(`joined_on = $${i++}::date`);    values.push(data.joinedOn); }
    if (data.nextRenewal !== undefined) { fields.push(`next_renewal = $${i++}::date`); values.push(data.nextRenewal); }
    if (data.giftAidFrom !== undefined) { fields.push(`gift_aid_from = $${i++}::date`); values.push(data.giftAidFrom); }
    if (data.homeU3a     !== undefined) { fields.push(`home_u3a = $${i++}`);     values.push(data.homeU3a); }
    if (data.notes       !== undefined) { fields.push(`notes = $${i++}`);        values.push(data.notes); }
    if (data.hideContact !== undefined) { fields.push(`hide_contact = $${i++}`); values.push(data.hideContact); }
    if (data.partnerId   !== undefined) { fields.push(`partner_id = $${i++}`);   values.push(data.partnerId); }
    if (data._newAddressId)             { fields.push(`address_id = $${i++}`);   values.push(data._newAddressId); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    fields.push(`updated_at = now()`);
    values.push(memberId);

    const [member] = await tenantQuery(
      slug,
      `UPDATE members SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, membership_number`,
      values,
    );
    if (!member) throw AppError('Member not found.', 404);

    res.json({ message: 'Member updated.', id: member.id, membership_number: member.membership_number });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /members/:id ──────────────────────────────────────────────────

router.delete('/:id', requirePrivilege('member_record', 'delete'), async (req, res, next) => {
  try {
    const slug = req.user.tenantSlug;
    const memberId = req.params.id;

    const [member] = await tenantQuery(
      slug,
      `SELECT id, address_id, partner_id FROM members WHERE id = $1`,
      [memberId],
    );
    if (!member) throw AppError('Member not found.', 404);

    // Clear partner back-reference before deleting
    if (member.partner_id) {
      await tenantQuery(
        slug,
        `UPDATE members SET partner_id = NULL, updated_at = now() WHERE id = $1`,
        [member.partner_id],
      );
    }

    await tenantQuery(slug, `DELETE FROM members WHERE id = $1`, [memberId]);

    // Delete address only if no other member references it
    if (member.address_id) {
      const [remaining] = await tenantQuery(
        slug,
        `SELECT COUNT(*)::int AS n FROM members WHERE address_id = $1`,
        [member.address_id],
      );
      if (remaining.n === 0) {
        await tenantQuery(slug, `DELETE FROM addresses WHERE id = $1`, [member.address_id]);
      }
    }

    res.json({ message: 'Member deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
