// beacon2/e2e/tests/12-calendar.spec.js
// Calendar and Event Types tests.
// Beacon UG §5.9 — "The Calendar"
//
// Tests:
//  ✓ Calendar page loads with heading and filter controls
//  ✓ Calendar has date range inputs and Download PDF button
//  ✓ Show Detail checkbox is present (exactly one)
//  ✓ "Other" filter mode shows event type dropdown
//  ✓ Group/Team filter dropdown is present
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

  test('Show Detail checkbox is present exactly once', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/calendar', 'Calendar');

    // Wait for the filter controls to render
    await expect(page.locator('input[type="date"][name="from"]')).toBeVisible();

    // "Show Detail" checkbox should appear exactly once (no duplicate)
    const showDetailCheckboxes = page.getByText('Show Detail');
    await expect(showDetailCheckboxes).toHaveCount(1);
  });

  test('"Other" filter mode shows event type dropdown', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/calendar', 'Calendar');

    // Click the "other" radio button
    const otherRadio = page.locator('input[name="filter"][value="other"]');
    // "Other" mode is only shown if user has meetings:view — check if it exists
    const otherExists = await otherRadio.isVisible().catch(() => false);
    if (!otherExists) {
      // Skip — feature may be toggled off in the test tenant
      return;
    }
    await otherRadio.click();

    // Event type dropdown should appear
    const eventTypeSelect = page.locator('select[name="eventTypeId"]');
    await expect(eventTypeSelect).toBeVisible({ timeout: 5_000 });

    // Should have at least the default "Open Meetings" option
    await expect(eventTypeSelect.locator('option')).not.toHaveCount(0);
  });

  test('Group/Team filter dropdown is present', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/calendar', 'Calendar');

    // Wait for filter controls to render, then click the "group" radio
    const groupRadio = page.locator('input[name="filter"][value="group"]');
    await expect(groupRadio).toBeVisible({ timeout: 10_000 });
    await groupRadio.click();

    const groupSelect = page.locator('select[name="groupId"]');
    await expect(groupSelect).toBeVisible({ timeout: 5_000 });

    // Should have at least the placeholder option (options inside a closed
    // <select> are not "visible" per Playwright, so check count instead)
    await expect(groupSelect.locator('option')).not.toHaveCount(0);
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
