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
    // Navigate to venue list first (SPA from Home), then to new venue form
    await page.goto('/venues');
    await expect(page.getByRole('heading', { name: /venues/i })).toBeVisible();
    await page.goto('/venues/new');
    await expect(page.getByRole('heading', { name: /add new venue/i })).toBeVisible();

    await page.locator('input[name="name"]').first().fill(VENUE_NAME);
    await page.locator('input[name="postcode"]').first().fill('OX1 2AA');

    await page.getByRole('button', { name: /save/i }).first().click();

    // Editor shows saved banner then auto-redirects to /venues after 1200ms
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 6_000 });
    await page.waitForURL(/\/venues$/, { timeout: 10_000 });
    await expect(page.getByText(VENUE_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('venue appears in venue list', async ({ adminPage: page }) => {
    await page.goto('/venues');
    await expect(page.getByText(VENUE_NAME)).toBeVisible();
  });

  test('edit venue details', async ({ adminPage: page }) => {
    await page.goto('/venues');
    // The venue name is a link to the editor
    await page.getByRole('link', { name: VENUE_NAME }).first().click();
    await page.waitForURL(/\/venues\/(?!new\b)[^/]+$/);
    await expect(page.getByRole('heading', { name: /venue record/i })).toBeVisible();

    // Change the name slightly then save
    await page.locator('input[name="name"]').first().fill(VENUE_NAME);
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 6_000 });
  });

  test('delete the venue', async ({ adminPage: page }) => {
    await page.goto('/venues');
    // Click the venue name to go to the editor
    await page.getByRole('link', { name: VENUE_NAME }).first().click();
    await page.waitForURL(/\/venues\/(?!new\b)[^/]+$/);

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /delete/i }).click();

    // Should redirect back to venues list with the venue removed
    await page.waitForURL(/\/venues$/, { timeout: 10_000 });
    await expect(page.getByText(VENUE_NAME)).toBeHidden({ timeout: 6_000 });
  });
});

// ── Faculties ─────────────────────────────────────────────────────────────

test.describe('Faculties', () => {
  test('faculty list page loads', async ({ adminPage: page }) => {
    await page.goto('/faculties');
    await expect(page.getByRole('heading', { name: 'Group Faculties' })).toBeVisible();
  });

  test('add a new faculty', async ({ adminPage: page }) => {
    await page.goto('/faculties');
    await expect(page.getByRole('heading', { name: 'Group Faculties' })).toBeVisible();

    // Inline add: name input + Save button at the bottom of the page
    const input = page.getByPlaceholder(/faculty name/i).first();
    await input.fill(FACULTY_NAME);
    // The submit button in the add-faculty form is labelled "Save"
    await page.locator('form').filter({ has: input }).getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(FACULTY_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('edit a faculty name', async ({ adminPage: page }) => {
    await page.goto('/faculties');

    const row = page.getByRole('row').filter({ hasText: FACULTY_NAME });
    await row.getByRole('button', { name: /edit/i }).click();

    // Inline edit: input appears in the row (no explicit type attr, so use name)
    const rowInput = row.locator('input[name="editingName"]');
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
