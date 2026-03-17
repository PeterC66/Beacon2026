// beacon2/backend/src/__tests__/groups.test.js

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

const SAMPLE_GROUP = {
  id: 'g1', name: 'Watercolour', faculty_id: null, faculty_name: null,
  status: 'active', when_text: 'Every Monday', max_members: null,
  show_addresses: false, member_count: 3, leaders: [],
};

const SAMPLE_GROUP_FULL = {
  ...SAMPLE_GROUP,
  start_time: null, end_time: null, venue: null, enquiries: null,
  allow_online_join: false, enable_waiting_list: false, notify_leader: false,
  display_waiting_list: false, information: null, notes: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};

// ── GET /groups ────────────────────────────────────────────────────────────

describe('GET /groups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with group list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_GROUP]);
    const res = await request(app).get('/groups').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Watercolour');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/groups');
    expect(res.status).toBe(401);
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app).get('/groups').set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /groups/:id ────────────────────────────────────────────────────────

describe('GET /groups/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with full group record', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_GROUP_FULL]);
    const res = await request(app).get('/groups/g1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Watercolour');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).get('/groups/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── POST /groups ───────────────────────────────────────────────────────────

describe('POST /groups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a group and returns 201', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_GROUP_FULL]);
    const res = await request(app).post('/groups').set('Authorization', AUTH).send({ name: 'Watercolour' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Watercolour');
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app).post('/groups').set('Authorization', AUTH).send({});
    expect(res.status).toBe(422);
  });
});

// ── PATCH /groups/:id ──────────────────────────────────────────────────────

describe('PATCH /groups/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a group', async () => {
    tenantQuery.mockResolvedValueOnce([{ ...SAMPLE_GROUP_FULL, name: 'Oils' }]);
    const res = await request(app).patch('/groups/g1').set('Authorization', AUTH).send({ name: 'Oils' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Oils');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app).patch('/groups/g1').set('Authorization', AUTH).send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);  // UPDATE returns empty
    const res = await request(app).patch('/groups/unknown').set('Authorization', AUTH).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /groups/:id ─────────────────────────────────────────────────────

describe('DELETE /groups/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a group', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'g1' }])  // exists check
      .mockResolvedValueOnce([]);              // delete
    const res = await request(app).delete('/groups/g1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).delete('/groups/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── GET /groups/:id/members ────────────────────────────────────────────────

describe('GET /groups/:id/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with member list', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'g1' }])   // group exists
      .mockResolvedValueOnce([{ gm_id: 'gm1', member_id: 'm1', forenames: 'Jane', surname: 'Doe', is_leader: false, waiting_since: null }]);
    const res = await request(app).get('/groups/g1/members').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].surname).toBe('Doe');
  });

  it('returns 404 when group not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).get('/groups/unknown/members').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── POST /groups/:id/members ───────────────────────────────────────────────

describe('POST /groups/:id/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a member by memberId', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'g1' }])                                  // group exists
      .mockResolvedValueOnce([{ id: 'm1', membership_number: 42, forenames: 'Jane', surname: 'Doe' }])  // member lookup
      .mockResolvedValueOnce([])                                               // not already in group
      .mockResolvedValueOnce([{ max_members: null, enable_waiting_list: false, joined_count: 0 }])  // max_members check
      .mockResolvedValueOnce([{ id: 'gm1', group_id: 'g1', member_id: 'm1', is_leader: false, waiting_since: null, created_at: new Date().toISOString() }]);
    const res = await request(app).post('/groups/g1/members').set('Authorization', AUTH).send({ memberId: 'm1' });
    expect(res.status).toBe(201);
    expect(res.body.member_id).toBe('m1');
  });

  it('returns 409 when member already in group', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'g1' }])
      .mockResolvedValueOnce([{ id: 'm1', membership_number: 42, forenames: 'Jane', surname: 'Doe' }])
      .mockResolvedValueOnce([{ id: 'gm1' }]);  // already exists
    const res = await request(app).post('/groups/g1/members').set('Authorization', AUTH).send({ memberId: 'm1' });
    expect(res.status).toBe(409);
  });

  it('returns 422 when body is invalid', async () => {
    const res = await request(app).post('/groups/g1/members').set('Authorization', AUTH).send({});
    expect(res.status).toBe(422);
  });
});

// ── PATCH /groups/:id/members/:memberId ───────────────────────────────────

describe('PATCH /groups/:id/members/:memberId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('makes member a leader', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'gm1', member_id: 'm1', is_leader: true }]);
    const res = await request(app).patch('/groups/g1/members/m1').set('Authorization', AUTH).send({ isLeader: true });
    expect(res.status).toBe(200);
    expect(res.body.is_leader).toBe(true);
  });

  it('returns 404 when group member not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).patch('/groups/g1/members/unknown').set('Authorization', AUTH).send({ isLeader: true });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /groups/:id/members/:memberId ──────────────────────────────────

describe('DELETE /groups/:id/members/:memberId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes a member from group', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'gm1' }]);
    const res = await request(app).delete('/groups/g1/members/m1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).delete('/groups/g1/members/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});
