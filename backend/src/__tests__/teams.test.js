// beacon2026/backend/src/__tests__/teams.test.js
// Coverage for the teams router (routes/teams/), added in Chunk 7 of
// docs/ImprovementPlan.md. Teams reuse the `groups` table (type = 'team').

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader } from './helpers.js';
import { dbMock, redisMock, auditMock } from './mocks.js';

vi.mock('../utils/redis.js', () => redisMock());
vi.mock('../utils/db.js', () => dbMock());
vi.mock('../utils/audit.js', () => auditMock());

const { default: app } = await import('../app.js');
const { tenantQuery } = await import('../utils/db.js');
const { logAudit } = await import('../utils/audit.js');

const AUTH = makeAuthHeader();

beforeEach(() => vi.clearAllMocks());

// ── GET /teams ────────────────────────────────────────────────────────────

describe('GET /teams', () => {
  it('returns the team list', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'tm1', name: 'Walking Team', status: 'active', member_count: 4, leaders: [] },
    ]);
    const res = await request(app).get('/teams').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Walking Team');
    // The list query must be scoped to team-type groups
    expect(tenantQuery.mock.calls[0][1]).toMatch(/g\.type = 'team'/);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/teams');
    expect(res.status).toBe(401);
  });

  it('returns 403 without the privilege', async () => {
    const res = await request(app)
      .get('/teams')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /teams/:id ────────────────────────────────────────────────────────

describe('GET /teams/:id', () => {
  it('returns a single team', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'tm1', name: 'Walking Team', type: 'team' }]);
    const res = await request(app).get('/teams/tm1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('tm1');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).get('/teams/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── POST /teams ───────────────────────────────────────────────────────────

describe('POST /teams', () => {
  it('creates a team and audits it', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'tm2', name: 'New Team' }]);
    const res = await request(app)
      .post('/teams')
      .set('Authorization', AUTH)
      .send({ name: 'New Team' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('tm2');
    expect(logAudit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'create', entityType: 'team' }),
    );
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app).post('/teams').set('Authorization', AUTH).send({});
    expect(res.status).toBe(422);
  });

  it('returns 403 without the create privilege', async () => {
    const res = await request(app)
      .post('/teams')
      .set('Authorization', makeAuthHeader({ privileges: ['group_records_all:view'] }))
      .send({ name: 'New Team' });
    expect(res.status).toBe(403);
  });
});

// ── PATCH /teams/:id ──────────────────────────────────────────────────────

describe('PATCH /teams/:id', () => {
  it('updates a team', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'tm1', name: 'Renamed Team' }]);
    const res = await request(app)
      .patch('/teams/tm1')
      .set('Authorization', AUTH)
      .send({ name: 'Renamed Team' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Team');
    expect(logAudit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'update', entityType: 'team' }),
    );
  });

  it('returns 400 when there is nothing to update', async () => {
    const res = await request(app).patch('/teams/tm1').set('Authorization', AUTH).send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when the team does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]); // UPDATE ... RETURNING empty
    const res = await request(app)
      .patch('/teams/unknown')
      .set('Authorization', AUTH)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /teams/:id ─────────────────────────────────────────────────────

describe('DELETE /teams/:id', () => {
  it('deletes an existing team', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'tm1', name: 'Walking Team' }]) // existence check
      .mockResolvedValueOnce([]); // DELETE
    const res = await request(app).delete('/teams/tm1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
    expect(logAudit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'delete', entityType: 'team' }),
    );
  });

  it('returns 404 when the team does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).delete('/teams/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── GET /teams/:id/members ────────────────────────────────────────────────

describe('GET /teams/:id/members', () => {
  it('returns the member list', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'tm1' }]) // team exists
      .mockResolvedValueOnce([{ gm_id: 'gm1', member_id: 'm1', surname: 'Smith' }]);
    const res = await request(app).get('/teams/tm1/members').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].member_id).toBe('m1');
  });

  it('returns 404 when the team does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]); // team missing
    const res = await request(app).get('/teams/unknown/members').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

// ── Team events ───────────────────────────────────────────────────────────

describe('GET /teams/:id/events', () => {
  it('returns events for a team', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'tm1' }]) // team exists
      .mockResolvedValueOnce([{ id: 'ev1', topic: 'Practice', group_type: 'team' }]);
    const res = await request(app).get('/teams/tm1/events').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('ev1');
  });

  it('returns 404 when the team does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).get('/teams/unknown/events').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});

describe('POST /teams/:id/events', () => {
  it('creates a single event', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'tm1' }]) // team exists
      .mockResolvedValueOnce([{ id: 'ev1', event_date: '2026-04-01' }]); // INSERT
    const res = await request(app)
      .post('/teams/tm1/events')
      .set('Authorization', AUTH)
      .send({ eventDate: '2026-04-01', topic: 'Practice' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
  });

  it('expands a recurring event into multiple rows', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'tm1' }]); // team exists
    // Three weekly events: 1st, 8th, 15th April
    tenantQuery
      .mockResolvedValueOnce([{ id: 'e1' }])
      .mockResolvedValueOnce([{ id: 'e2' }])
      .mockResolvedValueOnce([{ id: 'e3' }]);
    const res = await request(app).post('/teams/tm1/events').set('Authorization', AUTH).send({
      eventDate: '2026-04-01',
      repeatEvery: 1,
      repeatUnit: 'weeks',
      repeatUntil: '2026-04-15',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(3);
  });

  it('returns 404 when the team does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .post('/teams/unknown/events')
      .set('Authorization', AUTH)
      .send({ eventDate: '2026-04-01' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /teams/:id/events', () => {
  it('bulk-deletes selected events', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'e1' }, { id: 'e2' }]);
    const res = await request(app)
      .delete('/teams/tm1/events')
      .set('Authorization', AUTH)
      .send({ ids: ['e1', 'e2'] });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);
  });
});
