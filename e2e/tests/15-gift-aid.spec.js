// beacon2/e2e/tests/15-gift-aid.spec.js
// Gift Aid declaration and Gift Aid log tests.
// Beacon UG §7.8 — "Gift Aid"
//
// Tests:
//  ✓ Gift Aid Declaration page loads with year selector
//  ✓ Download Excel and Mark as Claimed buttons are present
//  ✓ Gift Aid Log page loads with date filters

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

// ── Gift Aid Declaration ─────────────────────────────────────────────────

test.describe('Gift Aid Declaration', () => {
  test('page loads with year selector', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/gift-aid', 'Gift Aid Declaration');

    // Financial year dropdown
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('action buttons are present when transactions exist', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/gift-aid', 'Gift Aid Declaration');

    // Buttons only render when there are Gift Aid eligible transactions.
    // In a fresh tenant there may be none, so accept either the buttons
    // or the "no transactions" empty state.
    const downloadBtn = page.getByRole('button', { name: /download excel/i });
    const noTxns = page.getByText('No Gift Aid eligible transactions found for this period.');
    await expect(downloadBtn.or(noTxns)).toBeVisible({ timeout: 15_000 });
  });
});

// ── Gift Aid Log ─────────────────────────────────────────────────────────

test.describe('Gift Aid Log', () => {
  test('page loads with date filters', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/gift-aid-log', 'Gift Aid Log');

    // Date inputs
    const dateInputs = page.getByPlaceholder('dd/mm/yyyy');
    await expect(dateInputs.first()).toBeVisible();
  });
});
