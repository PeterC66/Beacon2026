// beacon2/e2e/tests/16-email.spec.js
// Email module tests: Compose (no send), Delivery, Unblocker.
// Beacon UG §§6.1–6.1.5
//
// NOTE: SendGrid integration is not live in the test environment.
// Email compose is tested up to form filling but NOT the Send action.
//
// Tests:
//  ✓ Email Delivery page loads with heading and date filters
//  ✓ Email Unblocker page loads with email input
//  ✓ Email Compose page loads (via direct navigation with pre-set recipients)

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

// ── Email Delivery ───────────────────────────────────────────────────────

test.describe('Email Delivery', () => {
  test('page loads with heading and date filters', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/email/delivery', 'Email Delivery');

    // Date filter inputs
    const dateInputs = page.getByPlaceholder('dd/mm/yyyy');
    await expect(dateInputs.first()).toBeVisible();
  });
});

// ── Email Unblocker ──────────────────────────────────────────────────────

test.describe('Email Unblocker', () => {
  test('page loads with email input', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/email/unblocker', 'Email Unblocker');

    // Email input field
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  });

  test('unblock button is present', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/email/unblocker', 'Email Unblocker');
    await expect(page.getByRole('button', { name: /unblock/i })).toBeVisible();
  });
});

// ── Email Compose ────────────────────────────────────────────────────────
// EmailCompose reads recipient IDs from sessionStorage.emailComposeMemberIds.
// We pre-set an empty array so the page loads without recipients.

test.describe('Email Compose', () => {
  test('page loads with compose form', async ({ adminPage: page }) => {
    // Pre-set empty recipients in sessionStorage so page loads
    await page.evaluate(() => {
      sessionStorage.setItem('emailComposeMemberIds', JSON.stringify([]));
    });

    // No Home link exists for email compose — navigate directly
    await page.goto('/email/compose');
    await page.getByRole('heading', { name: 'Send Email' }).waitFor({ timeout: 10_000 });

    // Core form elements present
    await expect(page.getByText(/from/i).first()).toBeVisible();
    await expect(page.getByText(/subject/i).first()).toBeVisible();
  });
});
