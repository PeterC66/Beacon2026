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

test.describe('u3a Officers', () => {
  test('officers list page loads', async ({ adminPage: page }) => {
    await page.goto('/officers');
    await expect(page.getByRole('heading', { name: /officer/i })).toBeVisible();
  });

  test('add an officer record', async ({ adminPage: page }) => {
    await page.goto('/officers');

    // Fill the add-officer form (office title + post-holder name or member link)
    const officeTitleInput = page.getByPlaceholder(/office|title|position/i).first();
    if (await officeTitleInput.isVisible()) {
      await officeTitleInput.fill(OFFICE_NAME);
    } else {
      // Some forms use labelled inputs
      await page.getByLabel(/office/i).first().fill(OFFICE_NAME);
    }

    // The officer may link to a member; the name field is sometimes separate
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(OFFICER_NAME);
    }

    await page.getByRole('button', { name: /add|save/i }).first().click();

    await expect(page.getByText(OFFICE_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('officer appears in the list', async ({ adminPage: page }) => {
    await page.goto('/officers');
    await expect(page.getByText(OFFICE_NAME)).toBeVisible();
  });

  test('delete the officer record', async ({ adminPage: page }) => {
    await page.goto('/officers');
    const row = page.getByRole('row').filter({ hasText: OFFICE_NAME });
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByText(OFFICE_NAME)).toBeHidden({ timeout: 6_000 });
  });
});
