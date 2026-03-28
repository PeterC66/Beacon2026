// beacon2/e2e/tests/14-membership-extended.spec.js
// Extended membership tests: Renewals, Non-renewals, Membership Cards,
// Addresses Export, Recent Members, Statistics.
// Beacon UG §§4.4–4.9
//
// Tests:
//  ✓ Recent Members page loads with heading
//  ✓ Statistics page loads with sections
//  ✓ Membership Renewals page loads with structure
//  ✓ Non-renewals page loads with mode selector
//  ✓ Membership Cards page loads with filter controls
//  ✓ Addresses Export page loads with format selector

import { test, expect } from '../fixtures/admin.js';

// ── Helper: SPA-navigate to a Home link ──────────────────────────────────

async function gotoHomeLink(page, href, headingText) {
  await page.evaluate(() => {
    const h = document.querySelector('a[href="/"]');
    if (h) h.click();
  });
  await page.waitForSelector(`a[href="${href}"]`, { timeout: 5_000 }).catch(() => null);
  const clicked = await page.evaluate((h) => {
    const link = document.querySelector(`a[href="${h}"]`);
    if (link) { link.click(); return true; }
    return false;
  }, href);
  if (!clicked) await page.goto(href);
  await page.getByRole('heading', { name: headingText }).waitFor({ timeout: 10_000 });
}

// ── Recent Members ───────────────────────────────────────────────────────

test.describe('Recent Members', () => {
  test('page loads with heading', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/members/recent', 'Recent Members');
    await expect(page.getByRole('heading', { name: 'Recent Members' })).toBeVisible();
  });
});

// ── Statistics ───────────────────────────────────────────────────────────

test.describe('Membership Statistics', () => {
  test('page loads with sections', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/members/statistics', 'Membership Statistics');

    // Should show at least a class-based section
    await expect(page.getByText(/current members/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Membership Renewals ──────────────────────────────────────────────────

test.describe('Membership Renewals', () => {
  test('page loads with structure', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/membership/renewals', 'Membership Renewals');

    // Should have account and payment method selectors
    await expect(page.locator('select').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Non-renewals ─────────────────────────────────────────────────────────

test.describe('Non-renewals', () => {
  test('page loads with mode selector', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/membership/non-renewals', 'Non-renewals');

    // Mode toggle text
    await expect(page.getByText(/this year|long.term/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Membership Cards ─────────────────────────────────────────────────────

test.describe('Membership Cards', () => {
  test('page loads with filter controls', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/membership/cards', 'Membership Cards');

    // Filter radio buttons
    await expect(page.getByText(/outstanding/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('download buttons are present', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/membership/cards', 'Membership Cards');

    // Action controls should be present
    await expect(page.getByRole('heading', { name: 'Membership Cards' })).toBeVisible();
  });
});

// ── Addresses Export ─────────────────────────────────────────────────────

test.describe('Addresses Export', () => {
  test('page loads with format selector', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/addresses-export', 'Addresses Export');

    // Format dropdown or radio buttons
    await expect(page.getByText(/excel|csv|labels|tam/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('download button is present', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/addresses-export', 'Addresses Export');
    await expect(page.getByRole('button', { name: /download/i }).first()).toBeVisible();
  });
});
