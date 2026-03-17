// beacon2/backend/src/__tests__/offices.test.js
// Tests for /offices endpoints.

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

const SAMPLE_OFFICE = {
  id: 'o1', name: 'Chairman', member_id: 'm1', office_email: null,
  notify_online_join: false, member_forenames: 'John', member_surname: 'Smith',
  member_status: 'Current',
};

// ── GET /offices ───────────────────────────────────────────────────────────

describe('GET /offices', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with office list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_OFFICE]);

    const res = await request(app).get('/offices').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Chairman');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/offices');
    expect(res.status).toBe(401);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .get('/offices')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /offices/members ───────────────────────────────────────────────────

describe('GET /offices/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with member list', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'm1', forenames: 'John', surname: 'Smith', status: 'Current' }]);

    const res = await request(app).get('/offices/members').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body[0].surname).toBe('Smith');
  });
});

// ── POST /offices ──────────────────────────────────────────────────────────

describe('POST /offices', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates office and returns 201', async () => {
    const created = { id: 'o2', name: 'Secretary', member_id: null, office_email: null, notify_online_join: false };
    tenantQuery.mockResolvedValueOnce([created]);

    const res = await request(app)
      .post('/offices')
      .set('Authorization', AUTH)
      .send({ name: 'Secretary', notifyOnlineJoin: false });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Secretary');
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app)
      .post('/offices')
      .set('Authorization', AUTH)
      .send({ notifyOnlineJoin: false });

    expect(res.status).toBe(422);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .post('/offices')
      .set('Authorization', makeAuthHeader({ privileges: [] }))
      .send({ name: 'Secretary', notifyOnlineJoin: false });

    expect(res.status).toBe(403);
  });
});

// ── PATCH /offices/:id ─────────────────────────────────────────────────────

describe('PATCH /offices/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates office and returns 200', async () => {
    const updated = { id: 'o1', name: 'Vice Chairman', member_id: null, office_email: null, notify_online_join: false };
    tenantQuery.mockResolvedValueOnce([{ id: 'o1' }]); // exists check
    tenantQuery.mockResolvedValueOnce([updated]);       // update

    const res = await request(app)
      .patch('/offices/o1')
      .set('Authorization', AUTH)
      .send({ name: 'Vice Chairman', notifyOnlineJoin: false });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Vice Chairman');
  });

  it('returns 404 when office not found', async () => {
    tenantQuery.mockResolvedValueOnce([]); // not found

    const res = await request(app)
      .patch('/offices/missing')
      .set('Authorization', AUTH)
      .send({ name: 'Vice Chairman', notifyOnlineJoin: false });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /offices/:id ────────────────────────────────────────────────────

describe('DELETE /offices/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes office and returns 200', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'o1' }]); // exists check
    tenantQuery.mockResolvedValueOnce([]);              // delete

    const res = await request(app)
      .delete('/offices/o1')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when office not found', async () => {
    tenantQuery.mockResolvedValueOnce([]); // not found

    const res = await request(app)
      .delete('/offices/missing')
      .set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});
