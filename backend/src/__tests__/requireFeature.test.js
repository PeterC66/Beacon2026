// beacon2/backend/src/__tests__/requireFeature.test.js
// Tests the requireFeature middleware itself.
// Other test files get a pass-through mock of this middleware from setup.js;
// here we unmock it so we can exercise the real behaviour.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.doUnmock('../middleware/requireFeature.js');

vi.mock('../utils/db.js', () => ({
  prisma:      { $disconnect: vi.fn() },
  tenantQuery: vi.fn(),
  withTenant:  vi.fn(),
}));

// Import the real middleware after unmocking
const { requireFeature, isFeatureEnabled } = await vi.importActual('../middleware/requireFeature.js');
const { tenantQuery } = await import('../utils/db.js');

function runMiddleware(mw, req = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(b)      { this.body = b; resolve({ status: this.statusCode, body: b, called: 'res' }); return this; },
    };
    const next = (err) => resolve({ status: 200, body: null, called: 'next', err });
    mw(req, res, next);
  });
}

describe('requireFeature middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next() when feature is on (explicit true)', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: { polls: true } }]);
    const mw = requireFeature('polls');
    const result = await runMiddleware(mw, { user: { tenantSlug: 'test' } });
    expect(result.called).toBe('next');
  });

  it('calls next() when feature is missing and defaults on', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: {} }]);
    const mw = requireFeature('polls');
    const result = await runMiddleware(mw, { user: { tenantSlug: 'test' } });
    expect(result.called).toBe('next');
  });

  it('returns 403 when feature is explicitly off', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: { polls: false } }]);
    const mw = requireFeature('polls');
    const result = await runMiddleware(mw, { user: { tenantSlug: 'test' } });
    expect(result.status).toBe(403);
    expect(result.body.feature).toBe('polls');
  });

  it('returns 403 when feature defaults off and is not set (giftAid)', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: {} }]);
    const mw = requireFeature('giftAid');
    const result = await runMiddleware(mw, { user: { tenantSlug: 'test' } });
    expect(result.status).toBe(403);
  });

  it('returns 403 when the parent master toggle is off', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: { groups: false, teams: true } }]);
    const mw = requireFeature('teams');
    const result = await runMiddleware(mw, { user: { tenantSlug: 'test' } });
    expect(result.status).toBe(403);
    expect(result.body.feature).toBe('teams');
  });

  it('handles missing row gracefully (no tenant_settings)', async () => {
    tenantQuery.mockResolvedValueOnce([]);
    const mw = requireFeature('polls');
    const result = await runMiddleware(mw, { user: { tenantSlug: 'test' } });
    expect(result.called).toBe('next');
  });
});

describe('isFeatureEnabled helper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when feature is on', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: { publicPages: true } }]);
    const result = await isFeatureEnabled('test', 'publicPages');
    expect(result).toBe(true);
  });

  it('returns false when feature is off', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: { publicPages: false } }]);
    const result = await isFeatureEnabled('test', 'publicPages');
    expect(result).toBe(false);
  });

  it('respects parent dependency (teams depends on groups)', async () => {
    tenantQuery.mockResolvedValueOnce([{ feature_config: { groups: false, teams: true } }]);
    const result = await isFeatureEnabled('test', 'teams');
    expect(result).toBe(false);
  });
});
