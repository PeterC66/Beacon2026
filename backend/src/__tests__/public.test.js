// beacon2026/backend/src/__tests__/public.test.js
// Coverage for the unauthenticated online-joining and public-page routes
// (routes/public.js), added in Chunk 7 of docs/ImprovementPlan.md. The portal
// login/forgot-password flows are covered separately by portalAuth.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { dbMock, redisMock, auditMock, passwordMock } from './mocks.js';

vi.mock('../utils/redis.js', () => redisMock());
vi.mock('../utils/db.js', () => dbMock({ prisma: { sysTenant: { findUnique: vi.fn() } } }));
vi.mock('../utils/password.js', () => passwordMock());
vi.mock('../utils/audit.js', () => auditMock());

const sgSend = vi.fn().mockResolvedValue(undefined);
vi.mock('@sendgrid/mail', () => ({ default: { setApiKey: vi.fn(), send: sgSend } }));

const { default: app } = await import('../app.js');
const { tenantQuery, prisma } = await import('../utils/db.js');

const SLUG = 'demo';

beforeEach(() => {
  vi.clearAllMocks();
  prisma.sysTenant.findUnique.mockResolvedValue({ slug: SLUG, active: true, name: 'Demo u3a' });
});

// ── Tenant resolution middleware ────────────────────────────────────────────

describe('resolveTenant', () => {
  it('returns 400 for a slug with a hyphen (matches db.js guard)', async () => {
    const res = await request(app).get('/public/bad-slug/join-config');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid tenant slug/i);
  });

  it('returns 404 when the tenant does not exist', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).get('/public/missing/join-config');
    expect(res.status).toBe(404);
  });

  it('returns 404 when the tenant is inactive', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce({ slug: SLUG, active: false, name: 'X' });
    const res = await request(app).get(`/public/${SLUG}/join-config`);
    expect(res.status).toBe(404);
  });
});

// ── GET /:slug/join-config ──────────────────────────────────────────────────

describe('GET /:slug/join-config', () => {
  it('returns joining config with online classes', async () => {
    tenantQuery
      .mockResolvedValueOnce([
        { privacy_policy_url: 'https://x/p', default_town: 'Townville', default_county: 'Shire' },
      ]) // settings
      .mockResolvedValueOnce([{ id: 'c1', name: 'Single', fee: 20, is_joint: false }]); // classes
    const res = await request(app).get(`/public/${SLUG}/join-config`);
    expect(res.status).toBe(200);
    expect(res.body.u3aName).toBe('Demo u3a');
    expect(res.body.classes[0].name).toBe('Single');
    expect(res.body.defaultTown).toBe('Townville');
  });
});

// ── GET /:slug/info ─────────────────────────────────────────────────────────

describe('GET /:slug/info', () => {
  it('returns the u3a name and public contact details', async () => {
    tenantQuery.mockResolvedValueOnce([
      {
        public_phone: '01234 567890',
        public_email: 'info@demo.example',
        home_page: 'https://demo.example',
      },
    ]);
    const res = await request(app).get(`/public/${SLUG}/info`);
    expect(res.status).toBe(200);
    expect(res.body.u3aName).toBe('Demo u3a');
    expect(res.body.publicPhone).toBe('01234 567890');
    expect(res.body.publicEmail).toBe('info@demo.example');
    expect(res.body.homePage).toBe('https://demo.example');
  });

  it('returns empty strings when contact details are unset', async () => {
    tenantQuery.mockResolvedValueOnce([
      { public_phone: null, public_email: null, home_page: null },
    ]);
    const res = await request(app).get(`/public/${SLUG}/info`);
    expect(res.status).toBe(200);
    expect(res.body.publicPhone).toBe('');
    expect(res.body.publicEmail).toBe('');
    expect(res.body.homePage).toBe('');
  });
});

// ── POST /:slug/portal/register ─────────────────────────────────────────────

describe('POST /:slug/portal/register', () => {
  const base = {
    membershipNumber: 101,
    forename: 'Alice',
    surname: 'Smith',
    postcode: 'AB1 2CD',
    email: 'alice@example.com',
    password: 'ValidPass123',
  };
  const matchingMember = {
    id: 'm1',
    forenames: 'Alice',
    surname: 'Smith',
    email: 'alice@example.com',
    postcode: 'AB12CD',
    portal_password_hash: null,
  };

  it('registers a portal account when identity matches', async () => {
    tenantQuery
      .mockResolvedValueOnce([matchingMember]) // member lookup
      .mockResolvedValueOnce([]); // UPDATE credentials
    const res = await request(app).post(`/public/${SLUG}/portal/register`).send(base);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Registration successful/i);
  });

  it('returns 400 when identity details do not match', async () => {
    tenantQuery.mockResolvedValueOnce([{ ...matchingMember, surname: 'Jones' }]);
    const res = await request(app).post(`/public/${SLUG}/portal/register`).send(base);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/do not match/i);
  });

  it('returns 400 when a portal account already exists', async () => {
    tenantQuery.mockResolvedValueOnce([{ ...matchingMember, portal_password_hash: '$existing$' }]);
    const res = await request(app).post(`/public/${SLUG}/portal/register`).send(base);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 422 for a weak password', async () => {
    const res = await request(app)
      .post(`/public/${SLUG}/portal/register`)
      .send({ ...base, password: 'weak' });
    expect(res.status).toBe(422);
  });
});

// ── POST /:slug/portal/verify-email ─────────────────────────────────────────

describe('POST /:slug/portal/verify-email', () => {
  it('verifies a valid, unexpired token', async () => {
    tenantQuery
      .mockResolvedValueOnce([
        {
          id: 'm1',
          forenames: 'Alice',
          surname: 'Smith',
          portal_verification_expires: new Date(Date.now() + 60_000),
        },
      ])
      .mockResolvedValueOnce([]); // UPDATE
    const res = await request(app)
      .post(`/public/${SLUG}/portal/verify-email`)
      .send({ token: 'tok' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/verified/i);
  });

  it('returns 400 for an unknown token', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .post(`/public/${SLUG}/portal/verify-email`)
      .send({ token: 'nope' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an expired token', async () => {
    tenantQuery.mockResolvedValueOnce([
      {
        id: 'm1',
        portal_verification_expires: new Date(Date.now() - 60_000),
      },
    ]);
    const res = await request(app)
      .post(`/public/${SLUG}/portal/verify-email`)
      .send({ token: 'old' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });
});

// ── GET /:slug/groups (public pages) ────────────────────────────────────────

describe('GET /:slug/groups', () => {
  it('returns active groups with config-gated fields hidden by default', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ group_info_config: {} }]) // settings
      .mockResolvedValueOnce([
        { id: 'g1', name: 'Art', status: 'active', when_text: 'Mondays', enquiries: 'x' },
      ]); // groups
    const res = await request(app).get(`/public/${SLUG}/groups`);
    expect(res.status).toBe(200);
    expect(res.body.groups[0].name).toBe('Art');
    // status not public by default → omitted
    expect(res.body.groups[0].status).toBeUndefined();
  });
});

// ── GET /:slug/calendar (public pages) ──────────────────────────────────────

describe('GET /:slug/calendar', () => {
  it('returns calendar data within a date range', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ calendar_config: {} }]) // settings
      .mockResolvedValueOnce([]); // events
    const res = await request(app).get(`/public/${SLUG}/calendar?from=2026-01-01&to=2026-12-31`);
    expect(res.status).toBe(200);
  });
});
