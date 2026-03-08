// beacon2/backend/src/__tests__/setup.js
// Global test setup: runs before every test file.

import { vi, beforeEach } from 'vitest';

// Silence console.error spam from the Express error handler during tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
