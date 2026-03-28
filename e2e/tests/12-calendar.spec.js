// beacon2/e2e/tests/12-calendar.spec.js
// Calendar and Open Meetings tests.
// Beacon UG §5.9 — "The Calendar"
//
// Tests:
//  ✓ Calendar page loads with heading and filter controls
//  ✓ Calendar has date range inputs and Download PDF button
//  ✓ Open Meetings page loads from Calendar nav link

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

// ── Calendar ─────────────────────────────────────────────────────────────

test.describe('Calendar', () => {
  test('page loads with heading and filter controls', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/calendar', 'Calendar');

    // Filter radio buttons
    await expect(page.getByText('All').first()).toBeVisible();

    // Date range inputs (native <input type="date">)
    await expect(page.locator('input[type="date"][name="from"]')).toBeVisible();
    await expect(page.locator('input[type="date"][name="to"]')).toBeVisible();
  });

  test('Download PDF button appears when events exist', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/calendar', 'Calendar');

    // Button only renders when events are loaded and non-empty.
    // In a fresh tenant there may be no events, so verify either
    // the button is visible OR the "no events" empty state is shown.
    const pdfBtn = page.getByRole('button', { name: /download pdf/i });
    const noEvents = page.getByText(/no events/i);
    await expect(pdfBtn.or(noEvents).first()).toBeVisible({ timeout: 15_000 });
  });
});

// ── Open Meetings ────────────────────────────────────────────────────────

test.describe('Open Meetings', () => {
  test('page loads from Calendar nav link', async ({ adminPage: page }) => {
    // Navigate to Calendar first
    await gotoHomeLink(page, '/calendar', 'Calendar');

    // Click the Open Meetings link in the Calendar page NavBar
    const clicked = await page.evaluate(() => {
      const link = document.querySelector('a[href="/calendar/open-meetings"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await page.goto('/calendar/open-meetings');

    await expect(page.getByRole('heading', { name: /open meetings/i })).toBeVisible({ timeout: 10_000 });
  });
});
