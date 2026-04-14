// beacon2/backend/src/__tests__/venues.test.js

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

const SAMPLE_VENUE = {
  id: 'v1',
  name: 'Village Hall',
  contact: 'John Smith',
  address: '1 High Street',
  postcode: 'AB1 2CD',
  telephone: '01onal',
  email: 'hall@example.com',
  website: null,
  notes: null,
  private_address: false,
  accessible: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── GET /venues ───────────────────────────────────────────────────────────

describe('GET /venues', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with venue list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_VENUE]);
    const res = await request(app).get('/venues').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Village Hall');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/venues');
    expect(res.status).toBe(401);
  });

  it('returns 403 without group_venues:view', async () => {
    const res = await request(app)
      .get('/venues')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /venues/:id ──────────────────────────────────────────────────────

describe('GET /venues/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with venue', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_VENUE]);
    const res = await request(app).get('/venues/v1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Village Hall');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).get('/venues/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── POST /venues ──────────────────────────────────────────────────────────

describe('POST /venues', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 on create', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_VENUE]);
    const res = await request(app)
      .post('/venues')
      .set('Authorization', AUTH)
      .send({ name: 'Village Hall' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Village Hall');
  });

  it('returns 422 with empty name', async () => {
    const res = await request(app)
      .post('/venues')
      .set('Authorization', AUTH)
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('returns 403 without group_venues:create', async () => {
    const res = await request(app)
      .post('/venues')
      .set('Authorization', makeAuthHeader({ privileges: ['group_venues:view'] }))
      .send({ name: 'Hall' });
    expect(res.status).toBe(403);
  });
});

// ── PATCH /venues/:id ─────────────────────────────────────────────────────

describe('PATCH /venues/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 on update', async () => {
    tenantQuery.mockResolvedValueOnce([{ ...SAMPLE_VENUE, name: 'Town Hall' }]);
    const res = await request(app)
      .patch('/venues/v1')
      .set('Authorization', AUTH)
      .send({ name: 'Town Hall' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Town Hall');
  });

  it('returns 400 when nothing to update', async () => {
    const res = await request(app)
      .patch('/venues/v1')
      .set('Authorization', AUTH)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .patch('/venues/unknown')
      .set('Authorization', AUTH)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /venues/:id ────────────────────────────────────────────────────

describe('DELETE /venues/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 on delete', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'v1' }])   // SELECT existing
      .mockResolvedValueOnce([]);                // DELETE
    const res = await request(app)
      .delete('/venues/v1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Venue deleted.');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .delete('/venues/unknown')
      .set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});
