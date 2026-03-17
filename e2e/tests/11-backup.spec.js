// beacon2/e2e/tests/11-backup.spec.js
// Data export and backup tests.
// Beacon UG §9.5 — "Data Export and Backup"
//
// Tests:
//  ✓ Backup page loads with all 8 export options
//  ✓ Clicking a download button triggers an .xlsx file download
//  ✓ Member data validator page loads

import { test, expect } from '../fixtures/admin.js';

// All eight export types listed in the backup UI (labels as shown in the UI)
const EXPORT_TYPES = [
  /members/i,
  /finance/i,
  /groups/i,
  /calendar/i,
  /system/i,
  /officers/i,
  /settings/i,
  /backup all/i,
];

test.describe('Data export & backup', () => {
  test('backup page loads', async ({ adminPage: page }) => {
    await page.goto('/backup');
    await expect(page.getByRole('heading', { name: /backup|export/i })).toBeVisible();
  });

  test('all export-type buttons are present', async ({ adminPage: page }) => {
    await page.goto('/backup');

    for (const label of EXPORT_TYPES) {
      await expect(page.getByRole('button', { name: label }).first()).toBeVisible();
    }
  });

  test('clicking "Members" export triggers an xlsx download', async ({ adminPage: page }) => {
    await page.goto('/backup');

    // Listen for the download event
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      page.getByRole('button', { name: /members/i }).first().click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });

  test('clicking "Backup all data" export triggers an xlsx download', async ({ adminPage: page }) => {
    await page.goto('/backup');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /backup all/i }).first().click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });
});

test.describe('Member data validator', () => {
  test('validator page loads', async ({ adminPage: page }) => {
    await page.goto('/admin/validate-members');
    await expect(page.getByRole('heading', { name: /validate|member data/i })).toBeVisible();
  });

  test('validator shows result (valid or issues)', async ({ adminPage: page }) => {
    await page.goto('/admin/validate-members');
    await page.waitForLoadState('networkidle');

    // Either a "All member data is valid!" banner or a list of issues
    const valid   = page.getByText(/all member data is valid/i);
    const issues  = page.getByRole('heading', { name: /issues?/i });
    const recheck = page.getByRole('button', { name: /re-check/i });

    const anyVisible = await Promise.any([
      valid.isVisible(),
      issues.isVisible(),
      recheck.isVisible(),
    ]);
    expect(anyVisible).toBe(true);
  });
});
