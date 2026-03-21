// beacon2/e2e/fixtures/admin.js
// Playwright fixture that provides a page already logged in as the
// test-tenant admin user.  Import { test, expect } from here instead of
// '@playwright/test' in every spec file.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
loadDotenv();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the slug written by global-setup; fall back to env var / default.
function readSlug() {
  try {
    const state = JSON.parse(readFileSync(resolve(__dirname, '../.e2e-state.json'), 'utf8'));
    return state.slug;
  } catch { /* state file missing — use env/default */ }
  return process.env.BEACON2_TEST_TENANT_SLUG ?? 'e2etest';
}
const SLUG     = readSlug();
const USERNAME = process.env.BEACON2_TEST_ADMIN_USERNAME ?? 'testadmin';
const PASSWORD = process.env.BEACON2_TEST_ADMIN_PASSWORD ?? 'TestAdmin99!';

/**
 * Extended test fixture.  Use `adminPage` in tests; it is already signed in.
 *
 * The access token lives only in React memory, so there is no way to share it
 * via Playwright's storageState.  Instead we perform a fresh login per test
 * (one browser navigation, ~200 ms overhead).
 */
export const test = base.extend({
  adminPage: async ({ page }, use) => {
    // Navigate to login
    await page.goto('/login');

    // Fill credentials
    await page.getByLabel('u3a').fill(SLUG);
    await page.getByLabel('Username').fill(USERNAME);
    await page.getByLabel('Password').fill(PASSWORD);

    // Submit and wait for home page
    await page.getByRole('button', { name: 'Enter' }).click();
    await page.waitForURL('/', { timeout: 10_000 });

    // Hand the logged-in page to the test
    await use(page);

    // No teardown needed — browser context is discarded after the test
  },
});

export { expect };
