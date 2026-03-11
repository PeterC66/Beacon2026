// beacon2/backend/src/__tests__/polls.test.js

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

const { default: app }    = await import('../app.js');
const { tenantQuery }      = await import('../utils/db.js');

const AUTH = makeAuthHeader();
const SAMPLE_POLL = { id: 'p1', name: 'No TAM', description: 'Does not want TAM', member_can_set: false, member_count: 3 };

// ── GET /polls ──────────────────────────────────────────────────────────────

describe('GET /polls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with poll list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_POLL]);
    const res = await request(app).get('/polls').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('No TAM');
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app).get('/polls').set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── POST /polls ─────────────────────────────────────────────────────────────

describe('POST /polls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a poll', async () => {
    tenantQuery.mockResolvedValueOnce([{ ...SAMPLE_POLL, member_count: 0 }]);
    const res = await request(app)
      .post('/polls')
      .set('Authorization', AUTH)
      .send({ name: 'No TAM', description: 'Does not want TAM', memberCanSet: false });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('No TAM');
  });

  it('returns 422 for missing name', async () => {
    const res = await request(app)
      .post('/polls')
      .set('Authorization', AUTH)
      .send({ name: '', description: '' });
    expect(res.status).toBe(422);
  });

  it('returns 422 when memberCanSet=true but description empty', async () => {
    const res = await request(app)
      .post('/polls')
      .set('Authorization', AUTH)
      .send({ name: 'Test', description: '', memberCanSet: true });
    expect(res.status).toBe(422);
  });
});

// ── PATCH /polls/:id ────────────────────────────────────────────────────────

describe('PATCH /polls/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a poll', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'p1' }]); // exists check
    tenantQuery.mockResolvedValueOnce([{ ...SAMPLE_POLL, name: 'Updated' }]);
    const res = await request(app)
      .patch('/polls/p1')
      .set('Authorization', AUTH)
      .send({ name: 'Updated', description: 'Desc', memberCanSet: false });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('returns 404 for unknown poll', async () => {
    tenantQuery.mockResolvedValueOnce([]); // not found
    const res = await request(app)
      .patch('/polls/unknown')
      .set('Authorization', AUTH)
      .send({ name: 'X', description: '' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /polls/:id ───────────────────────────────────────────────────────

describe('DELETE /polls/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a poll', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'p1' }]); // exists
    tenantQuery.mockResolvedValueOnce([]);              // delete
    const res = await request(app).delete('/polls/p1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
  });

  it('returns 404 for unknown poll', async () => {
    tenantQuery.mockResolvedValueOnce([]); // not found
    const res = await request(app).delete('/polls/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── POST /polls/:id/clear ───────────────────────────────────────────────────

describe('POST /polls/:id/clear', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears all assignments', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'p1' }]);
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).post('/polls/p1/clear').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/cleared/i);
  });
});

// ── POST /polls/:id/members ─────────────────────────────────────────────────

describe('POST /polls/:id/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds members to a poll', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'p1' }]); // exists
    tenantQuery.mockResolvedValueOnce([]);              // insert m1
    tenantQuery.mockResolvedValueOnce([]);              // insert m2
    const res = await request(app)
      .post('/polls/p1/members')
      .set('Authorization', AUTH)
      .send({ memberIds: ['m1', 'm2'] });
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(2);
  });

  it('returns 422 for empty memberIds', async () => {
    const res = await request(app)
      .post('/polls/p1/members')
      .set('Authorization', AUTH)
      .send({ memberIds: [] });
    expect(res.status).toBe(422);
  });
});

// ── PUT /polls/by-member/:memberId ──────────────────────────────────────────

describe('PUT /polls/by-member/:memberId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets polls for a member', async () => {
    tenantQuery.mockResolvedValueOnce([]); // delete existing
    tenantQuery.mockResolvedValueOnce([]); // insert p1
    const res = await request(app)
      .put('/polls/by-member/m1')
      .set('Authorization', AUTH)
      .send({ pollIds: ['p1'] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
