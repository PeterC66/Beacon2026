// beacon2/e2e/success-reporter.js
// Minimal Playwright reporter that writes a marker file when all tests pass.
// Used by global-teardown.js to decide whether to delete the test tenant.

import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKER_PATH = resolve(__dirname, '.e2e-passed');

export default class SuccessReporter {
  onBegin() {
    // Remove any stale marker from a previous run
    try { unlinkSync(MARKER_PATH); } catch { /* not there */ }
  }

  onEnd(result) {
    if (result.status === 'passed') {
      writeFileSync(MARKER_PATH, new Date().toISOString());
    }
  }
}
