// beacon2/backend/src/__tests__/setup.js
// Global test setup: runs before every test file.

import { vi, beforeEach } from 'vitest';

// Globally short-circuit the feature-toggle middleware in tests so individual
// test files don't have to queue an extra feature_config mock on every request.
// Test files that want to exercise the real gate (e.g. giftAid.test.js) can
// call vi.doUnmock('../middleware/requireFeature.js') and re-import.
vi.mock('../middleware/requireFeature.js', () => ({
  requireFeature: () => (req, res, next) => next(),
  isFeatureEnabled: vi.fn(async () => true),
}));

// Silence console.error spam from the Express error handler during tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
