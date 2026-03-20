// beacon2/backend/src/__tests__/calendar.test.js

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

const SAMPLE_EVENT = {
  id: 'ev1', event_date: '2026-04-01', start_time: '14:00', end_time: '16:00',
  group_id: 'g1', group_name: 'History', venue_id: 'v1', venue_name: 'Town Hall',
  venue_postcode: 'SW1A 1AA', topic: 'WW2 Lecture', contact: 'John 01234',
  details: 'A great lecture', is_private: false,
};

const SAMPLE_OPEN_EVENT = {
  id: 'oe1', event_date: '2026-05-01', start_time: '10:00', end_time: '12:00',
  group_id: null, venue_id: 'v1', venue_name: 'Community Centre',
  topic: 'Quiz Night', contact: 'Neil 07700', details: null,
  is_private: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};

// ── GET /calendar/events ──────────────────────────────────────────────────

describe('GET /calendar/events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with events list', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_EVENT]);
    const res = await request(app)
      .get('/calendar/events?from=2026-01-01&to=2026-06-01')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].group_name).toBe('History');
  });

  it('returns 200 with empty list when no events', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .get('/calendar/events?from=2026-01-01&to=2026-01-02')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('filters by memberId', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_EVENT]);
    const res = await request(app)
      .get('/calendar/events?from=2026-01-01&to=2026-12-31&memberId=m1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    // Verify the query included member filter
    const call = tenantQuery.mock.calls[0];
    expect(call[1]).toContain('group_members');
    expect(call[2]).toContain('m1');
  });

  it('filters by venueId', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_EVENT]);
    const res = await request(app)
      .get('/calendar/events?from=2026-01-01&to=2026-12-31&venueId=v1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    const call = tenantQuery.mock.calls[0];
    expect(call[1]).toContain('venue_id');
    expect(call[2]).toContain('v1');
  });

  it('filters by groupId', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_EVENT]);
    const res = await request(app)
      .get('/calendar/events?from=2026-01-01&to=2026-12-31&groupId=g1')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    const call = tenantQuery.mock.calls[0];
    expect(call[1]).toContain('group_id');
    expect(call[2]).toContain('g1');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/calendar/events');
    expect(res.status).toBe(401);
  });

  it('returns 403 without privilege', async () => {
    const res = await request(app)
      .get('/calendar/events')
      .set('Authorization', makeAuthHeader({ privileges: [] }));
    expect(res.status).toBe(403);
  });
});

// ── GET /calendar/events/pdf ──────────────────────────────────────────────

describe('GET /calendar/events/pdf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with PDF content-type', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_EVENT]);
    const res = await request(app)
      .get('/calendar/events/pdf?from=2026-01-01&to=2026-06-01')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('calendar_');
  });

  it('returns PDF even with no events', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .get('/calendar/events/pdf?from=2026-01-01&to=2026-01-02')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});

// ── GET /calendar/members/search ──────────────────────────────────────────

describe('GET /calendar/members/search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns matching members', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'm1', member_no: 1, first_name: 'Alice', last_name: 'Smith' },
    ]);
    const res = await request(app)
      .get('/calendar/members/search?q=Smi')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].last_name).toBe('Smith');
  });

  it('returns empty array for short query', async () => {
    const res = await request(app)
      .get('/calendar/members/search?q=A')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── Open Events CRUD ──────────────────────────────────────────────────────

describe('GET /calendar/open-events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with open events', async () => {
    tenantQuery.mockResolvedValueOnce([SAMPLE_OPEN_EVENT]);
    const res = await request(app)
      .get('/calendar/open-events')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].topic).toBe('Quiz Night');
  });

  it('returns 403 without meetings:view privilege', async () => {
    const res = await request(app)
      .get('/calendar/open-events')
      .set('Authorization', makeAuthHeader({ privileges: ['calendar:view'] }));
    expect(res.status).toBe(403);
  });
});

describe('POST /calendar/open-events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an open event', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'new1', event_date: '2026-06-01' }]);
    const res = await request(app)
      .post('/calendar/open-events')
      .set('Authorization', AUTH)
      .send({ eventDate: '2026-06-01', startTime: '10:00', topic: 'AGM' });
    expect(res.status).toBe(201);
    // Verify NULL was passed for group_id
    const call = tenantQuery.mock.calls[0];
    expect(call[1]).toContain('NULL');
  });

  it('creates recurring open events', async () => {
    tenantQuery
      .mockResolvedValueOnce([{ id: 'r1', event_date: '2026-06-01' }])
      .mockResolvedValueOnce([{ id: 'r2', event_date: '2026-06-08' }]);
    const res = await request(app)
      .post('/calendar/open-events')
      .set('Authorization', AUTH)
      .send({
        eventDate: '2026-06-01', startTime: '10:00',
        repeatEvery: 1, repeatUnit: 'weeks', repeatUntil: '2026-06-10',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
  });

  it('returns 422 with invalid date', async () => {
    const res = await request(app)
      .post('/calendar/open-events')
      .set('Authorization', AUTH)
      .send({ eventDate: 'not-a-date' });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /calendar/open-events/:eventId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates an open event', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'oe1', topic: 'Updated Topic' }]);
    const res = await request(app)
      .patch('/calendar/open-events/oe1')
      .set('Authorization', AUTH)
      .send({ topic: 'Updated Topic' });
    expect(res.status).toBe(200);
    expect(res.body.topic).toBe('Updated Topic');
  });

  it('returns 404 for nonexistent event', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request(app)
      .patch('/calendar/open-events/bad-id')
      .set('Authorization', AUTH)
      .send({ topic: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('returns 400 with empty update', async () => {
    const res = await request(app)
      .patch('/calendar/open-events/oe1')
      .set('Authorization', AUTH)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /calendar/open-events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes selected open events', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'oe1' }]);
    const res = await request(app)
      .delete('/calendar/open-events')
      .set('Authorization', AUTH)
      .send({ ids: ['oe1'] });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(1);
    // Verify the query checks group_id IS NULL
    const call = tenantQuery.mock.calls[0];
    expect(call[1]).toContain('group_id IS NULL');
  });

  it('returns 422 with empty ids', async () => {
    const res = await request(app)
      .delete('/calendar/open-events')
      .set('Authorization', AUTH)
      .send({ ids: [] });
    expect(res.status).toBe(422);
  });
});
