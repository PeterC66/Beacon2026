// beacon2/backend/src/__tests__/systemMessages.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { makeAuthHeader, TEST_TENANT } from './helpers.js';
import { tenantQuery } from '../utils/db.js';

vi.mock('../utils/db.js', () => ({
  prisma: { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant: vi.fn(),
}));
vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated: vi.fn().mockResolvedValue(false),
}));

describe('System Messages routes', () => {
  const auth = makeAuthHeader();

  beforeEach(() => vi.clearAllMocks());

  it('GET /system-messages returns list', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'online_join_confirm', name: 'Online Joining Confirmation', subject: 'Welcome', body: 'Hello', updated_at: new Date() },
    ]);

    const res = await request(app)
      .get('/system-messages')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('online_join_confirm');
  });

  it('PATCH /system-messages/:id updates message', async () => {
    tenantQuery.mockResolvedValueOnce([
      { id: 'online_join_confirm', name: 'Online Joining Confirmation', subject: 'Updated', body: 'New body', updated_at: new Date() },
    ]);

    const res = await request(app)
      .patch('/system-messages/online_join_confirm')
      .set('Authorization', auth)
      .send({ subject: 'Updated', body: 'New body' });

    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Updated');
  });

  it('PATCH /system-messages/:id returns 404 for missing message', async () => {
    tenantQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .patch('/system-messages/nonexistent')
      .set('Authorization', auth)
      .send({ subject: 'Test' });

    expect(res.status).toBe(404);
  });
});
