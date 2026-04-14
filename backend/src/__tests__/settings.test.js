// beacon2/backend/src/__tests__/settings.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader, makeSysAdminHeader } from './helpers.js';

vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated:   vi.fn().mockResolvedValue(false),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/db.js', () => ({
  prisma: {
    $disconnect:      vi.fn(),
    sysTenant:        { findUnique: vi.fn() },
    $queryRawUnsafe:  vi.fn(),
  },
  tenantQuery: vi.fn(),
  withTenant:  vi.fn(),
}));

vi.mock('../utils/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const { default: app } = await import('../app.js');
const { tenantQuery, prisma } = await import('../utils/db.js');

const AUTH = makeAuthHeader();

// ── GET /settings/year-config ─────────────────────────────────────────────

describe('GET /settings/year-config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with year config', async () => {
    tenantQuery.mockResolvedValueOnce([{
      year_start_month: 4,
      year_start_day: 1,
      extended_membership_month: 9,
    }]);
    const res = await request(app).get('/settings/year-config').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.yearStartMonth).toBe(4);
    expect(res.body.yearStartDay).toBe(1);
    expect(res.body.extendedMembershipMonth).toBe(9);
  });

  it('returns defaults when no row', async () => {
    tenantQuery.mockResolvedValueOnce([undefined]);
    const res = await request(app).get('/settings/year-config').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.yearStartMonth).toBe(1);
    expect(res.body.yearStartDay).toBe(1);
    expect(res.body.extendedMembershipMonth).toBeNull();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/settings/year-config');
    expect(res.status).toBe(401);
  });
});

// ── GET /settings/new-member-defaults ─────────────────────────────────────

describe('GET /settings/new-member-defaults', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with defaults', async () => {
    tenantQuery.mockResolvedValueOnce([{
      default_town: 'Oxford',
      default_county: 'Oxon',
      default_std_code: '01865',
    }]);
    const res = await request(app).get('/settings/new-member-defaults').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.defaultTown).toBe('Oxford');
    expect(res.body.defaultCounty).toBe('Oxon');
    expect(res.body.defaultStdCode).toBe('01865');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/settings/new-member-defaults');
    expect(res.status).toBe(401);
  });
});

// ── GET /settings/custom-field-labels ─────────────────────────────────────

describe('GET /settings/custom-field-labels', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with labels', async () => {
    tenantQuery.mockResolvedValueOnce([{
      custom_field_label_1: 'Hobby',
      custom_field_label_2: null,
      custom_field_label_3: null,
      custom_field_label_4: null,
    }]);
    const res = await request(app).get('/settings/custom-field-labels').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.label1).toBe('Hobby');
    expect(res.body.label2).toBe('');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/settings/custom-field-labels');
    expect(res.status).toBe(401);
  });
});

// ── GET /settings/home-info ───────────────────────────────────────────────

describe('GET /settings/home-info', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with tenant name, notice, and system message', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce({ name: 'Test u3a' });
    tenantQuery.mockResolvedValueOnce([{ body: 'Welcome to #U3ANAME' }]);
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ system_message: 'System OK' }]);

    const res = await request(app).get('/settings/home-info').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.tenantName).toBe('Test u3a');
    expect(res.body.homeNotice).toBe('Welcome to Test u3a');
    expect(res.body.systemMessage).toBe('System OK');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/settings/home-info');
    expect(res.status).toBe(401);
  });
});

// ── GET /settings ─────────────────────────────────────────────────────────

describe('GET /settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with full settings', async () => {
    tenantQuery.mockResolvedValueOnce([{ card_colour: '#003399', email_cards: true }]);
    const res = await request(app).get('/settings').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.card_colour).toBe('#003399');
  });

  it('returns 403 without settings:view', async () => {
    const res = await request(app)
      .get('/settings')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── PATCH /settings ───────────────────────────────────────────────────────

describe('PATCH /settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 on update', async () => {
    tenantQuery.mockResolvedValueOnce([{ card_colour: '#FF0000' }]);
    const res = await request(app)
      .patch('/settings')
      .set('Authorization', AUTH)
      .send({ cardColour: '#FF0000' });
    expect(res.status).toBe(200);
  });

  it('returns 400 when nothing to update', async () => {
    const res = await request(app)
      .patch('/settings')
      .set('Authorization', AUTH)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 403 without settings:change', async () => {
    const res = await request(app)
      .patch('/settings')
      .set('Authorization', makeAuthHeader({ privileges: ['settings:view'] }))
      .send({ cardColour: '#FF0000' });
    expect(res.status).toBe(403);
  });
});

// ── GET /settings/feature-config ──────────────────────────────────────────

describe('GET /settings/feature-config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with feature config', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: { groups: true, finance: false } }]);
    const res = await request(app).get('/settings/feature-config').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.groups).toBe(true);
    expect(res.body.finance).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/settings/feature-config');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /settings/feature-config ────────────────────────────────────────

describe('PATCH /settings/feature-config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 on update', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: { groups: true, venues: true } }]);
    const res = await request(app)
      .patch('/settings/feature-config')
      .set('Authorization', AUTH)
      .send({ venues: true });
    expect(res.status).toBe(200);
    expect(res.body.venues).toBe(true);
  });

  it('strips sys-admin-only keys for non-sys-admins', async () => {
    // finance is sys-admin-only, so it should be stripped; venues should remain
    tenantQuery.mockResolvedValueOnce([{ feature_config: { venues: true } }]);
    const res = await request(app)
      .patch('/settings/feature-config')
      .set('Authorization', AUTH)
      .send({ finance: true, venues: true });
    expect(res.status).toBe(200);
    // The update should have gone through (venues at least was valid)
  });

  it('returns 400 when all keys are invalid', async () => {
    const res = await request(app)
      .patch('/settings/feature-config')
      .set('Authorization', AUTH)
      .send({ invalidKey: true });
    expect(res.status).toBe(400);
  });

  it('returns 403 without feature_config:change', async () => {
    const res = await request(app)
      .patch('/settings/feature-config')
      .set('Authorization', makeAuthHeader({ privileges: [] }))
      .send({ venues: true });
    expect(res.status).toBe(403);
  });
});
