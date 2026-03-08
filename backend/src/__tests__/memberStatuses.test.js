// beacon2/backend/src/__tests__/memberStatuses.test.js

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

const LOCKED_STATUS   = { id: 's1', name: 'Current',   locked: true };
const EDITABLE_STATUS = { id: 's5', name: 'On Holiday', locked: false };

// ── GET /member-statuses ──────────────────────────────────────────────────

describe('GET /member-statuses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with status list', async () => {
    tenantQuery.mockResolvedValueOnce([LOCKED_STATUS, EDITABLE_STATUS]);

    const res = await request(app).get('/member-statuses').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/member-statuses');
    expect(res.status).toBe(401);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .get('/member-statuses')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── POST /member-statuses ─────────────────────────────────────────────────

describe('POST /member-statuses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with new status', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 's6', name: 'Suspended', locked: false }]);

    const res = await request(app)
      .post('/member-statuses')
      .set('Authorization', AUTH)
      .send({ name: 'Suspended' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Suspended');
    expect(res.body.locked).toBe(false);
  });

  it('returns 422 on missing name', async () => {
    const res = await request(app)
      .post('/member-statuses')
      .set('Authorization', AUTH)
      .send({});

    expect(res.status).toBe(422);
  });
});

// ── PATCH /member-statuses/:id ────────────────────────────────────────────

describe('PATCH /member-statuses/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when name updated', async () => {
    tenantQuery.mockResolvedValueOnce([EDITABLE_STATUS]);
    tenantQuery.mockResolvedValueOnce([{ ...EDITABLE_STATUS, name: 'Away' }]);

    const res = await request(app)
      .patch('/member-statuses/s5')
      .set('Authorization', AUTH)
      .send({ name: 'Away' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Away');
  });

  it('returns 409 when status is locked', async () => {
    tenantQuery.mockResolvedValueOnce([LOCKED_STATUS]);

    const res = await request(app)
      .patch('/member-statuses/s1')
      .set('Authorization', AUTH)
      .send({ name: 'Modified' });

    expect(res.status).toBe(409);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .patch('/member-statuses/unknown')
      .set('Authorization', AUTH)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /member-statuses/:id ───────────────────────────────────────────

describe('DELETE /member-statuses/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when deleted', async () => {
    tenantQuery.mockResolvedValueOnce([EDITABLE_STATUS]);
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/member-statuses/s5')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Member status deleted.');
  });

  it('returns 409 when locked', async () => {
    tenantQuery.mockResolvedValueOnce([LOCKED_STATUS]);

    const res = await request(app)
      .delete('/member-statuses/s1')
      .set('Authorization', AUTH);

    expect(res.status).toBe(409);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/member-statuses/unknown')
      .set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});
