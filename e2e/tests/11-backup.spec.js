// beacon2/e2e/tests/11-backup.spec.js
// Data export and backup tests.
// Beacon UG §9.5 — "Data Export and Backup"
//
// Tests:
//  ✓ Backup page loads with all export options
//  ✓ Clicking a download button triggers an .xlsx file download
//  ✓ Member data validator page loads

import { test, expect } from '../fixtures/admin.js';

// Export option labels as shown in the UI (in the <div> text, not button text)
const EXPORT_LABELS = [
  /members/i,
  /finance/i,
  /groups/i,
  /calendar/i,
  /system/i,
  /officers/i,
  /settings/i,
];

/** SPA-navigate to /backup, preserving auth token */
async function gotoBackup(page) {
  await page.waitForSelector('a[href="/backup"]', { timeout: 5_000 }).catch(() => null);
  const clicked = await page.evaluate(() => {
    const link = document.querySelector('a[href="/backup"]');
    if (link) { link.click(); return true; }
    return false;
  });
  if (!clicked) await page.goto('/backup');
  await page.getByRole('heading', { name: /backup|export/i }).waitFor();
}

/** SPA-navigate to /admin/validate-members, preserving auth token */
async function gotoValidator(page) {
  await page.waitForSelector('a[href="/admin/validate-members"]', { timeout: 5_000 }).catch(() => null);
  const clicked = await page.evaluate(() => {
    const link = document.querySelector('a[href="/admin/validate-members"]');
    if (link) { link.click(); return true; }
    return false;
  });
  if (!clicked) await page.goto('/admin/validate-members');
  await page.getByRole('heading', { name: /validate|member data/i }).waitFor();
}

test.describe('Data export & backup', () => {
  test('backup page loads', async ({ adminPage: page }) => {
    await gotoBackup(page);
    await expect(page.getByRole('heading', { name: /backup|export/i })).toBeVisible();
  });

  test('all export-type labels are present', async ({ adminPage: page }) => {
    await gotoBackup(page);

    // Each export option has a label <div> with the type name and a "Download" button
    for (const label of EXPORT_LABELS) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    // The "Backup all data" button
    await expect(page.getByRole('button', { name: /backup all/i })).toBeVisible();
  });

  test('clicking first "Download" triggers an xlsx download', async ({ adminPage: page }) => {
    await gotoBackup(page);

    // All individual export buttons say "Download"; click the first one
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      page.getByRole('button', { name: /download/i }).first().click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });

  test('clicking "Backup all data" export triggers an xlsx download', async ({ adminPage: page }) => {
    await gotoBackup(page);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /backup all/i }).first().click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });
});

test.describe('Member data validator', () => {
  test('validator page loads', async ({ adminPage: page }) => {
    await gotoValidator(page);
    await expect(page.getByRole('heading', { name: /validate|member data/i })).toBeVisible();
  });

  test('validator shows result (valid or issues)', async ({ adminPage: page }) => {
    await gotoValidator(page);

    // Wait for the "Re-check now" button (always present once loaded)
    await expect(page.getByRole('button', { name: /re-check/i })).toBeVisible({ timeout: 15_000 });

    // After loading, either the "All valid" banner or flagged members appear
    const valid  = page.getByText(/all member data is valid/i);
    const flagged = page.getByText(/issues? found/i);

    // At least one of these should be visible
    await expect(valid.or(flagged)).toBeVisible({ timeout: 10_000 });
  });
});
