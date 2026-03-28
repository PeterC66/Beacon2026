// beacon2/e2e/tests/18-letters-utilities.spec.js
// Letters module and Utilities page tests.
// Beacon UG §6.2 — "Letters"
//
// Tests:
//  ✓ Utilities page loads with heading and validate link
//  ✓ Letter Compose page loads with editor and tokens panel

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

// ── Utilities ────────────────────────────────────────────────────────────

test.describe('Utilities', () => {
  test('page loads with heading', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/utilities', 'Utilities');
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible();
  });

  test('validate member data link is present', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/utilities', 'Utilities');
    await expect(page.getByText(/validate member data/i)).toBeVisible();
  });
});

// ── Letter Compose ───────────────────────────────────────────────────────
// LetterCompose reads recipient IDs from sessionStorage.letterComposeMemberIds.
// We pre-set an empty array so the page loads without recipients.

test.describe('Letter Compose', () => {
  test('page loads with editor', async ({ adminPage: page }) => {
    // Pre-set empty recipients in sessionStorage so page loads
    await page.evaluate(() => {
      sessionStorage.setItem('letterComposeMemberIds', JSON.stringify([]));
    });

    // No Home link exists for letter compose — navigate directly
    await page.goto('/letters/compose');
    await page.getByRole('heading', { name: 'Compose Letter' }).waitFor({ timeout: 10_000 });

    // Token panel should be visible
    await expect(page.getByText(/tokens/i).first()).toBeVisible();
  });

  test('download button is present', async ({ adminPage: page }) => {
    await page.evaluate(() => {
      sessionStorage.setItem('letterComposeMemberIds', JSON.stringify([]));
    });

    await page.goto('/letters/compose');
    await page.getByRole('heading', { name: 'Compose Letter' }).waitFor({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: /download/i })).toBeVisible();
  });
});
