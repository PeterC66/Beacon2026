// beacon2/backend/src/__tests__/addressExport.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader } from './helpers.js';

vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated:   vi.fn().mockResolvedValue(false),
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/db.js', () => ({
  prisma:      { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant:  vi.fn(),
}));

const { default: app } = await import('../app.js');
const { tenantQuery } = await import('../utils/db.js');

const AUTH = makeAuthHeader();

const SAMPLE_MEMBER = {
  id: 'm1',
  title: 'Mr',
  forenames: 'John',
  known_as: null,
  surname: 'Smith',
  email: 'john@example.com',
  mobile: null,
  status_id: 's1',
  class_id: 'c1',
  membership_number: '001',
  address_id: 'a1',
  house_no: '10',
  street: 'High Street',
  add_line1: null,
  add_line2: null,
  town: 'Oxford',
  county: 'Oxon',
  postcode: 'OX1 1AA',
  telephone: '01865 123456',
};

// ── GET /address-export ───────────────────────────────────────────────────

describe('GET /address-export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with member list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]);
    const res = await request(app).get('/address-export').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].surname).toBe('Smith');
  });

  it('returns empty array when no members match', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).get('/address-export').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/address-export');
    expect(res.status).toBe(401);
  });

  it('returns 403 without addresses_export:view', async () => {
    const res = await request(app)
      .get('/address-export')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /address-export/download ──────────────────────────────────────────

describe('GET /address-export/download', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when no members selected', async () => {
    const res = await request(app)
      .get('/address-export/download')
      .set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns CSV when format=csv', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]);
    const res = await request(app)
      .get('/address-export/download?format=csv&ids=m1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('Smith');
  });

  it('returns TSV when format=tsv', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]);
    const res = await request(app)
      .get('/address-export/download?format=tsv&ids=m1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Smith');
  });

  it('returns Excel when format=excel', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]);
    const res = await request(app)
      .get('/address-export/download?format=excel&ids=m1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  it('returns 403 without addresses_export:download', async () => {
    const res = await request(app)
      .get('/address-export/download?ids=m1')
      .set('Authorization', makeAuthHeader({ privileges: ['addresses_export:view'] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /address-export/labels ────────────────────────────────────────────

describe('GET /address-export/labels', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when no members selected', async () => {
    const res = await request(app)
      .get('/address-export/labels')
      .set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns PDF when members provided', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]);
    const res = await request(app)
      .get('/address-export/labels?ids=m1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('returns 403 without address_labels:download', async () => {
    const res = await request(app)
      .get('/address-export/labels?ids=m1')
      .set('Authorization', makeAuthHeader({ privileges: ['addresses_export:view'] }));
    expect(res.status).toBe(403);
  });
});
