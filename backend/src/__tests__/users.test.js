// beacon2/backend/src/__tests__/users.test.js
// Tests for /users endpoints.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeAuthHeader, TEST_TENANT, TEST_USER_ID } from './helpers.js';

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

// Mock bcrypt to avoid expensive hashing in tests
vi.mock('../utils/password.js', () => ({
  hashPassword:   vi.fn().mockResolvedValue('$hashed$'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

const { default: app } = await import('../app.js');
const { tenantQuery } = await import('../utils/db.js');

const AUTH = makeAuthHeader();

// ── Fixtures ──────────────────────────────────────────────────────────────

const SAMPLE_USER = {
  id: 'u1', name: 'Alice', email: 'alice@example.com', active: true,
  is_site_admin: false, member_id: 'm1', member_name: 'Alice Smith',
  roles: [],
};

// ── GET /users ────────────────────────────────────────────────────────────

describe('GET /users', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with user list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_USER]);

    const res = await request(app).get('/users').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Alice');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 when privilege is missing', async () => {
    const res = await request(app)
      .get('/users')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /users/:id ────────────────────────────────────────────────────────

describe('GET /users/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with a single user', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_USER]);

    const res = await request(app).get('/users/u1').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@example.com');
  });

  it('returns 404 when user does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]); // empty = not found

    const res = await request(app).get('/users/missing-id').set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});

// ── POST /users ───────────────────────────────────────────────────────────

describe('POST /users', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with the created user', async () => {
    // 1. member lookup
    tenantQuery.mockResolvedValueOnce([{ id: 'm1', forenames: 'Bob', surname: 'Smith', email: 'bob@example.com', status_name: 'Current' }]);
    // 2. check not already a user
    tenantQuery.mockResolvedValueOnce([]);
    // 3. insert user
    tenantQuery.mockResolvedValueOnce([{ id: 'u2', email: 'bob@example.com', username: 'bsmith', name: 'Bob Smith', active: true, member_id: 'm1' }]);

    const res = await request(app)
      .post('/users')
      .set('Authorization', AUTH)
      .send({ memberId: 'm1', username: 'bsmith' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Bob Smith');
    expect(res.body.tempPassword).toBeTruthy();
  });

  it('returns 422 on invalid body', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', AUTH)
      .send({ name: 'Bad' }); // missing memberId and username

    expect(res.status).toBe(422);
  });
});

// ── PATCH /users/:id ──────────────────────────────────────────────────────

describe('PATCH /users/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with updated user', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'u1', email: 'alice@example.com', username: 'asmith', name: 'Alice', active: false, member_id: 'm1' }]);

    const res = await request(app)
      .patch('/users/u1')
      .set('Authorization', AUTH)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it('returns 400 when body has nothing to update', async () => {
    const res = await request(app)
      .patch('/users/u1')
      .set('Authorization', AUTH)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when user does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]); // UPDATE returns nothing

    const res = await request(app)
      .patch('/users/missing')
      .set('Authorization', AUTH)
      .send({ active: false });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /users/:id ─────────────────────────────────────────────────────

describe('DELETE /users/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when deleted', async () => {
    // 1. site admin check
    tenantQuery.mockResolvedValueOnce([{ is_site_admin: false }]);
    // 2. admin role check
    tenantQuery.mockResolvedValueOnce([{ total_admins: '2', is_admin: '0' }]);
    // 3. delete
    tenantQuery.mockResolvedValueOnce([{ id: 'u2', name: 'Bob' }]);

    const res = await request(app)
      .delete('/users/u2')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User deleted.');
  });

  it('returns 400 when trying to self-delete', async () => {
    const res = await request(app)
      .delete(`/users/${TEST_USER_ID}`)
      .set('Authorization', AUTH);

    expect(res.status).toBe(400);
  });

  it('returns 400 when deleting the site administrator', async () => {
    // site admin check returns true
    tenantQuery.mockResolvedValueOnce([{ is_site_admin: true }]);

    const res = await request(app)
      .delete('/users/u-admin')
      .set('Authorization', AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Site Administrator/i);
  });

  it('returns 400 when deleting the last admin', async () => {
    // 1. site admin check
    tenantQuery.mockResolvedValueOnce([{ is_site_admin: false }]);
    // 2. admin check: user is the only admin
    tenantQuery.mockResolvedValueOnce([{ total_admins: '1', is_admin: '1' }]);

    const res = await request(app)
      .delete('/users/u-admin2')
      .set('Authorization', AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last user/i);
  });

  it('returns 404 when user does not exist', async () => {
    // 1. site admin check
    tenantQuery.mockResolvedValueOnce([{ is_site_admin: false }]);
    // 2. admin check: not an admin
    tenantQuery.mockResolvedValueOnce([{ total_admins: '2', is_admin: '0' }]);
    // 3. delete returns nothing
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/users/ghost')
      .set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});

// ── POST /users/:id/set-temp-password ────────────────────────────────────

describe('POST /users/:id/set-temp-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with a temporary password', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'u1', name: 'Alice' }]);

    const res = await request(app)
      .post('/users/u1/set-temp-password')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.tempPassword).toBeTruthy();
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(8);
  });

  it('returns 404 when user does not exist', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/users/missing/set-temp-password')
      .set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});

// ── POST /users/:id/roles ─────────────────────────────────────────────────

describe('POST /users/:id/roles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when role assigned', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/users/u1/roles')
      .set('Authorization', AUTH)
      .send({ roleId: 'role-1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Role assigned.');
  });
});

// ── DELETE /users/:id/roles/:roleId ──────────────────────────────────────

describe('DELETE /users/:id/roles/:roleId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when role removed', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/users/u1/roles/role-1')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Role removed.');
  });
});
