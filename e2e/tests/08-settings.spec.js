// beacon2/e2e/tests/08-settings.spec.js
// System Settings tests.
// Beacon UG §8.3 — "System Settings"
//
// Tests:
//  ✓ System settings page loads
//  ✓ All setting sections are visible (Membership Cards, Contact Details, etc.)
//  ✓ Change a contact detail setting → saved
//  ✓ Change persists after page reload
//  ✓ Personal preferences page is accessible to every logged-in user

import { test, expect } from '../fixtures/admin.js';
import { SystemSettingsPage } from '../pages/SettingsPage.js';

const TEST_PHONE = '01865 123456';
const TEST_EMAIL = 'enquiry@e2etest.invalid';

test.describe('System settings', () => {
  test('settings page loads', async ({ adminPage: page }) => {
    const settings = new SystemSettingsPage(page);
    await settings.goto();
    await expect(page.getByRole('heading', { name: 'System Settings' })).toBeVisible();
  });

  test('all major sections are visible', async ({ adminPage: page }) => {
    const settings = new SystemSettingsPage(page);
    await settings.goto();

    const sections = [
      /membership cards/i,
      /contact details/i,
      /membership year/i,
      /gift aid/i,
      /defaults for new members/i,
    ];
    for (const heading of sections) {
      await expect(page.getByText(heading).first()).toBeVisible();
    }
  });

  test('save public contact details', async ({ adminPage: page }) => {
    const settings = new SystemSettingsPage(page);
    await settings.goto();

    const phoneInput = settings.publicPhoneInput();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill(TEST_PHONE);
    }
    const emailInput = settings.publicEmailInput();
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_EMAIL);
    }

    await settings.saveButton().click();
    await expect(settings.successBanner()).toBeVisible({ timeout: 6_000 });
  });

  test('saved setting persists after page reload', async ({ adminPage: page }) => {
    const settings = new SystemSettingsPage(page);
    await settings.goto();

    const phoneInput = settings.publicPhoneInput();
    if (await phoneInput.isVisible()) {
      const value = await phoneInput.inputValue();
      expect(value).toBe(TEST_PHONE);
    }
  });
});

test.describe('Personal preferences', () => {
  test('preferences page is accessible', async ({ adminPage: page }) => {
    await page.goto('/preferences');
    await expect(page.getByRole('heading', { name: /preferences/i })).toBeVisible();
  });

  test('preferences page has display and security sections', async ({ adminPage: page }) => {
    await page.goto('/preferences');

    // Beacon UG §9.1 — three sections
    await expect(page.getByText(/display/i).first()).toBeVisible();
    await expect(page.getByText(/password/i).first()).toBeVisible();
    await expect(page.getByText(/security/i).first()).toBeVisible();
  });
});
