// beacon2/backend/src/__tests__/memberClasses.test.js

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

const SAMPLE_CLASS = {
  id: 'mc1', name: 'Individual', current: true, explanation: null,
  is_joint: false, is_associate: false, show_online: false,
  fee: '10.00', gift_aid_fee: null, locked: true,
};

// ── GET /member-classes ───────────────────────────────────────────────────

describe('GET /member-classes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with class list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_CLASS]);

    const res = await request(app).get('/member-classes').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Individual');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/member-classes');
    expect(res.status).toBe(401);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .get('/member-classes')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /member-classes/:id ───────────────────────────────────────────────

describe('GET /member-classes/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with the class', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_CLASS]);

    const res = await request(app).get('/member-classes/mc1').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('mc1');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app).get('/member-classes/unknown').set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});

// ── POST /member-classes ──────────────────────────────────────────────────

describe('POST /member-classes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with the new class', async () => {
    const created = { ...SAMPLE_CLASS, id: 'mc2', name: 'Joint', locked: false };
    tenantQuery.mockResolvedValueOnce([created]);

    const res = await request(app)
      .post('/member-classes')
      .set('Authorization', AUTH)
      .send({ name: 'Joint', isJoint: true });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Joint');
  });

  it('returns 422 on missing name', async () => {
    const res = await request(app)
      .post('/member-classes')
      .set('Authorization', AUTH)
      .send({ current: true });

    expect(res.status).toBe(422);
  });
});

// ── PATCH /member-classes/:id ─────────────────────────────────────────────

describe('PATCH /member-classes/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with updated class', async () => {
    const updated = { ...SAMPLE_CLASS, name: 'Solo', locked: false };
    tenantQuery.mockResolvedValueOnce([updated]);

    const res = await request(app)
      .patch('/member-classes/mc1')
      .set('Authorization', AUTH)
      .send({ name: 'Solo' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Solo');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .patch('/member-classes/mc1')
      .set('Authorization', AUTH)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ── DELETE /member-classes/:id ────────────────────────────────────────────

describe('DELETE /member-classes/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when deleted successfully', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'mc2', locked: false }]);
    tenantQuery.mockResolvedValueOnce([{ n: 0 }]);   // member count check
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/member-classes/mc2')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Membership class deleted.');
  });

  it('returns 409 when class has members assigned', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'mc2', locked: false }]);
    tenantQuery.mockResolvedValueOnce([{ n: 3 }]);  // 3 members assigned

    const res = await request(app)
      .delete('/member-classes/mc2')
      .set('Authorization', AUTH);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/3 members are assigned/);
  });

  it('returns 409 when class is locked', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'mc1', locked: true }]);

    const res = await request(app)
      .delete('/member-classes/mc1')
      .set('Authorization', AUTH);

    expect(res.status).toBe(409);
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/member-classes/unknown')
      .set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});
