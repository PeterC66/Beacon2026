// beacon2/backend/src/__tests__/members.test.js

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

const SAMPLE_MEMBER = {
  id: 'm1', membership_number: 1, title: 'Mr', forenames: 'John', surname: 'Smith',
  known_as: null, initials: 'J', suffix: null, email: 'john@example.com', mobile: null,
  status_id: 'st1', status: 'Current', class_id: 'mc1', class: 'Individual',
  house_no: '10', street: 'High St', town: 'Anytown', postcode: 'AB1 2CD',
  joined_on: '2024-01-01', next_renewal: '2025-01-01', partner_id: null,
};

// ── GET /members ──────────────────────────────────────────────────────────

describe('GET /members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with member list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_MEMBER]);

    const res = await request(app).get('/members').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].surname).toBe('Smith');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/members');
    expect(res.status).toBe(401);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .get('/members')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /members/:id ──────────────────────────────────────────────────────

describe('GET /members/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with full member record', async () => {
    tenantQuery.mockResolvedValueOnce([{ ...SAMPLE_MEMBER, add_line1: null, county: null }]);
    tenantQuery.mockResolvedValueOnce([]);  // poll_ids query

    const res = await request(app).get('/members/m1').set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('m1');
    expect(res.body.forenames).toBe('John');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app).get('/members/unknown').set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});

// ── POST /members ─────────────────────────────────────────────────────────

const VALID_BODY = {
  forenames: 'Jane', surname: 'Doe', statusId: 'st1', classId: 'mc1',
  joinedOn: '2026-01-01',
  address: { houseNo: '5', street: 'Low St', town: 'Somewhere', postcode: 'XY9 0AB' },
};

describe('POST /members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with the new member', async () => {
    // no duplicate check → empty result
    tenantQuery.mockResolvedValueOnce([]);
    // address insert
    tenantQuery.mockResolvedValueOnce([{ id: 'addr1' }]);
    // member insert
    tenantQuery.mockResolvedValueOnce([{ ...SAMPLE_MEMBER, id: 'm2', forenames: 'Jane', surname: 'Doe' }]);

    const res = await request(app)
      .post('/members')
      .set('Authorization', AUTH)
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.surname).toBe('Doe');
  });

  it('returns 409 when name is a duplicate (without ?confirmed=1)', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'm1' }]);   // duplicate found

    const res = await request(app)
      .post('/members')
      .set('Authorization', AUTH)
      .send(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
  });

  it('proceeds past duplicate check when ?confirmed=1', async () => {
    // no dup check called — goes straight to address insert
    tenantQuery.mockResolvedValueOnce([{ id: 'addr1' }]);
    tenantQuery.mockResolvedValueOnce([{ ...SAMPLE_MEMBER, id: 'm3', forenames: 'Jane', surname: 'Doe' }]);

    const res = await request(app)
      .post('/members?confirmed=1')
      .set('Authorization', AUTH)
      .send(VALID_BODY);

    expect(res.status).toBe(201);
  });

  it('returns 422 on missing required fields', async () => {
    const res = await request(app)
      .post('/members')
      .set('Authorization', AUTH)
      .send({ forenames: 'Jane' });   // missing surname + statusId + classId

    expect(res.status).toBe(422);
  });
});

// ── PATCH /members/:id ────────────────────────────────────────────────────

describe('PATCH /members/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 on successful update', async () => {
    // fetch current
    tenantQuery.mockResolvedValueOnce([{ id: 'm1', address_id: 'addr1', forenames: 'John' }]);
    // member update
    tenantQuery.mockResolvedValueOnce([{ id: 'm1', membership_number: 1 }]);

    const res = await request(app)
      .patch('/members/m1')
      .set('Authorization', AUTH)
      .send({ surname: 'Jones' });

    expect(res.status).toBe(200);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .patch('/members/m1')
      .set('Authorization', AUTH)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ── DELETE /members/:id ───────────────────────────────────────────────────

describe('DELETE /members/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when deleted successfully', async () => {
    // fetch member
    tenantQuery.mockResolvedValueOnce([{ id: 'm1', address_id: 'addr1', partner_id: null }]);
    // delete member
    tenantQuery.mockResolvedValueOnce([]);
    // remaining address users count
    tenantQuery.mockResolvedValueOnce([{ n: 0 }]);
    // delete address
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/members/m1')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Member deleted.');
  });

  it('returns 404 when not found', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/members/unknown')
      .set('Authorization', AUTH);

    expect(res.status).toBe(404);
  });
});
