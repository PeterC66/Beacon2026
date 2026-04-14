// beacon2/backend/src/__tests__/eventTypes.test.js

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

vi.mock('../utils/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const { default: app } = await import('../app.js');
const { tenantQuery } = await import('../utils/db.js');

const AUTH = makeAuthHeader();

const SAMPLE_EVENT_TYPE = {
  id: 'et-1',
  name: 'Talk',
  description: 'A guest speaker talk',
  is_default: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_TYPE = {
  id: 'et-0',
  name: 'General',
  description: 'Default event type',
  is_default: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── GET /event-types ──────────────────────────────────────────────────────

describe('GET /event-types', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with event types', async () => {
    tenantQuery.mockResolvedValueOnce([DEFAULT_TYPE, SAMPLE_EVENT_TYPE]);
    const res = await request(app).get('/event-types').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('General');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/event-types');
    expect(res.status).toBe(401);
  });

  it('returns 403 without event_types:view', async () => {
    const res = await request(app)
      .get('/event-types')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── POST /event-types ─────────────────────────────────────────────────────

describe('POST /event-types', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 on create', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_EVENT_TYPE]);
    const res = await request(app)
      .post('/event-types')
      .set('Authorization', AUTH)
      .send({ name: 'Talk', description: 'A guest speaker talk' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Talk');
  });

  it('returns 422 with empty name', async () => {
    const res = await request(app)
      .post('/event-types')
      .set('Authorization', AUTH)
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('returns 403 without event_types:create', async () => {
    const res = await request(app)
      .post('/event-types')
      .set('Authorization', makeAuthHeader({ privileges: ['event_types:view'] }))
      .send({ name: 'Talk' });
    expect(res.status).toBe(403);
  });
});

// ── PATCH /event-types/:id ────────────────────────────────────────────────

describe('PATCH /event-types/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 on update', async () => {
    tenantQuery
      .mockResolvedValueOnce([SAMPLE_EVENT_TYPE])   // SELECT existing
      .mockResolvedValueOnce([{ ...SAMPLE_EVENT_TYPE, name: 'Workshop' }]); // UPDATE
    const res = await request(app)
      .patch('/event-types/et-1')
      .set('Authorization', AUTH)
      .send({ name: 'Workshop' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Workshop');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .patch('/event-types/unknown')
      .set('Authorization', AUTH)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when renaming the default type', async () => {
    tenantQuery.mockResolvedValueOnce([DEFAULT_TYPE]);
    const res = await request(app)
      .patch('/event-types/et-0')
      .set('Authorization', AUTH)
      .send({ name: 'New Name' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when nothing to update', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_EVENT_TYPE]);
    const res = await request(app)
      .patch('/event-types/et-1')
      .set('Authorization', AUTH)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── DELETE /event-types/:id ───────────────────────────────────────────────

describe('DELETE /event-types/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 on delete', async () => {
    tenantQuery
      .mockResolvedValueOnce([SAMPLE_EVENT_TYPE])   // SELECT existing
      .mockResolvedValueOnce([{ cnt: 0 }])          // COUNT events
      .mockResolvedValueOnce([]);                    // DELETE
    const res = await request(app)
      .delete('/event-types/et-1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .delete('/event-types/unknown')
      .set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });

  it('returns 400 when deleting the default type', async () => {
    tenantQuery.mockResolvedValueOnce([DEFAULT_TYPE]);
    const res = await request(app)
      .delete('/event-types/et-0')
      .set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 400 when events are using the type', async () => {
    tenantQuery
      .mockResolvedValueOnce([SAMPLE_EVENT_TYPE])
      .mockResolvedValueOnce([{ cnt: 3 }]);
    const res = await request(app)
      .delete('/event-types/et-1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(400);
  });
});
