// beacon2/e2e/tests/07-roles-users.spec.js
// Roles, privileges and system users tests.
// Beacon UG §8.1 — "Site Administration" (users)
// Beacon UG §8.4 — "Roles and Privileges"
//
// Tests:
//  ✓ Roles list loads with default roles
//  ✓ Add a new role → appears in list
//  ✓ Role editor loads with privilege matrix
//  ✓ Delete a custom role → removed
//  ✓ System users list loads with the admin user
//  ✓ Add a new system user → appears in list
//  ✓ Edit a system user → change saved
//  ✓ Delete a non-admin user → removed

import { test, expect } from '../fixtures/admin.js';
import { RoleListPage, UserListPage, UserEditorPage } from '../pages/SettingsPage.js';

const SUFFIX    = Date.now();
const ROLE_NAME = `E2ERole${SUFFIX}`;
const USER_NAME = `E2E User ${SUFFIX}`;
const USER_UNAME = `e2euser${SUFFIX % 100000}`;  // keep to <=12 lowercase chars

// ── Roles ─────────────────────────────────────────────────────────────────

test.describe('Roles', () => {
  test('roles list loads with default roles', async ({ adminPage: page }) => {
    const roleList = new RoleListPage(page);
    await roleList.goto();

    // Default roles seeded at tenant creation
    for (const r of ['Administration', 'Membership Secretary', 'Treasurer']) {
      await expect(page.getByText(r)).toBeVisible();
    }
  });

  test('add a new role', async ({ adminPage: page }) => {
    const roleList = new RoleListPage(page);
    await roleList.goto();

    await roleList.addNameInput().fill(ROLE_NAME);
    await roleList.addButton().click();

    await expect(page.getByText(ROLE_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('role editor loads and shows privilege matrix', async ({ adminPage: page }) => {
    const roleList = new RoleListPage(page);
    await roleList.goto();

    // Click on the Administration role to open its editor
    await roleList.roleLink('Administration').click();
    await page.waitForURL(/\/roles\//);

    // Privilege matrix should be visible
    await expect(page.getByRole('heading', { name: /Administration/i }).first()).toBeVisible();
    // Some privilege resource cells visible
    await expect(page.getByText(/members|finance|groups/i).first()).toBeVisible();
  });

  test('delete the custom role', async ({ adminPage: page }) => {
    const roleList = new RoleListPage(page);
    await roleList.goto();

    const row = roleList.roleRow(ROLE_NAME);
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByText(ROLE_NAME)).toBeHidden({ timeout: 6_000 });
  });
});

// ── System Users ──────────────────────────────────────────────────────────

test.describe('System users', () => {
  test('users list loads with the admin user', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();

    // The admin user created during global-setup should be visible
    await expect(page.getByText(/testadmin|Test Administrator/i).first()).toBeVisible();
  });

  test('add a new user', async ({ adminPage: page }) => {
    const userEditor = new UserEditorPage(page);
    await userEditor.gotoNew();

    await userEditor.nameInput().fill(USER_NAME);
    await userEditor.emailInput().fill(`${USER_UNAME}@beacon2-e2e.invalid`);
    await userEditor.usernameInput().fill(USER_UNAME);
    // Password input
    await page.locator('input[name="password"], input[type="password"]').first().fill('TestUser99!');

    await userEditor.saveButton().click();
    await page.waitForURL(/\/users\/[^/]+$/, { timeout: 10_000 });

    await expect(page.getByText(USER_NAME)).toBeVisible();
  });

  test('new user appears in the users list', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();
    await expect(page.getByText(USER_NAME)).toBeVisible();
  });

  test('edit user name', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();

    await userList.editLink(USER_NAME).click();
    await page.waitForURL(/\/users\/[^/]+$/);

    const editor = new UserEditorPage(page);
    await editor.nameInput().fill(USER_NAME);  // same — just save
    await editor.saveButton().click();

    await expect(editor.successBanner()).toBeVisible({ timeout: 6_000 });
  });

  test('delete the new user', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();

    await userList.editLink(USER_NAME).click();
    await page.waitForURL(/\/users\/[^/]+$/);

    page.once('dialog', (d) => d.accept());
    await new UserEditorPage(page).deleteButton().click();

    await page.waitForURL('/users', { timeout: 10_000 });
    await expect(page.getByText(USER_NAME)).toBeHidden({ timeout: 5_000 });
  });
});
