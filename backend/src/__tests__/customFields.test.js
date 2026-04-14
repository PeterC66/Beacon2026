// beacon2/backend/src/__tests__/customFields.test.js

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

const SAMPLE_LABELS = {
  custom_field_label_1: 'Hobby',
  custom_field_label_2: 'Skill',
  custom_field_label_3: null,
  custom_field_label_4: null,
};

// ── GET /custom-fields ────────────────────────────────────────────────────

describe('GET /custom-fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with labels', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_LABELS]);
    const res = await request(app).get('/custom-fields').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.label1).toBe('Hobby');
    expect(res.body.label2).toBe('Skill');
    expect(res.body.label3).toBe('');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/custom-fields');
    expect(res.status).toBe(401);
  });

  it('returns 403 without custom_fields:view privilege', async () => {
    const res = await request(app)
      .get('/custom-fields')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── PATCH /custom-fields ──────────────────────────────────────────────────

describe('PATCH /custom-fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with updated labels', async () => {
    tenantQuery.mockResolvedValueOnce([{
      custom_field_label_1: 'Updated',
      custom_field_label_2: 'Skill',
      custom_field_label_3: null,
      custom_field_label_4: null,
    }]);
    const res = await request(app)
      .patch('/custom-fields')
      .set('Authorization', AUTH)
      .send({ label1: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.label1).toBe('Updated');
  });

  it('returns 400 when nothing to update', async () => {
    const res = await request(app)
      .patch('/custom-fields')
      .set('Authorization', AUTH)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).patch('/custom-fields').send({ label1: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 403 without custom_fields:change privilege', async () => {
    const res = await request(app)
      .patch('/custom-fields')
      .set('Authorization', makeAuthHeader({ privileges: ['custom_fields:view'] }))
      .send({ label1: 'X' });
    expect(res.status).toBe(403);
  });
});
