// beacon2026/backend/src/__tests__/system.test.js
// Coverage for the system (sys-admin) tenant-management routes (routes/system.js),
// added in Chunk 7 of docs/ImprovementPlan.md. The restore route and feature-config
// PATCH are exercised separately by restoreBeacon.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { makeSysAdminHeader, makeAuthHeader } from './helpers.js';
import { dbMock, redisMock, auditMock, passwordMock } from './mocks.js';

vi.mock('../utils/redis.js', () => redisMock());
vi.mock('../utils/db.js', () =>
  dbMock({
    prisma: {
      sysTenant: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      sysAdmin: { findUnique: vi.fn() },
      defaultStandardMessage: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      defaultStandardLetter: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: vi.fn(),
    },
  }),
);
vi.mock('../utils/password.js', () => passwordMock());
vi.mock('../utils/audit.js', () => auditMock());
vi.mock('../seed/createTenant.js', () => ({ createTenantSchema: vi.fn() }));

const { default: app } = await import('../app.js');
const { tenantQuery, prisma } = await import('../utils/db.js');
const { createTenantSchema } = await import('../seed/createTenant.js');

const SYS = makeSysAdminHeader();

beforeEach(() => {
  vi.clearAllMocks();
  // requireSysAdmin re-checks the admin is active on every request.
  prisma.sysAdmin.findUnique.mockResolvedValue({ id: 'admin-1', active: true });
});

// ── Auth guard ──────────────────────────────────────────────────────────────

describe('/system auth guard', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/system/tenants');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a normal (non-sysadmin) user token', async () => {
    const res = await request(app).get('/system/tenants').set('Authorization', makeAuthHeader());
    expect(res.status).toBe(403);
  });

  it('returns 401 when the sys-admin account is deactivated', async () => {
    prisma.sysAdmin.findUnique.mockResolvedValueOnce({ id: 'admin-1', active: false });
    const res = await request(app).get('/system/tenants').set('Authorization', SYS);
    expect(res.status).toBe(401);
  });
});

// ── GET /system/tenants ──────────────────────────────────────────────────────

describe('GET /system/tenants', () => {
  it('returns the tenant list', async () => {
    prisma.sysTenant.findMany.mockResolvedValueOnce([{ id: 't1', name: 'Demo u3a', slug: 'demo' }]);
    const res = await request(app).get('/system/tenants').set('Authorization', SYS);
    expect(res.status).toBe(200);
    expect(res.body[0].slug).toBe('demo');
  });
});

// ── POST /system/tenants ─────────────────────────────────────────────────────

describe('POST /system/tenants', () => {
  const payload = {
    name: 'New u3a',
    slug: 'newu3a',
    adminEmail: 'admin@example.com',
    adminName: 'Admin User',
    adminPassword: 'ValidPass123',
    adminUsername: 'admin',
  };

  it('creates a tenant and returns 201', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce(null); // slug free
    createTenantSchema.mockResolvedValueOnce({ id: 't9', slug: 'newu3a', name: 'New u3a' });
    const res = await request(app).post('/system/tenants').set('Authorization', SYS).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('newu3a');
    expect(createTenantSchema).toHaveBeenCalledOnce();
  });

  it('returns 409 when the slug is already taken', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce({ id: 't1', slug: 'newu3a' });
    const res = await request(app).post('/system/tenants').set('Authorization', SYS).send(payload);
    expect(res.status).toBe(409);
    expect(createTenantSchema).not.toHaveBeenCalled();
  });

  it('returns 422 for an invalid slug', async () => {
    const res = await request(app)
      .post('/system/tenants')
      .set('Authorization', SYS)
      .send({ ...payload, slug: 'Bad-Slug' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for a weak admin password', async () => {
    const res = await request(app)
      .post('/system/tenants')
      .set('Authorization', SYS)
      .send({ ...payload, adminPassword: 'short' });
    expect(res.status).toBe(422);
  });
});

// ── PATCH /system/tenants/:id ────────────────────────────────────────────────

