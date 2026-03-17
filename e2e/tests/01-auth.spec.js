// beacon2/e2e/tests/01-auth.spec.js
// Authentication tests.
// Beacon UG §2 — "Logging in as a System User"
//
// Tests:
//  ✓ Valid credentials → lands on home page
//  ✓ Wrong password   → shows error, stays on /login
//  ✓ Invalid tenant   → shows error, stays on /login
//  ✓ Logout           → returns to /login, home redirects back to /login

import { test, expect } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
import { LoginPage } from '../pages/LoginPage.js';
import { HomePage } from '../pages/HomePage.js';
loadDotenv();

const SLUG     = process.env.BEACON2_TEST_TENANT_SLUG    ?? 'e2etest';
const USERNAME = process.env.BEACON2_TEST_ADMIN_USERNAME ?? 'testadmin';
const PASSWORD = process.env.BEACON2_TEST_ADMIN_PASSWORD ?? 'TestAdmin99!';

test.describe('Login', () => {
  test('valid credentials reach the home page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAndWait(SLUG, USERNAME, PASSWORD);

    await expect(page).toHaveURL('/');
    await expect(new HomePage(page).heading()).toBeVisible();
  });

  test('wrong password shows an error and stays on /login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(SLUG, USERNAME, 'wrong-password-xyz');

    // Should remain on login page
    await expect(page).toHaveURL('/login');
    // Error message visible
    await expect(loginPage.errorMessage()).toBeVisible();
  });

  test('unknown tenant slug shows an error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login('no-such-u3a-slug', USERNAME, PASSWORD);

    await expect(page).toHaveURL('/login');
    await expect(loginPage.errorMessage()).toBeVisible();
  });

  test('login page shows version number', async ({ page }) => {
    await page.goto('/login');
    // Version string rendered at bottom of login page (e.g. "v0.3.17")
    await expect(page.getByText(/^v\d+\.\d+/)).toBeVisible();
  });
});

test.describe('Logout', () => {
  test('logging out returns to /login', async ({ page }) => {
    // Log in first
    const loginPage = new LoginPage(page);
    await loginPage.loginAndWait(SLUG, USERNAME, PASSWORD);

    // Log out
    const homePage = new HomePage(page);
    await homePage.logout();

    await expect(page).toHaveURL('/login');
  });

  test('after logout, navigating to / redirects to /login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAndWait(SLUG, USERNAME, PASSWORD);
    await new HomePage(page).logout();

    // Direct navigation to home should redirect to login
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
