// beacon2026/frontend/src/__tests__/setup.js
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom does not implement window.scrollTo / element.scrollIntoView; many pages
// call them after a successful save. Stub them so interaction tests that submit
// forms don't emit "Not implemented" noise.
window.scrollTo = vi.fn();
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