describe('PATCH /system/tenants/:id', () => {
  it('updates name and active flag', async () => {
    prisma.sysTenant.update.mockResolvedValueOnce({ id: 't1', name: 'Renamed', active: false });
    const res = await request(app)
      .patch('/system/tenants/t1')
      .set('Authorization', SYS)
      .send({ name: 'Renamed', active: false });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('returns 422 when active is not a boolean', async () => {
    const res = await request(app)
      .patch('/system/tenants/t1')
      .set('Authorization', SYS)
      .send({ active: 'yes' });
    expect(res.status).toBe(422);
  });
});

// ── DELETE /system/tenants/:id ───────────────────────────────────────────────

describe('DELETE /system/tenants/:id', () => {
  it('drops the schema and removes the tenant', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce({ id: 't1', slug: 'demo', name: 'Demo' });
    prisma.sysTenant.delete.mockResolvedValueOnce({ id: 't1' });
    const res = await request(app).delete('/system/tenants/t1').set('Authorization', SYS);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('DROP SCHEMA IF EXISTS "u3a_demo"'),
    );
  });

  it('returns 404 when the tenant does not exist', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).delete('/system/tenants/unknown').set('Authorization', SYS);
    expect(res.status).toBe(404);
  });
});

// ── POST /system/tenants/:id/set-temp-password ──────────────────────────────

describe('POST /system/tenants/:id/set-temp-password', () => {
  it('bulk-sets the password for all tenant users', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce({ id: 't1', slug: 'demo', name: 'Demo' });
    tenantQuery.mockResolvedValueOnce([
      { username: 'alice', name: 'Alice' },
      { username: 'bob', name: 'Bob' },
    ]);
    const res = await request(app)
      .post('/system/tenants/t1/set-temp-password')
      .set('Authorization', SYS)
      .send({ password: 'Temp1234' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
    expect(res.body.users).toEqual(['alice', 'bob']);
  });

  it('returns 404 when the tenant does not exist', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/system/tenants/unknown/set-temp-password')
      .set('Authorization', SYS)
      .send({ password: 'Temp1234' });
    expect(res.status).toBe(404);
  });

  it('returns 422 when the password is too short', async () => {
    const res = await request(app)
      .post('/system/tenants/t1/set-temp-password')
      .set('Authorization', SYS)
      .send({ password: 'x' });
    expect(res.status).toBe(422);
  });
});

// ── GET/PATCH /system/settings ───────────────────────────────────────────────

describe('/system/settings', () => {
  it('GET returns the singleton system message', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ system_message: 'Hello world' }]);
    const res = await request(app).get('/system/settings').set('Authorization', SYS);
    expect(res.status).toBe(200);
    expect(res.body.systemMessage).toBe('Hello world');
  });

  it('PATCH upserts the system message', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ system_message: 'Updated' }]);
    const res = await request(app)
      .patch('/system/settings')
      .set('Authorization', SYS)
      .send({ systemMessage: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.systemMessage).toBe('Updated');
  });
});

// ── GET /system/tenants/:slug/feature-config ────────────────────────────────

describe('GET /system/tenants/:slug/feature-config', () => {
  it('returns the tenant feature config', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce({ id: 't1', slug: 'demo' });
    tenantQuery.mockResolvedValueOnce([{ feature_config: { finance: false } }]);
    const res = await request(app)
      .get('/system/tenants/demo/feature-config')
      .set('Authorization', SYS);
    expect(res.status).toBe(200);
    expect(res.body.finance).toBe(false);
  });

  it('returns 404 when the tenant does not exist', async () => {
    prisma.sysTenant.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/system/tenants/missing/feature-config')
      .set('Authorization', SYS);
    expect(res.status).toBe(404);
  });
});

// ── Default Standard Emails / Letters (item 11) ─────────────────────────────

