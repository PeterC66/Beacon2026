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
  return process.env.BEACON2_TEST_TENANT_SLUG || 'e2etest';
}
const SLUG     = readSlug();
const USERNAME = process.env.BEACON2_TEST_ADMIN_USERNAME || 'testadmin';
const PASSWORD = process.env.BEACON2_TEST_ADMIN_PASSWORD || 'TestAdmin99!';

/**
 * Extended test fixture.  Use `adminPage` in tests; it is already signed in.
 *
 * The access token lives only in React memory, so there is no way to share it
 * via Playwright's storageState.  Instead we perform a fresh login per test
 * (one browser navigation, ~200 ms overhead).
 *
 * IMPORTANT: after login, page.goto() is overridden to prefer SPA link-click
 * navigation.  This avoids full page reloads that would destroy the in-memory
 * auth token (see CLAUDE-E2E.md for details).
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
    console.log(`[adminPage] Logged in. URL: ${page.url()}`);

    // Wait for the Home page to actually render.  The Home component fetches
    // privileges via AuthContext before it can render links — in CI the backend
    // may be slow (cold start / shared runner), so allow a generous timeout.
    const homeStart = Date.now();
    await page.waitForSelector('a[href="/members"]', { timeout: 15_000 }).catch(async () => {
      // Dump diagnostic info so we can debug if the home page never renders
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500)).catch(() => '<eval failed>');
      const linkCount = await page.evaluate(() => document.querySelectorAll('a').length).catch(() => -1);
      console.log(`[adminPage] WARNING: /members link not found after 15 s`);
      console.log(`[adminPage]   URL: ${page.url()}`);
      console.log(`[adminPage]   Total <a> tags: ${linkCount}`);
      console.log(`[adminPage]   Body text (first 500 chars): ${bodyText}`);
    });
    console.log(`[adminPage] Home page rendered (${Date.now() - homeStart} ms)`);

    // Override page.goto to prefer SPA navigation.
    // Full-page reloads destroy the in-memory auth token; clicking an <a>
    // in the DOM triggers React Router without a reload.
    const originalGoto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const pathname = new URL(url, 'http://localhost').pathname;
      const clicked = await page.evaluate((p) => {
        const link = document.querySelector(`a[href="${p}"]`);
        if (link) { link.click(); return true; }
        return false;
      }, pathname);
      if (!clicked) return originalGoto(url, options);
    };

    // Hand the logged-in page to the test
    await use(page);

    // No teardown needed — browser context is discarded after the test
  },
});

export { expect };
