// beacon2/backend/src/__tests__/restoreBeacon.test.js
// Verifies the "Standard Beacon Implementation" preset is applied at the end
// of a legacy Beacon restore, and that the shared feature-key constants are
// used consistently by the sys-admin PATCH allowlist.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { makeSysAdminHeader } from './helpers.js';

vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated:   vi.fn().mockResolvedValue(false),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/db.js', () => ({
  prisma: {
    $disconnect:     vi.fn(),
    sysTenant:       { findUnique: vi.fn() },
    $queryRawUnsafe: vi.fn(),
    $transaction:    vi.fn(),
  },
  tenantQuery: vi.fn(),
  withTenant:  vi.fn(),
}));

vi.mock('../utils/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const { ALL_FEATURE_KEYS, STANDARD_IMPLEMENTATIONS } = await import('../../../shared/constants.js');
const { restoreBeacon } = await import('../routes/backup.js');
const { default: app } = await import('../app.js');
const { tenantQuery, prisma } = await import('../utils/db.js');

// ── STANDARD_IMPLEMENTATIONS shape ───────────────────────────────────────

describe('STANDARD_IMPLEMENTATIONS', () => {
  it('has a first entry named "Beacon Migration Default"', () => {
    const first = STANDARD_IMPLEMENTATIONS[0];
    expect(first.name).toBe('Beacon Migration Default');
    expect(typeof first.description).toBe('string');
    expect(first.description.length).toBeGreaterThan(0);
  });

  it('has a features object with every key in ALL_FEATURE_KEYS', () => {
    const features = STANDARD_IMPLEMENTATIONS[0].features;
    for (const key of ALL_FEATURE_KEYS) {
      expect(features).toHaveProperty(key);
      expect(typeof features[key]).toBe('boolean');
    }
    expect(Object.keys(features)).toHaveLength(ALL_FEATURE_KEYS.length);
  });

  it('enables every feature except SiteWorks Integration and Custom Fields', () => {
    const features = STANDARD_IMPLEMENTATIONS[0].features;
    expect(features.siteworks).toBe(false);
    expect(features.customFields).toBe(false);
    for (const key of ALL_FEATURE_KEYS) {
      if (key === 'siteworks' || key === 'customFields') continue;
      expect(features[key]).toBe(true);
    }
  });

  it('includes eventAttendance in ALL_FEATURE_KEYS', () => {
    expect(ALL_FEATURE_KEYS).toContain('eventAttendance');
  });
});

// ── restoreBeacon writes feature_config ───────────────────────────────────

describe('restoreBeacon()', () => {
  it('ends by writing STANDARD_IMPLEMENTATIONS[0].features to feature_config', async () => {
    // Empty workbook — all sheetRows() calls return [], so every INSERT loop
    // iterates zero times.  The tail still runs the feature_config UPDATE.
    const wb = new ExcelJS.Workbook();
    const calls = [];
    const tx = {
      $executeRawUnsafe: vi.fn(async (...args) => { calls.push(args); }),
    };

    await restoreBeacon(tx, wb);

    const featureCall = calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('feature_config = $1::jsonb'));
    expect(featureCall).toBeTruthy();

    const writtenJson = JSON.parse(featureCall[1]);
    expect(writtenJson).toEqual(STANDARD_IMPLEMENTATIONS[0].features);
  });

  it('creates the default "Open Meetings" event type', async () => {
    const wb = new ExcelJS.Workbook();
    const calls = [];
    const tx = {
      $executeRawUnsafe: vi.fn(async (...args) => { calls.push(args); }),
    };

    await restoreBeacon(tx, wb);

    const omCall = calls.find((c) =>
      typeof c[0] === 'string' &&
      c[0].includes('INSERT INTO event_types') &&
      c[0].includes("'Open Meetings'") &&
      c[0].includes('true'));
    expect(omCall).toBeTruthy();
    // Second arg should be the generated UUID for the event type
    expect(typeof omCall[1]).toBe('string');
    expect(omCall[1].length).toBeGreaterThan(0);
  });

  it('restores Calendar rows without a gkey as open meetings linked to the Open Meetings event type', async () => {
    const wb = new ExcelJS.Workbook();
    const cal = wb.addWorksheet('Calendar');
    cal.addRow(['ckey', 'date/time', 'end_time', 'gkey', 'group', 'gvkey',
                'venue', 'topic', 'detail', 'enquiries', 'exclude_public']);
    // Open meeting (gkey empty)
    cal.addRow(['c1', '2024-06-15 19:00', '21:00', '', '', '',
                '', 'AGM', 'Annual General Meeting', 'chair@example.com', '']);
    // Group event (gkey set) — should NOT be restored here
    cal.addRow(['c2', '2024-06-20 10:00', '12:00', 'g1', 'Walking', '',
                '', 'Walk', 'Weekly walk', 'leader@example.com', '']);
    // Private open meeting
    cal.addRow(['c3', '2024-07-01 14:00', '16:00', '', '', '',
                '', 'Private planning', '', '', '1']);

    const calls = [];
    let omEventTypeId = null;
    const tx = {
      $executeRawUnsafe: vi.fn(async (sql, ...params) => {
        calls.push([sql, ...params]);
        if (typeof sql === 'string' &&
            sql.includes('INSERT INTO event_types') &&
            sql.includes("'Open Meetings'")) {
          omEventTypeId = params[0];
        }
      }),
    };

    await restoreBeacon(tx, wb);

    expect(omEventTypeId).toBeTruthy();

    const openMeetingInserts = calls.filter((c) =>
      typeof c[0] === 'string' &&
      c[0].includes('INSERT INTO group_events') &&
      c[0].includes('NULL'));
    expect(openMeetingInserts).toHaveLength(2);

    // Event type id parameter is the last one — confirm both link to Open Meetings
    for (const call of openMeetingInserts) {
      const params = call.slice(1);
      expect(params[params.length - 1]).toBe(omEventTypeId);
    }

    // First open meeting: date, times, topic, details, contact, not private
    const firstParams = openMeetingInserts[0].slice(1);
    // params: [id, event_date, start_time, end_time, venue_id, contact, details, topic, is_private, event_type_id]
    expect(firstParams[1]).toBe('2024-06-15');
    expect(firstParams[2]).toBe('19:00');
    expect(firstParams[3]).toBe('21:00');
    expect(firstParams[5]).toBe('chair@example.com');
    expect(firstParams[6]).toBe('Annual General Meeting');
    expect(firstParams[7]).toBe('AGM');
    expect(firstParams[8]).toBe(false);

    // Third row: exclude_public = '1' → is_private = true
    const thirdParams = openMeetingInserts[1].slice(1);
    expect(thirdParams[7]).toBe('Private planning');
    expect(thirdParams[8]).toBe(true);
  });
});

// ── Sys-admin PATCH accepts eventAttendance (closes pre-existing drift) ───

describe('PATCH /system/tenants/:slug/feature-config (sys admin)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts eventAttendance and persists it', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce({ slug: 'demo' });
    tenantQuery.mockResolvedValueOnce([{ feature_config: { eventAttendance: false } }]);

    const res = await request(app)
      .patch('/system/tenants/demo/feature-config')
      .set('Authorization', makeSysAdminHeader())
      .send({ eventAttendance: false });

    expect(res.status).toBe(200);
    expect(res.body.eventAttendance).toBe(false);

    // Confirm the UPDATE SQL carried eventAttendance through (not stripped)
    const updateCall = tenantQuery.mock.calls.find((c) =>
      typeof c[1] === 'string' && c[1].includes('UPDATE tenant_settings SET feature_config'));
    expect(updateCall).toBeTruthy();
    expect(JSON.parse(updateCall[2][0])).toEqual({ eventAttendance: false });
  });
});
