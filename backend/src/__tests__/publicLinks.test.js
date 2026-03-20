// beacon2/backend/src/__tests__/publicLinks.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { makeAuthHeader } from './helpers.js';
import { tenantQuery } from '../utils/db.js';

vi.mock('../utils/db.js', () => ({
  prisma: { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant: vi.fn(),
}));
vi.mock('../utils/redis.js', () => ({
  isSessionInvalidated: vi.fn().mockResolvedValue(false),
}));

describe('Public Links routes', () => {
  const auth = makeAuthHeader();

  beforeEach(() => vi.clearAllMocks());

  it('GET /public-links returns settings', async () => {
    tenantQuery.mockResolvedValueOnce([{
      online_joining_enabled: true,
      privacy_policy_url: 'https://example.com/privacy',
      paypal_email: 'pay@test.com',
      paypal_cancel_url: 'https://test.com',
    }]);

    const res = await request(app)
      .get('/public-links')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.onlineJoiningEnabled).toBe(true);
    expect(res.body.privacyPolicyUrl).toBe('https://example.com/privacy');
  });

  it('PATCH /public-links updates settings', async () => {
    tenantQuery.mockResolvedValueOnce([{
      online_joining_enabled: true,
      privacy_policy_url: 'https://example.com/privacy',
    }]);

    const res = await request(app)
      .patch('/public-links')
      .set('Authorization', auth)
      .send({ onlineJoiningEnabled: true, privacyPolicyUrl: 'https://example.com/privacy' });

    expect(res.status).toBe(200);
  });
});
