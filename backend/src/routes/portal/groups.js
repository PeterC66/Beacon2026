// beacon2026/backend/src/routes/portal/groups.js
// Members Portal — Groups (doc 10.2.2): browse active groups and join/leave.

import { Router } from 'express';
import { tenantQuery } from '../../utils/db.js';
import { logAudit } from '../../utils/audit.js';
import { notifyGroupLeaders } from './helpers.js';

const router = Router({ mergeParams: true });

router.get('/groups', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;

    const [[settings], groups] = await Promise.all([
      tenantQuery(
        slug,
        `SELECT portal_config, group_info_config
         FROM tenant_settings WHERE id = 'singleton'`,
      ),
      tenantQuery(
        slug,
        `SELECT g.id, g.name, g.status, g.when_text, g.start_time, g.end_time,
                g.enquiries, g.information, g.max_members, g.allow_online_join,
                g.enable_waiting_list,
                v.name AS venue_name, v.postcode AS venue_postcode,
                f.name AS faculty_name,
                (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.waiting_since IS NULL) AS member_count
         FROM groups g
         LEFT JOIN venues v ON v.id = g.venue_id
         LEFT JOIN faculties f ON f.id = g.faculty_id
         WHERE g.status = 'active'
         ORDER BY g.name`,
      ),
    ]);

    const portalConfig = { groups: false, ...(settings?.portal_config ?? {}) };
    if (!portalConfig.groups) {
      return res
        .status(403)
        .json({ error: 'Groups viewing is not enabled for this organisation.' });
    }

    const groupInfoConfig = {
      status: { members: false },
      venue: { members: false },
      contact: { members: false },
      detail: { members: false },
      enquiries: { members: false },
      joinGroup: { members: false },
      ...(settings?.group_info_config ?? {}),
    };

    // Get the member's group memberships
    const memberships = await tenantQuery(
      slug,
      `SELECT group_id, is_leader, waiting_since FROM group_members WHERE member_id = $1`,
      [memberId],
    );
    const memberGroupMap = new Map(memberships.map((m) => [m.group_id, m]));

    // Find leaders for contact info
    const leaderRows = await tenantQuery(
      slug,
      `SELECT gm.group_id, m.forenames, m.surname, m.known_as
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
       WHERE gm.is_leader = true`,
    );
    const leaderMap = new Map();
    for (const row of leaderRows) {
      const name = row.known_as || row.forenames?.split(' ')[0] || row.forenames;
      const display = `${name} ${row.surname}`.trim();
      if (!leaderMap.has(row.group_id)) leaderMap.set(row.group_id, []);
      leaderMap.get(row.group_id).push(display);
    }

    const result = groups.map((g) => {
      const membership = memberGroupMap.get(g.id);
      return {
        id: g.id,
        name: g.name,
        isMember: !!membership && !membership.waiting_since,
        isWaiting: !!membership?.waiting_since,
        // Conditional fields based on groupInfoConfig
        ...(groupInfoConfig.status?.members && { status: g.status }),
        when: g.when_text || null,
        startTime: g.start_time || null,
        endTime: g.end_time || null,
        ...(groupInfoConfig.venue?.members && {
          venue: g.venue_name || null,
          venuePostcode: g.venue_postcode || null,
        }),
        ...(groupInfoConfig.contact?.members && {
          contact: (leaderMap.get(g.id) || []).join(', ') || g.enquiries || null,
        }),
        ...(groupInfoConfig.enquiries?.members && { enquiries: g.enquiries || null }),
        ...(groupInfoConfig.detail?.members && { information: g.information || null }),
        canJoin: groupInfoConfig.joinGroup?.members && g.allow_online_join !== false,
        maxMembers: g.max_members,
        memberCount: g.member_count,
        enableWaitingList: g.enable_waiting_list,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /groups/:groupId/join ──────────────────────────────────────────────

router.post('/groups/:groupId/join', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const { groupId } = req.params;

    // Check joinGroup is enabled
    const [settings] = await tenantQuery(
      slug,
      `SELECT group_info_config FROM tenant_settings WHERE id = 'singleton'`,
    );
    const gic = { joinGroup: { members: false }, ...(settings?.group_info_config ?? {}) };
    if (!gic.joinGroup?.members) {
      return res.status(403).json({ error: 'Online group joining is not enabled.' });
    }

    // Check group exists and is active
    const [group] = await tenantQuery(
      slug,
      `SELECT id, name, max_members, enable_waiting_list, allow_online_join,
              (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.waiting_since IS NULL) AS member_count
       FROM groups g WHERE g.id = $1 AND g.status = 'active'`,
      [groupId],
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }
    if (group.allow_online_join === false) {
      return res.status(403).json({ error: 'This group does not allow online joining.' });
    }

    // Check not already a member
    const [existing] = await tenantQuery(
      slug,
      `SELECT id FROM group_members WHERE group_id = $1 AND member_id = $2`,
      [groupId, memberId],
    );
    if (existing) {
      return res.status(400).json({ error: 'You are already a member of this group.' });
    }

    // Check capacity — if full, add to waiting list if enabled
    const isFull = group.max_members > 0 && group.member_count >= group.max_members;
    let waitingSince = null;
    if (isFull) {
      if (!group.enable_waiting_list) {
        return res
          .status(400)
          .json({ error: 'This group is full and does not have a waiting list.' });
      }
      waitingSince = new Date().toISOString().slice(0, 10);
    }

    await tenantQuery(
      slug,
      `INSERT INTO group_members (group_id, member_id, waiting_since)
       VALUES ($1, $2, $3::date)`,
      [groupId, memberId, waitingSince],
    );

    // Notify group leader (stubbed)
    await notifyGroupLeaders(slug, groupId, memberId, 'join', group.name);

    logAudit(slug, {
      userId: null,
      userName: `${req.portal.name} (portal)`,
      action: 'create',
      entityType: 'group_member',
      entityId: groupId,
      entityName: group.name,
      detail: waitingSince ? 'Added to waiting list via portal' : 'Joined group via portal',
    });

    res.json({
      message: waitingSince
        ? `You have been added to the waiting list for ${group.name}.`
        : `You have joined ${group.name}.`,
      waiting: !!waitingSince,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /groups/:groupId/leave ─────────────────────────────────────────────

router.post('/groups/:groupId/leave', async (req, res, next) => {
  try {
    const slug = req.portal.tenantSlug;
    const memberId = req.portal.memberId;
    const { groupId } = req.params;

    const [group] = await tenantQuery(slug, `SELECT id, name FROM groups WHERE id = $1`, [groupId]);
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const [membership] = await tenantQuery(
      slug,
      `SELECT id FROM group_members WHERE group_id = $1 AND member_id = $2`,
      [groupId, memberId],
    );
    if (!membership) {
      return res.status(400).json({ error: 'You are not a member of this group.' });
    }

    await tenantQuery(slug, `DELETE FROM group_members WHERE group_id = $1 AND member_id = $2`, [
      groupId,
      memberId,
    ]);

    // Notify group leader (stubbed)
    await notifyGroupLeaders(slug, groupId, memberId, 'leave', group.name);

    logAudit(slug, {
      userId: null,
      userName: `${req.portal.name} (portal)`,
      action: 'delete',
      entityType: 'group_member',
      entityId: groupId,
      entityName: group.name,
      detail: 'Left group via portal',
    });

    res.json({ message: `You have left ${group.name}.` });
  } catch (err) {
    next(err);
  }
});

export default router;
