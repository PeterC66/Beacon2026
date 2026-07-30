// beacon2026/backend/src/routes/public/read.js
// Public (unauthenticated) information pages: the read-only groups list and
// calendar exposed to non-members. Field visibility is governed by each
// tenant's group_info_config / calendar_config and the publicPages feature.

import { Router } from 'express';
import { tenantQuery } from '../../utils/db.js';
import { isFeatureEnabled } from '../../middleware/requireFeature.js';

const router = Router();

// GET /:slug/info — public u3a contact details (name + public phone/email/home
// page from System Settings). Unauthenticated; used by the Members Portal sign-in
// and online joining pages so prospective/returning members can make contact.
router.get('/:slug/info', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const [settings] = await tenantQuery(
      slug,
      `SELECT public_phone, public_email, home_page
       FROM tenant_settings WHERE id = 'singleton'`,
    );
    res.json({
      u3aName: req.tenant.name || slug,
      publicPhone: settings?.public_phone ?? '',
      publicEmail: settings?.public_email ?? '',
      homePage: settings?.home_page ?? '',
    });
  } catch (err) {
    next(err);
  }
});

// GET /:slug/groups — public groups list
router.get('/:slug/groups', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;

    if (
      !(await isFeatureEnabled(slug, 'publicPages')) ||
      !(await isFeatureEnabled(slug, 'groups'))
    ) {
      return res
        .status(403)
        .json({ error: 'This feature is not enabled for this u3a.', feature: 'publicPages' });
    }

    const [[settings], groups] = await Promise.all([
      tenantQuery(
        slug,
        `SELECT group_info_config
         FROM tenant_settings WHERE id = 'singleton'`,
      ),
      tenantQuery(
        slug,
        `SELECT g.id, g.name, g.status, g.when_text, g.start_time, g.end_time,
                g.enquiries, g.information,
                v.name AS venue_name, v.postcode AS venue_postcode
         FROM groups g
         LEFT JOIN venues v ON v.id = g.venue_id
         WHERE g.status = 'active' AND g.type = 'group'
         ORDER BY g.name`,
      ),
    ]);

    const groupInfoConfig = {
      status: { public: false },
      venue: { public: false },
      contact: { public: false },
      detail: { public: false },
      enquiries: { public: false },
      ...(settings?.group_info_config ?? {}),
    };

    // Find leaders for contact info
    let leaderMap = new Map();
    if (groupInfoConfig.contact?.public) {
      const leaderRows = await tenantQuery(
        slug,
        `SELECT gm.group_id, m.forenames, m.surname, m.known_as
         FROM group_members gm
         JOIN members m ON m.id = gm.member_id
         WHERE gm.is_leader = true`,
      );
      for (const row of leaderRows) {
        const name = row.known_as || row.forenames?.split(' ')[0] || row.forenames;
        const display = `${name} ${row.surname}`.trim();
        if (!leaderMap.has(row.group_id)) leaderMap.set(row.group_id, []);
        leaderMap.get(row.group_id).push(display);
      }
    }

    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      when: g.when_text || null,
      startTime: g.start_time || null,
      endTime: g.end_time || null,
      ...(groupInfoConfig.status?.public && { status: g.status }),
      ...(groupInfoConfig.venue?.public && {
        venue: g.venue_name || null,
        venuePostcode: g.venue_postcode || null,
      }),
      ...(groupInfoConfig.contact?.public && {
        contact: (leaderMap.get(g.id) || []).join(', ') || g.enquiries || null,
      }),
      ...(groupInfoConfig.enquiries?.public && { enquiries: g.enquiries || null }),
      ...(groupInfoConfig.detail?.public && { information: g.information || null }),
    }));

    res.json({ groups: result, u3aName: req.tenant.name || slug });
  } catch (err) {
    next(err);
  }
});

// GET /:slug/calendar — public calendar
router.get('/:slug/calendar', async (req, res, next) => {
  try {
    const slug = req.tenantSlug;
    const { from, to } = req.query;

    if (
      !(await isFeatureEnabled(slug, 'publicPages')) ||
      !(await isFeatureEnabled(slug, 'events'))
    ) {
      return res
        .status(403)
        .json({ error: 'This feature is not enabled for this u3a.', feature: 'publicPages' });
    }

    const [settings] = await tenantQuery(
      slug,
      `SELECT calendar_config
       FROM tenant_settings WHERE id = 'singleton'`,
    );

    const calConfig = {
      venue: { public: false },
      topic: { public: false },
      enquiries: { public: false },
      detail: { public: false },
      ...(settings?.calendar_config ?? {}),
    };

    const conditions = [`ge.is_private IS NOT TRUE`];
    const params = [];
    let i = 1;

    if (from) {
      conditions.push(`ge.event_date >= $${i++}::date`);
      params.push(from);
    }
    if (to) {
      conditions.push(`ge.event_date <= $${i++}::date`);
      params.push(to);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const events = await tenantQuery(
      slug,
      `SELECT ge.id, ge.event_date, ge.start_time, ge.end_time,
              ge.group_id, g.name AS group_name,
              ge.event_type_id, et.name AS event_type_name,
              ge.venue_id, v.name AS venue_name, v.postcode AS venue_postcode,
              ge.topic, ge.contact, ge.details
       FROM group_events ge
       LEFT JOIN groups g ON g.id = ge.group_id
       LEFT JOIN venues v ON v.id = ge.venue_id
       LEFT JOIN event_types et ON et.id = ge.event_type_id
       ${where}
       ORDER BY ge.event_date, ge.start_time, g.name`,
      params,
    );

    const result = events.map((ev) => ({
      id: ev.id,
      eventDate: ev.event_date,
      startTime: ev.start_time,
      endTime: ev.end_time,
      groupId: ev.group_id,
      groupName: ev.group_name || ev.event_type_name || 'Open Meeting',
      ...(calConfig.venue?.public && {
        venue: ev.venue_name || null,
        venuePostcode: ev.venue_postcode || null,
      }),
      ...(calConfig.topic?.public && { topic: ev.topic || null }),
      ...(calConfig.enquiries?.public && { contact: ev.contact || null }),
      ...(calConfig.detail?.public && { details: ev.details || null }),
    }));

    res.json({ events: result, u3aName: req.tenant.name || slug });
  } catch (err) {
    next(err);
  }
});

export default router;
