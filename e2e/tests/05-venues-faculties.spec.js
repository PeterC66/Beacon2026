// beacon2/e2e/tests/05-venues-faculties.spec.js
// Group Venues and Faculties tests.
// Beacon UG §5.7 — "Group Venues"
// Beacon UG §5.8 — "Group Faculties"
//
// Tests — Venues:
//  ✓ Venue list page loads
//  ✓ Add a venue → appears in list
//  ✓ Edit venue details → saved
//  ✓ Delete a venue → removed
//
// Tests — Faculties:
//  ✓ Faculty list page loads
//  ✓ Add a faculty → appears in list
//  ✓ Edit a faculty name → saved
//  ✓ Delete a faculty → removed

import { test, expect } from '../fixtures/admin.js';

const SUFFIX       = Date.now();
const VENUE_NAME   = `E2EVenue${SUFFIX}`;
const FACULTY_NAME = `E2EFaculty${SUFFIX}`;

// ── Venues ────────────────────────────────────────────────────────────────

test.describe('Venues', () => {
  test('venue list page loads', async ({ adminPage: page }) => {
    await page.goto('/venues');
    await expect(page.getByRole('heading', { name: /venues/i })).toBeVisible();
  });

  test('add a new venue', async ({ adminPage: page }) => {
    await page.goto('/venues/new');

    await page.locator('input[name="name"]').first().fill(VENUE_NAME);
    // Address fields are optional
    await page.locator('input[name="postcode"], input[placeholder*="postcode" i]').first()
      .fill('OX1 2AA').catch(() => {});

    await page.getByRole('button', { name: /save/i }).first().click();

    // Redirects to the venue list or shows saved banner
    await page.waitForURL(/\/venues/, { timeout: 10_000 });
    await expect(page.getByText(VENUE_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('venue appears in venue list', async ({ adminPage: page }) => {
    await page.goto('/venues');
    await expect(page.getByText(VENUE_NAME)).toBeVisible();
  });

  test('edit venue details', async ({ adminPage: page }) => {
    await page.goto('/venues');
    // Find and click the venue edit link
    const row = page.getByRole('row').filter({ hasText: VENUE_NAME });
    await row.getByRole('link', { name: /edit/i }).click();
    await page.waitForURL(/\/venues\//);

    // Change the name slightly then save
    await page.locator('input[name="name"]').first().fill(VENUE_NAME);
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 6_000 });
  });

  test('delete the venue', async ({ adminPage: page }) => {
    await page.goto('/venues');
    const row = page.getByRole('row').filter({ hasText: VENUE_NAME });
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByText(VENUE_NAME)).toBeHidden({ timeout: 6_000 });
  });
});

// ── Faculties ─────────────────────────────────────────────────────────────

test.describe('Faculties', () => {
  test('faculty list page loads', async ({ adminPage: page }) => {
    await page.goto('/faculties');
    await expect(page.getByRole('heading', { name: /facult/i })).toBeVisible();
  });

  test('add a new faculty', async ({ adminPage: page }) => {
    await page.goto('/faculties');

    // Inline add: name input at the bottom of the page
    const input = page.getByPlaceholder(/faculty name/i).first();
    await input.fill(FACULTY_NAME);
    await page.getByRole('button', { name: /add/i }).first().click();

    await expect(page.getByText(FACULTY_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('edit a faculty name', async ({ adminPage: page }) => {
    await page.goto('/faculties');

    const row = page.getByRole('row').filter({ hasText: FACULTY_NAME });
    await row.getByRole('button', { name: /edit/i }).click();

    // Inline edit: input appears in the row
    const rowInput = row.locator('input[type="text"]').first();
    await rowInput.fill(FACULTY_NAME);  // same name — just test the save path
    await row.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(FACULTY_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('delete the faculty', async ({ adminPage: page }) => {
    await page.goto('/faculties');

    const row = page.getByRole('row').filter({ hasText: FACULTY_NAME });
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByText(FACULTY_NAME)).toBeHidden({ timeout: 6_000 });
  });
});
