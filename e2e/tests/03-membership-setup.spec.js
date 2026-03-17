// beacon2/e2e/tests/03-membership-setup.spec.js
// Membership classes and statuses tests.
// Beacon UG §8.7 — "Membership Set-Up" (classes and statuses)
//
// Tests:
//  ✓ Member class list loads with the seeded "Individual" class
//  ✓ Add a new member class → appears in list
//  ✓ Edit a member class name → change saved
//  ✓ Delete a non-locked member class → removed
//  ✓ Locked class (Individual) cannot be deleted
//  ✓ Member status list loads with default statuses
//  ✓ Add a new member status → appears in list
//  ✓ Delete a non-locked status → removed

import { test, expect } from '../fixtures/admin.js';

const SUFFIX    = Date.now();
const NEW_CLASS  = `TestClass${SUFFIX}`;
const NEW_STATUS = `TestStatus${SUFFIX}`;

// ── Member Classes ────────────────────────────────────────────────────────

test.describe('Member classes', () => {
  test('list page loads with Individual class', async ({ adminPage: page }) => {
    await page.goto('/membership/classes');
    await expect(page.getByRole('heading', { name: /membership classes/i })).toBeVisible();
    await expect(page.getByText('Individual')).toBeVisible();
  });

  test('add a new member class', async ({ adminPage: page }) => {
    await page.goto('/membership/classes');

    // Fill the add-new form
    await page.getByPlaceholder(/class name/i).fill(NEW_CLASS);

    // Set fee
    const feeInput = page.locator('input[name="fee"], input[placeholder*="fee" i]').first();
    if (await feeInput.isVisible()) await feeInput.fill('15.00');

    await page.getByRole('button', { name: /add/i }).first().click();

    // New class appears in the table
    await expect(page.getByText(NEW_CLASS)).toBeVisible({ timeout: 6_000 });
  });

  test('edit a member class name', async ({ adminPage: page }) => {
    await page.goto('/membership/classes');

    // Click edit on the new class
    const row = page.getByRole('row').filter({ hasText: NEW_CLASS });
    await row.getByRole('link', { name: /edit/i }).click();

    // Update name
    const updatedName = `${NEW_CLASS}Upd`;
    await page.locator('input[name="name"]').first().fill(updatedName);
    await page.getByRole('button', { name: /save/i }).first().click();

    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 6_000 });
    // Rename back so the delete test still finds it
    await page.locator('input[name="name"]').first().fill(NEW_CLASS);
    await page.getByRole('button', { name: /save/i }).first().click();
  });

  test('delete the new member class', async ({ adminPage: page }) => {
    await page.goto('/membership/classes');

    const row = page.getByRole('row').filter({ hasText: NEW_CLASS });
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    // Row should disappear
    await expect(page.getByText(NEW_CLASS)).toBeHidden({ timeout: 6_000 });
  });

  test('locked Individual class has no delete button', async ({ adminPage: page }) => {
    await page.goto('/membership/classes');
    const row = page.getByRole('row').filter({ hasText: 'Individual' });
    // No delete button on locked class
    await expect(row.getByRole('button', { name: /delete/i })).toHaveCount(0);
  });
});

// ── Member Statuses ───────────────────────────────────────────────────────

test.describe('Member statuses', () => {
  test('list page loads with default statuses', async ({ adminPage: page }) => {
    await page.goto('/membership/statuses');
    await expect(page.getByRole('heading', { name: /member status/i })).toBeVisible();

    // Default locked statuses seeded at tenant creation
    for (const s of ['Current', 'Lapsed', 'Resigned', 'Deceased']) {
      await expect(page.getByText(s)).toBeVisible();
    }
  });

  test('add a new member status', async ({ adminPage: page }) => {
    await page.goto('/membership/statuses');

    // Inline add: click the add input, type the name, press Enter or click Add
    const nameInput = page.getByPlaceholder(/status name/i).first();
    await nameInput.fill(NEW_STATUS);
    await page.keyboard.press('Enter');

    await expect(page.getByText(NEW_STATUS)).toBeVisible({ timeout: 6_000 });
  });

  test('delete the new member status', async ({ adminPage: page }) => {
    await page.goto('/membership/statuses');

    const row = page.getByRole('row').filter({ hasText: NEW_STATUS });
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByText(NEW_STATUS)).toBeHidden({ timeout: 6_000 });
  });

  test('locked statuses have no delete button', async ({ adminPage: page }) => {
    await page.goto('/membership/statuses');
    for (const s of ['Current', 'Lapsed', 'Resigned', 'Deceased']) {
      const row = page.getByRole('row').filter({ hasText: s });
      await expect(row.getByRole('button', { name: /delete/i })).toHaveCount(0);
    }
  });
});
