// beacon2026/backend/src/__tests__/groupStdMessages.test.js
// Std Emails / Std Letters tabs on a group or team record. The same router
// (groupStdMessages.js) is mounted under both /groups and /teams — this
// suite exercises it via /groups/:id/... and spot-checks the /teams mount.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { makeAuthHeader, TEST_TENANT } from './helpers.js';

vi.mock('../utils/db.js', () => ({
  prisma: { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant: vi.fn(),
}));
vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated: vi.fn().mockResolvedValue(false),
}));

const { tenantQuery } = await import('../utils/db.js');
const { default: app } = await import('../app.js');
const request = supertest(app);

const adminAuth = makeAuthHeader(); // ALL_PRIVS — has email_standard_messages_all etc.
const leaderAuth = makeAuthHeader({
  privileges: [
    'groups:view',
    'email_standard_messages_as_leader:view',
    'email_standard_messages_as_leader:create',
    'email_standard_messages_as_leader:change',
    'email_standard_messages_as_leader:delete',
    'letters_standard_messages_as_leader:view',
    'letters_standard_messages_as_leader:create',
    'letters_standard_messages_as_leader:delete',
  ],
});
const noAccessAuth = makeAuthHeader({ privileges: ['groups:view'] });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /groups/:id/std-messages', () => {
  it('returns templates owned by this group for a Site Admin / _all holder', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'sm-1', name: 'Group Welcome', subject: 'Hi', body: 'Hello', owner_group_id: 'g1' },
    ]);
    const res = await request.get('/groups/g1/std-messages').set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Group Welcome');
  });

  it('allows a leader who actually leads this group', async () => {
    tenantQuery.mockResolvedValueOnce([{ '?column?': 1 }]); // isGroupLeader check
    tenantQuery.mockResolvedValueOnce([]); // the list query
    const res = await request.get('/groups/g1/std-messages').set('Authorization', leaderAuth);
    expect(res.status).toBe(200);
  });

  it('denies a leader who does not lead this group', async () => {
    tenantQuery.mockResolvedValueOnce([]); // isGroupLeader check → not a leader here
    const res = await request.get('/groups/g1/std-messages').set('Authorization', leaderAuth);
    expect(res.status).toBe(403);
  });

  it('denies a user with neither privilege', async () => {
    const res = await request.get('/groups/g1/std-messages').set('Authorization', noAccessAuth);
    expect(res.status).toBe(403);
    expect(tenantQuery).not.toHaveBeenCalled();
  });

  it('scopes the query to the authenticated user tenant', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    await request.get('/groups/g1/std-messages').set('Authorization', adminAuth);
    expect(tenantQuery.mock.calls[0][0]).toBe(TEST_TENANT);
  });

  it('also works mounted under /teams/:id/std-messages', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request.get('/teams/t1/std-messages').set('Authorization', adminAuth);
    expect(res.status).toBe(200);
  });
});

describe('POST /groups/:id/std-messages', () => {
  it('creates a template owned by this group', async () => {
    tenantQuery.mockResolvedValueOnce([]); // no existing row with this name
    tenantQuery.mockResolvedValueOnce([
      { id: 'sm-new', name: 'New', subject: 'S', body: 'B', owner_group_id: 'g1' },
    ]);
    const res = await request
      .post('/groups/g1/std-messages')
      .set('Authorization', adminAuth)
      .send({ name: 'New', subject: 'S', body: 'B' });
    expect(res.status).toBe(201);
    expect(res.body.owner_group_id).toBe('g1');
    // owner_group_id passed to the INSERT is the URL's group, not admin-chosen
    expect(tenantQuery.mock.calls[1][2]).toEqual(['New', 'S', 'B', 'g1']);
  });

  it('rejects overwriting a template owned by a different group (409)', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'sm-1', owner_group_id: 'g2' }]);
    const res = await request
      .post('/groups/g1/std-messages')
      .set('Authorization', adminAuth)
      .send({ name: 'Existing', subject: 'S', body: 'B' });
    expect(res.status).toBe(409);
  });

  it('denies a leader who does not lead this group', async () => {
    tenantQuery.mockResolvedValueOnce([]); // isGroupLeader → false
    const res = await request
      .post('/groups/g1/std-messages')
      .set('Authorization', leaderAuth)
      .send({ name: 'New', subject: 'S', body: 'B' });
    expect(res.status).toBe(403);
  });

  it('rejects an empty name', async () => {
    const res = await request
      .post('/groups/g1/std-messages')
      .set('Authorization', adminAuth)
      .send({ name: '', body: 'B' });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /groups/:id/std-messages/:msgId', () => {
  it('deletes scoped to id AND owner_group_id', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const res = await request
      .delete('/groups/g1/std-messages/sm-1')
      .set('Authorization', adminAuth);
    expect(res.status).toBe(204);
    expect(tenantQuery.mock.calls[0][2]).toEqual(['sm-1', 'g1']);
  });
});

describe('/groups/:id/std-letters', () => {
  it('GET returns letters owned by this group', async () => {
    tenantQuery.mockResolvedValueOnce([{ id: 'sl-1', name: 'Group Letter', body: '{}' }]);
    const res = await request.get('/groups/g1/std-letters').set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Group Letter');
  });

  it('POST creates a letter owned by this group', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    tenantQuery.mockResolvedValueOnce([
      { id: 'sl-new', name: 'New', body: '{}', owner_group_id: 'g1' },
    ]);
    const res = await request
      .post('/groups/g1/std-letters')
      .set('Authorization', adminAuth)
      .send({ name: 'New', body: '{}' });
    expect(res.status).toBe(201);
    expect(res.body.owner_group_id).toBe('g1');
  });

  it('denies a user with neither privilege', async () => {
    const res = await request.get('/groups/g1/std-letters').set('Authorization', noAccessAuth);
    expect(res.status).toBe(403);
  });
});
