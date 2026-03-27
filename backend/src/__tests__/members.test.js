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
  joinedOn: '2026-01-01', nextRenewal: '2027-01-01',
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
    tenantQuery.mockResolvedValueOnce([{ ...SAMPLE_MEMBER, id: 'm2', forenames: 'Jane', surname: 'Doe', email: 'jane@example.com' }]);
    // no payment → look up Current status
    tenantQuery.mockResolvedValueOnce([{ id: 'st1' }]);
    // look up Applicant status
    tenantQuery.mockResolvedValueOnce([{ id: 'st-applicant' }]);
    // update member to Applicant + payment_token
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/members')
      .set('Authorization', AUTH)
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.surname).toBe('Doe');
    expect(res.body.paymentToken).toBeTruthy();
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
    // no payment → look up Current status
    tenantQuery.mockResolvedValueOnce([{ id: 'st1' }]);
    // look up Applicant status
    tenantQuery.mockResolvedValueOnce([{ id: 'st-applicant' }]);
    // update member to Applicant + payment_token
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/members?confirmed=1')
      .set('Authorization', AUTH)
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.paymentToken).toBeTruthy();
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

// ── GET /members/recent ────────────────────────────────────────────────────

describe('GET /members/recent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with recent members', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'm1', forenames: 'John', surname: 'Smith', joined_on: '2026-03-01', class_name: 'Individual', status_name: 'Current' },
    ]);
    const res = await request(app)
      .get('/members/recent?from=2026-03-01&to=2026-03-19')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].surname).toBe('Smith');
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .get('/members/recent')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /members/statistics ────────────────────────────────────────────────

describe('GET /members/statistics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with statistics', async () => {
    // settings
    tenantQuery.mockResolvedValueOnce([{ year_start_month: 1, year_start_day: 1, advance_renewals_weeks: 4, grace_lapse_weeks: 4 }]);
    // classStats
    tenantQuery.mockResolvedValueOnce([{ id: 'mc1', name: 'Individual', total: 5, with_email: 4, first_year: 2, second_year_plus: 3 }]);
    // statusCounts
    tenantQuery.mockResolvedValueOnce([{ current_not_renewed: 1, lapsed_count: 2 }]);
    // groupStats
    tenantQuery.mockResolvedValueOnce([{ active_groups: 3, avg_members: '8.5' }]);
    // notInGroup
    tenantQuery.mockResolvedValueOnce([{ count: 2 }]);
    // renewStats
    tenantQuery.mockResolvedValueOnce([{ id: 'mc1', name: 'Individual', not_renewed: 1, new_members: 2 }]);

    const res = await request(app)
      .get('/members/statistics')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.activeGroups).toBe(3);
    expect(res.body.totalCurrent).toBe(5);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .get('/members/statistics')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /members/renewals ──────────────────────────────────────────────────

describe('GET /members/renewals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with renewal list and year boundaries', async () => {
    tenantQuery.mockResolvedValueOnce([{ year_start_month: 1, year_start_day: 1, advance_renewals_weeks: 4 }]);
    tenantQuery.mockResolvedValueOnce([
      { id: 'm1', forenames: 'John', surname: 'Smith', class_name: 'Individual', status_name: 'Current', next_renewal: '2026-01-01', fee: '25.00', gift_aid_fee: '20.00', gift_aid_from: null, partner_id: null },
    ]);
    const res = await request(app).get('/members/renewals').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.yearStart).toBeDefined();
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app).get('/members/renewals').set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── POST /members/renew ────────────────────────────────────────────────────

describe('POST /members/renew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with renewed list', async () => {
    // current status query
    tenantQuery.mockResolvedValueOnce([{ id: 'st_current' }]);
    // fetch member
    tenantQuery.mockResolvedValueOnce([{ id: 'm1', forenames: 'John', surname: 'Smith', next_renewal: '2026-01-01', status_id: 'st_current', status_name: 'Current', gift_aid_from: null }]);
    // update member
    tenantQuery.mockResolvedValueOnce([]);
    // create transaction
    tenantQuery.mockResolvedValueOnce([{ id: 'txn1', transaction_number: 42 }]);

    const res = await request(app)
      .post('/members/renew')
      .set('Authorization', AUTH)
      .send({ memberIds: ['m1'], accountId: 'acc1', paymentMethod: 'Cash', amounts: { m1: 25 }, yearStart: '2026-01-01' });
    expect(res.status).toBe(200);
    expect(res.body.renewed).toHaveLength(1);
    expect(res.body.renewed[0].transactionNumber).toBe(42);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .post('/members/renew')
      .set('Authorization', makeAuthHeader({ privileges: [] }))
      .send({ memberIds: ['m1'], accountId: 'acc1', paymentMethod: 'Cash', amounts: { m1: 25 }, yearStart: '2026-01-01' });
    expect(res.status).toBe(403);
  });
});

// ── GET /members/non-renewals ──────────────────────────────────────────────

describe('GET /members/non-renewals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with this_year mode', async () => {
    tenantQuery.mockResolvedValueOnce([{ year_start_month: 1, year_start_day: 1, grace_lapse_weeks: 4, deletion_years: 7 }]);
    tenantQuery.mockResolvedValueOnce([
      { id: 'm1', forenames: 'Alice', surname: 'Jones', status_name: 'Current', next_renewal: '2025-01-01' },
    ]);
    const res = await request(app).get('/members/non-renewals?mode=this_year').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.mode).toBe('this_year');
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app).get('/members/non-renewals').set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── POST /members/lapse ────────────────────────────────────────────────────

describe('POST /members/lapse', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with lapse count', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'st_lapsed' }]);
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .post('/members/lapse')
      .set('Authorization', AUTH)
      .send({ memberIds: ['m1', 'm2'] });
    expect(res.status).toBe(200);
    expect(res.body.lapsed).toBe(2);
  });

  it('returns 403 when privilege missing', async () => {
    const res = await request(app)
      .post('/members/lapse')
      .set('Authorization', makeAuthHeader({ privileges: [] }))
      .send({ memberIds: ['m1'] });
    expect(res.status).toBe(403);
  });
});
