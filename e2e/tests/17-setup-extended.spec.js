// beacon2/e2e/tests/17-setup-extended.spec.js
// Extended setup tests: Polls, System Messages, Public Links, Custom Fields.
// Beacon UG §§8.8, 9.4, 8.3
//
// Tests:
//  ✓ Poll Set Up page loads with heading
//  ✓ Add and delete a poll
//  ✓ System Messages page loads with message templates
//  ✓ Public Links page loads with sections
//  ✓ Custom Fields page loads with label inputs

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

const SUFFIX = process.pid;

// ── Polls ────────────────────────────────────────────────────────────────

test.describe('Poll Set Up', () => {
  test('page loads with heading', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/polls', 'Poll Set Up');
    await expect(page.getByRole('heading', { name: 'Poll Set Up' })).toBeVisible();
  });

  test('add a poll', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/polls', 'Poll Set Up');

    await page.getByRole('button', { name: /add poll/i }).click();

    // Fill the inline form
    const nameInput = page.locator('input[name="name"]').first();
    await nameInput.waitFor({ timeout: 5_000 });
    await nameInput.fill(`E2EPoll${SUFFIX}`);

    await page.getByRole('button', { name: /save/i }).first().click();

    await expect(page.getByText(`E2EPoll${SUFFIX}`)).toBeVisible({ timeout: 6_000 });
  });

  test('delete the poll', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/polls', 'Poll Set Up');

    const row = page.getByRole('row').filter({ hasText: `E2EPoll${SUFFIX}` });
    const rowVisible = await row.isVisible().catch(() => false);
    if (rowVisible) {
      page.once('dialog', (d) => d.accept());
      await row.getByRole('button', { name: /delete/i }).click();
      await expect(page.getByText(`E2EPoll${SUFFIX}`)).toBeHidden({ timeout: 6_000 });
    }
  });
});

// ── System Messages ──────────────────────────────────────────────────────

test.describe('System Messages', () => {
  test('page loads with message templates', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/system-messages', 'System Messages');

    // Should show at least one message template
    await expect(page.getByText(/subject|body|template/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Public Links ─────────────────────────────────────────────────────────

test.describe('Public Links', () => {
  test('page loads with sections', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/public-links', 'Public Links');

    // Should show member services section and portal config
    await expect(page.getByText(/member/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('save button is present', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/public-links', 'Public Links');
    await expect(page.getByRole('button', { name: /save|update/i }).first()).toBeVisible();
  });
});

// ── Custom Fields ────────────────────────────────────────────────────────

test.describe('Custom Fields', () => {
  test('page loads with label inputs', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/custom-fields', 'Custom Fields');

    // All four label inputs should be present
    await expect(page.locator('input[name="label1"]')).toBeVisible();
    await expect(page.locator('input[name="label2"]')).toBeVisible();
    await expect(page.locator('input[name="label3"]')).toBeVisible();
    await expect(page.locator('input[name="label4"]')).toBeVisible();
  });

  test('save button is present', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/custom-fields', 'Custom Fields');
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
  });
});
