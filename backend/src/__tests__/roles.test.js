// beacon2/backend/src/__tests__/roles.test.js
// Tests for /roles endpoints.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader } from './helpers.js';

// ── Module mocks ──────────────────────────────────────────────────────────

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

// ── Fixtures ──────────────────────────────────────────────────────────────

const SAMPLE_ROLE = {
  id: 'r1', name: 'Admin', is_committee: false, notes: null, user_count: 2,
};

// ── GET /roles ────────────────────────────────────────────────────────────

describe('GET /roles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with role list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_ROLE]);

    const res = await request(app).get('/roles').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Admin');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/roles');
    expect(res.status).toBe(401);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .get('/roles')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /roles/:id ────────────────────────────────────────────────────────

describe('GET /roles/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with role and privileges', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'r1', name: 'Admin', is_committee: false, notes: null }])
      .mockResolvedValueOnce([]); // empty privileges

    const res = await request(app).get('/roles/r1').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Admin');
    expect(res.body.privileges).toEqual([]);
  });

  it('returns 404 when role not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app).get('/roles/missing').set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});

// ── POST /roles ───────────────────────────────────────────────────────────

describe('POST /roles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with created role', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'r2', name: 'Treasurer', is_committee: true, notes: null }]);

    const res = await request(app)
      .post('/roles')
      .set('Authorization', AUTH)
      .send({ name: 'Treasurer', isCommittee: true });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Treasurer');
  });

  it('returns 422 on invalid body (empty name)', async () => {
    const res = await request(app)
      .post('/roles')
      .set('Authorization', AUTH)
      .send({ name: '' });

    expect(res.status).toBe(422);
  });
});

// ── PATCH /roles/:id ──────────────────────────────────────────────────────

describe('PATCH /roles/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with updated role', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'r1', name: 'SuperAdmin', is_committee: false, notes: null }]);

    const res = await request(app)
      .patch('/roles/r1')
      .set('Authorization', AUTH)
      .send({ name: 'SuperAdmin' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('SuperAdmin');
  });

  it('returns 400 when nothing to update', async () => {
    const res = await request(app)
      .patch('/roles/r1')
      .set('Authorization', AUTH)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when role not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .patch('/roles/missing')
      .set('Authorization', AUTH)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /roles/:id ─────────────────────────────────────────────────────

describe('DELETE /roles/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when deleted', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'r1' }]);

    const res = await request(app).delete('/roles/r1').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Role deleted.');
  });

  it('returns 404 when role not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app).delete('/roles/ghost').set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});

// ── PUT /roles/:id/privileges ─────────────────────────────────────────────

describe('PUT /roles/:id/privileges', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when privileges updated', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'r1' }])  // role exists check
      .mockResolvedValueOnce([])               // DELETE old privs
      .mockResolvedValueOnce([])               // INSERT priv 1
      .mockResolvedValueOnce([]);              // SELECT affected users

    const res = await request(app)
      .put('/roles/r1/privileges')
      .set('Authorization', AUTH)
      .send({ privileges: [{ resourceId: 'res-1', action: 'view' }] });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  it('returns 404 when role not found', async () => {
    tenantQuery.mockResolvedValueOnce([]); // role does not exist

    const res = await request(app)
      .put('/roles/ghost/privileges')
      .set('Authorization', AUTH)
      .send({ privileges: [] });

    expect(res.status).toBe(404);
  });
});
