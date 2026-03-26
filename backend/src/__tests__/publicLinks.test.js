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

  it('GET /public-links returns settings including config sections', async () => {
    tenantQuery.mockResolvedValueOnce([{
      online_joining_enabled: true,
      privacy_policy_url: 'https://example.com/privacy',
      paypal_email: 'pay@test.com',
      paypal_cancel_url: 'https://test.com',
      portal_config: { renewals: true, groups: false, calendar: true, personalDetails: false, replacementCard: true },
      group_info_config: { status: { members: true, public: false } },
      calendar_config: { venue: { members: true, public: true } },
    }]);

    const res = await request(app)
      .get('/public-links')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.onlineJoiningEnabled).toBe(true);
    expect(res.body.privacyPolicyUrl).toBe('https://example.com/privacy');
    expect(res.body.portalConfig.renewals).toBe(true);
    expect(res.body.portalConfig.replacementCard).toBe(true);
    expect(res.body.portalConfig.groups).toBe(false);
    expect(res.body.groupInfoConfig.status).toEqual({ members: true, public: false });
    expect(res.body.calendarConfig.venue).toEqual({ members: true, public: true });
  });

  it('GET /public-links returns defaults when config columns are null', async () => {
    tenantQuery.mockResolvedValueOnce([{
      online_joining_enabled: false,
      privacy_policy_url: null,
      paypal_email: null,
      paypal_cancel_url: null,
      portal_config: null,
      group_info_config: null,
      calendar_config: null,
    }]);

    const res = await request(app)
      .get('/public-links')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.portalConfig.renewals).toBe(false);
    expect(res.body.portalConfig.replacementCard).toBe(false);
    expect(res.body.groupInfoConfig.status).toEqual({ members: false, public: false });
    expect(res.body.calendarConfig.venue).toEqual({ members: false, public: false });
  });

  it('PATCH /public-links updates settings', async () => {
    tenantQuery.mockResolvedValueOnce([{
      online_joining_enabled: true,
      privacy_policy_url: 'https://example.com/privacy',
      portal_config: { renewals: true, groups: false, calendar: false, personalDetails: false, replacementCard: false },
      group_info_config: {},
      calendar_config: {},
    }]);

    const res = await request(app)
      .patch('/public-links')
      .set('Authorization', auth)
      .send({ onlineJoiningEnabled: true, privacyPolicyUrl: 'https://example.com/privacy' });

    expect(res.status).toBe(200);
  });

  it('PATCH /public-links updates portal config', async () => {
    const portalConfig = { renewals: true, groups: true, calendar: true, personalDetails: true, replacementCard: false };
    tenantQuery.mockResolvedValueOnce([{
      online_joining_enabled: false,
      privacy_policy_url: null,
      portal_config: portalConfig,
      group_info_config: {},
      calendar_config: {},
    }]);

    const res = await request(app)
      .patch('/public-links')
      .set('Authorization', auth)
      .send({ portalConfig });

    expect(res.status).toBe(200);
    expect(res.body.portalConfig.renewals).toBe(true);
    expect(res.body.portalConfig.groups).toBe(true);
  });

  it('PATCH /public-links updates group info and calendar config', async () => {
    const groupInfoConfig = { status: { members: true, public: true }, venue: { members: false, public: true } };
    const calendarConfig = { venue: { members: true, public: false }, topic: { members: true, public: true } };
    tenantQuery.mockResolvedValueOnce([{
      online_joining_enabled: false,
      privacy_policy_url: null,
      portal_config: {},
      group_info_config: groupInfoConfig,
      calendar_config: calendarConfig,
    }]);

    const res = await request(app)
      .patch('/public-links')
      .set('Authorization', auth)
      .send({ groupInfoConfig, calendarConfig });

    expect(res.status).toBe(200);
    expect(res.body.groupInfoConfig.status).toEqual({ members: true, public: true });
    expect(res.body.calendarConfig.topic).toEqual({ members: true, public: true });
  });
});
