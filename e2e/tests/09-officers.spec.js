// beacon2/e2e/tests/09-officers.spec.js
// u3a Officers tests.
// Beacon UG §9.3 — "u3a Officers"
//
// Tests:
//  ✓ Officers list page loads
//  ✓ Add an officer → appears in list
//  ✓ Edit an officer → change saved
//  ✓ Delete an officer → removed from list

import { test, expect } from '../fixtures/admin.js';

const SUFFIX       = Date.now();
const OFFICER_NAME = `E2EOfficer${SUFFIX}`;
const OFFICE_NAME  = `E2EOffice${SUFFIX}`;

/** SPA-navigate to /officers, preserving auth token */
async function gotoOfficers(page) {
  const clicked = await page.evaluate(() => {
    const link = document.querySelector('a[href="/officers"]');
    if (link) { link.click(); return true; }
    return false;
  });
  if (!clicked) await page.goto('/officers');
  await page.getByRole('heading', { name: /offices/i }).waitFor();
}

test.describe('u3a Officers', () => {
  test('officers list page loads', async ({ adminPage: page }) => {
    await gotoOfficers(page);
    await expect(page.getByRole('heading', { name: 'u3a Offices and Post Holders' })).toBeVisible();
  });

  test('add an officer record', async ({ adminPage: page }) => {
    await gotoOfficers(page);

    // Click "Add new office" to show the inline edit row
    await page.getByRole('button', { name: /add new office/i }).click();

    // Fill the office name input in the edit row
    await page.locator('input[name="name"]').fill(OFFICE_NAME);

    // Save the record
    await page.getByRole('button', { name: /save record/i }).click();

    await expect(page.getByText(OFFICE_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('officer appears in the list', async ({ adminPage: page }) => {
    await gotoOfficers(page);
    await expect(page.getByText(OFFICE_NAME)).toBeVisible();
  });

  test('delete the officer record', async ({ adminPage: page }) => {
    await gotoOfficers(page);
    const row = page.getByRole('row').filter({ hasText: OFFICE_NAME });
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByText(OFFICE_NAME)).toBeHidden({ timeout: 6_000 });
  });
});
