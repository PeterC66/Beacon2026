// beacon2/backend/src/__tests__/portal.test.js
// Coverage for the authenticated Members Portal routes (routes/portal.js),
// mounted at /public/:slug/portal/app/*. Added in Chunk 7 of
// docs/ImprovementPlan.md. Portal *auth* (login/lockout/forgot) lives in
// public.js and is covered by portalAuth.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { signAccessToken } from '../utils/jwt.js';
import { dbMock, redisMock, auditMock } from './mocks.js';

vi.mock('../utils/redis.js', () => redisMock());
vi.mock('../utils/db.js', () => dbMock({ prisma: { sysTenant: { findUnique: vi.fn() } } }));
vi.mock('../utils/audit.js', () => auditMock());

const sgSend = vi.fn().mockResolvedValue(undefined);
vi.mock('@sendgrid/mail', () => ({ default: { setApiKey: vi.fn(), send: sgSend } }));

const { default: app } = await import('../app.js');
const { tenantQuery, prisma } = await import('../utils/db.js');

const SLUG = 'demo';
const BASE = `/public/${SLUG}/portal/app`;

/** Sign a portal JWT for the given member/tenant. */
function portalToken({ tenantSlug = SLUG, memberId = 'm1', name = 'Alice Smith' } = {}) {
  return `Bearer ${signAccessToken({ isPortal: true, tenantSlug, memberId, name })}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.sysTenant.findUnique.mockResolvedValue({ slug: SLUG, active: true, name: 'Demo u3a' });
});

// ── requirePortalAuth ───────────────────────────────────────────────────────

describe('portal auth guard', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get(`${BASE}/home`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-portal (tenant-user) token', async () => {
    const token = `Bearer ${signAccessToken({ userId: 'u1', tenantSlug: SLUG, name: 'X', privileges: [] })}`;
    const res = await request(app).get(`${BASE}/home`).set('Authorization', token);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Not a portal token/i);
  });

  it('returns 403 when the token tenant does not match the URL slug', async () => {
    const res = await request(app)
      .get(`${BASE}/home`)
      .set('Authorization', portalToken({ tenantSlug: 'other' }));
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/does not match/i);
  });

  it('returns 401 when the portal session has been invalidated', async () => {
    const { isSessionInvalidated } = await import('../utils/redis.js');
    isSessionInvalidated.mockResolvedValueOnce(true);
    const res = await request(app).get(`${BASE}/home`).set('Authorization', portalToken());
    expect(res.status).toBe(401);
  });
});

// ── GET /home ───────────────────────────────────────────────────────────────

describe('GET /home', () => {
  it('returns the portal dashboard config and member summary', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ portal_config: { groups: true, renewals: true } }]) // settings
      .mockResolvedValueOnce([
        {
          id: 'm1',
          membership_number: 101,
          forenames: 'Alice',
          surname: 'Smith',
          status_name: 'Current',
        },
      ]); // member
    const res = await request(app).get(`${BASE}/home`).set('Authorization', portalToken());
    expect(res.status).toBe(200);
    expect(res.body.u3aName).toBe('Demo u3a');
    expect(res.body.portalConfig.groups).toBe(true);
    expect(res.body.member.membershipNumber).toBe(101);
    expect(res.body.member.displayName).toBe('Alice');
  });
});

// ── GET /groups ─────────────────────────────────────────────────────────────

describe('GET /groups', () => {
  it('returns active groups when group viewing is enabled', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ portal_config: { groups: true }, group_info_config: {} }]) // settings
      .mockResolvedValueOnce([{ id: 'g1', name: 'Art', status: 'active', member_count: 3 }]) // groups
      .mockResolvedValueOnce([]) // memberships
      .mockResolvedValueOnce([]); // leaders
    const res = await request(app).get(`${BASE}/groups`).set('Authorization', portalToken());
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Art');
  });

  it('returns 403 when group viewing is disabled', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ portal_config: { groups: false } }]) // settings
      .mockResolvedValueOnce([]); // groups (still fetched in the Promise.all)
    const res = await request(app).get(`${BASE}/groups`).set('Authorization', portalToken());
    expect(res.status).toBe(403);
  });
});

// ── GET /personal-details ───────────────────────────────────────────────────

describe('GET /personal-details', () => {
  it('returns the member personal details when enabled', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ portal_config: { personalDetails: true } }]) // settings
      .mockResolvedValueOnce([
        { id: 'm1', forenames: 'Alice', surname: 'Smith', email: 'a@b.com', postcode: 'AB1 2CD' },
      ]); // member
    const res = await request(app)
      .get(`${BASE}/personal-details`)
      .set('Authorization', portalToken());
    expect(res.status).toBe(200);
    expect(res.body.forenames).toBe('Alice');
    expect(res.body.address.postcode).toBe('AB1 2CD');
  });

  it('returns 403 when personal-details editing is disabled', async () => {
    tenantQuery.mockResolvedValueOnce([{ portal_config: { personalDetails: false } }]);
    const res = await request(app)
      .get(`${BASE}/personal-details`)
      .set('Authorization', portalToken());
    expect(res.status).toBe(403);
  });

  it('returns 404 when the member record is missing', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ portal_config: { personalDetails: true } }]) // settings
      .mockResolvedValueOnce([]); // member missing
    const res = await request(app)
      .get(`${BASE}/personal-details`)
      .set('Authorization', portalToken());
    expect(res.status).toBe(404);
  });
});
