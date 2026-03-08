// beacon2/backend/src/__tests__/faculties.test.js

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
const SAMPLE_FACULTY = { id: 'f1', name: 'Art & Literature', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

// ── GET /faculties ─────────────────────────────────────────────────────────

describe('GET /faculties', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with faculty list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_FACULTY]);
    const res = await request(app).get('/faculties').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Art & Literature');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/faculties');
    expect(res.status).toBe(401);
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app).get('/faculties').set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── POST /faculties ────────────────────────────────────────────────────────

describe('POST /faculties', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a faculty and returns 201', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_FACULTY]);
    const res = await request(app).post('/faculties').set('Authorization', AUTH).send({ name: 'Art & Literature' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Art & Literature');
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app).post('/faculties').set('Authorization', AUTH).send({});
    expect(res.status).toBe(422);
  });
});

// ── PATCH /faculties/:id ───────────────────────────────────────────────────

describe('PATCH /faculties/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a faculty', async () => {
    tenantQuery
      .mockResolvedValueOnce([SAMPLE_FACULTY])  // exists check
      .mockResolvedValueOnce([{ id: 'f1', name: 'Walking' }]);  // update
    const res = await request(app).patch('/faculties/f1').set('Authorization', AUTH).send({ name: 'Walking' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Walking');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).patch('/faculties/unknown').set('Authorization', AUTH).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /faculties/:id ──────────────────────────────────────────────────

describe('DELETE /faculties/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a faculty', async () => {
    tenantQuery
      .mockResolvedValueOnce([SAMPLE_FACULTY])  // exists check
      .mockResolvedValueOnce([]);               // delete
    const res = await request(app).delete('/faculties/f1').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app).delete('/faculties/unknown').set('Authorization', AUTH);
    expect(res.status).toBe(404);
  });
});