describe('/system/default-messages', () => {
  it('GET lists all default messages', async () => {
    prisma.defaultStandardMessage.findMany.mockResolvedValueOnce([
      { id: 'm1', name: 'Welcome', subject: 'Hi', body: 'Hello' },
    ]);
    const res = await request(app).get('/system/default-messages').set('Authorization', SYS);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Welcome');
  });

  it('POST creates a new default message', async () => {
    prisma.defaultStandardMessage.findUnique.mockResolvedValueOnce(null);
    prisma.defaultStandardMessage.create.mockResolvedValueOnce({
      id: 'm1',
      name: 'Welcome',
      subject: 'Hi',
      body: 'Hello',
    });
    const res = await request(app)
      .post('/system/default-messages')
      .set('Authorization', SYS)
      .send({ name: 'Welcome', subject: 'Hi', body: 'Hello' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Welcome');
  });

  it('POST returns 409 when the name is already taken', async () => {
    prisma.defaultStandardMessage.findUnique.mockResolvedValueOnce({ id: 'm1', name: 'Welcome' });
    const res = await request(app)
      .post('/system/default-messages')
      .set('Authorization', SYS)
      .send({ name: 'Welcome', subject: 'Hi', body: 'Hello' });
    expect(res.status).toBe(409);
    expect(prisma.defaultStandardMessage.create).not.toHaveBeenCalled();
  });

  it('POST returns 422 when body is missing', async () => {
    const res = await request(app)
      .post('/system/default-messages')
      .set('Authorization', SYS)
      .send({ name: 'Welcome' });
    expect(res.status).toBe(422);
  });

  it('PATCH updates a default message', async () => {
    prisma.defaultStandardMessage.update.mockResolvedValueOnce({
      id: 'm1',
      name: 'Welcome',
      subject: 'Updated',
      body: 'Hello',
    });
    const res = await request(app)
      .patch('/system/default-messages/m1')
      .set('Authorization', SYS)
      .send({ subject: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Updated');
  });

  it('DELETE removes a default message', async () => {
    prisma.defaultStandardMessage.delete.mockResolvedValueOnce({ id: 'm1' });
    const res = await request(app).delete('/system/default-messages/m1').set('Authorization', SYS);
    expect(res.status).toBe(204);
  });

  it('POST .../rollout returns 404 when the template does not exist', async () => {
    prisma.defaultStandardMessage.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/system/default-messages/missing/rollout')
      .set('Authorization', SYS);
    expect(res.status).toBe(404);
  });

  it('POST .../rollout inserts into tenants missing the template, skips tenants that already have it', async () => {
    prisma.defaultStandardMessage.findUnique.mockResolvedValueOnce({
      id: 'm1',
      name: 'Welcome',
      subject: 'Hi',
      body: 'Hello',
    });
    prisma.sysTenant.findMany.mockResolvedValueOnce([
      { slug: 'stives', name: 'St Ives' },
      { slug: 'demo', name: 'Demo u3a' },
    ]);
    tenantQuery
      .mockResolvedValueOnce([{ id: 'sm1' }]) // stives: created
      .mockResolvedValueOnce([]); // demo: already present, ON CONFLICT DO NOTHING → no rows

    const res = await request(app)
      .post('/system/default-messages/m1/rollout')
      .set('Authorization', SYS);

    expect(res.status).toBe(200);
    expect(res.body.template).toBe('Welcome');
    expect(res.body.results).toEqual([
      { slug: 'stives', name: 'St Ives', created: true },
      { slug: 'demo', name: 'Demo u3a', created: false },
    ]);
    expect(prisma.sysTenant.findMany).toHaveBeenCalledWith({ where: { active: true } });
  });
});

describe('/system/default-letters', () => {
  it('GET lists all default letters', async () => {
    prisma.defaultStandardLetter.findMany.mockResolvedValueOnce([
      { id: 'l1', name: 'Annual Data Check Form', body: '{"type":"doc","content":[]}' },
    ]);
    const res = await request(app).get('/system/default-letters').set('Authorization', SYS);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Annual Data Check Form');
  });

  it('POST creates a new default letter', async () => {
    prisma.defaultStandardLetter.findUnique.mockResolvedValueOnce(null);
    prisma.defaultStandardLetter.create.mockResolvedValueOnce({
      id: 'l1',
      name: 'New Letter',
      body: '{"type":"doc","content":[]}',
    });
    const res = await request(app)
      .post('/system/default-letters')
      .set('Authorization', SYS)
      .send({ name: 'New Letter', body: '{"type":"doc","content":[]}' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Letter');
  });

  it('DELETE removes a default letter', async () => {
    prisma.defaultStandardLetter.delete.mockResolvedValueOnce({ id: 'l1' });
    const res = await request(app).delete('/system/default-letters/l1').set('Authorization', SYS);
    expect(res.status).toBe(204);
  });

  it('POST .../rollout inserts into every tenant missing the letter', async () => {
    prisma.defaultStandardLetter.findUnique.mockResolvedValueOnce({
      id: 'l1',
      name: 'Annual Data Check Form',
      body: '{"type":"doc","content":[]}',
    });
    prisma.sysTenant.findMany.mockResolvedValueOnce([{ slug: 'stives', name: 'St Ives' }]);
    tenantQuery.mockResolvedValueOnce([{ id: 'sl1' }]);

    const res = await request(app)
      .post('/system/default-letters/l1/rollout')
      .set('Authorization', SYS);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([{ slug: 'stives', name: 'St Ives', created: true }]);
  });
});
