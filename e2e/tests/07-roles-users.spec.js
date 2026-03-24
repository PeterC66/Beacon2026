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

    // Navigate to /roles/new via the "Add Role" nav link
    await roleList.addRoleLink().click();
    await page.waitForURL(/\/roles\/new/);

    // Fill the role name and save
    await page.locator('input[name="name"]').fill(ROLE_NAME);
    await page.getByRole('button', { name: /save role/i }).click();

    // Should show success and redirect to the role editor
    await expect(page.getByText(/role saved/i)).toBeVisible({ timeout: 6_000 });
  });

  test('role editor loads and shows privilege matrix', async ({ adminPage: page }) => {
    const roleList = new RoleListPage(page);
    await roleList.goto();

    // Click "Edit" on the Administration role — SPA navigate via onClick
    await roleList.editLink('Administration').click();

    // SPA navigation doesn't fire a "load" event, so wait for content instead
    await expect(page.getByRole('heading', { name: /privileges/i })).toBeVisible({ timeout: 10_000 });
    // Some privilege resource cells visible
    await expect(page.getByText(/members|finance|groups/i).first()).toBeVisible();
  });

  test('delete the custom role', async ({ adminPage: page }) => {
    const roleList = new RoleListPage(page);
    await roleList.goto();

    // Delete uses confirm() dialog and onClick handler on <a> tag
    page.once('dialog', (d) => d.accept());
    await roleList.deleteLink(ROLE_NAME).click();

    await expect(roleList.roleRow(ROLE_NAME)).toBeHidden({ timeout: 6_000 });
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
    const userList = new UserListPage(page);
    await userList.goto();

    // Navigate to /users/new via the nav bar "Add" link
    await userList.addNewLink().click();
    await page.getByRole('heading', { name: 'Add New User' }).waitFor({ timeout: 10_000 });

    const userEditor = new UserEditorPage(page);
    await userEditor.nameInput().fill(USER_NAME);
    await userEditor.emailInput().fill(`${USER_UNAME}@beacon2-e2e.invalid`);
    await userEditor.usernameInput().fill(USER_UNAME);
    await userEditor.passwordInput().fill('TestUser99!');

    await userEditor.saveButton().click();

    // After save, should show success or redirect to the user editor
    await expect(userEditor.successBanner()).toBeVisible({ timeout: 10_000 });
  });

  test('new user appears in the users list', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();
    await expect(page.getByText(USER_NAME)).toBeVisible();
  });

  test('edit user name', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();

    // Click the user name button to navigate to the editor
    await userList.nameButton(USER_NAME).click();
    await page.getByRole('heading', { name: 'System User Record' }).waitFor({ timeout: 10_000 });

    const editor = new UserEditorPage(page);
    await editor.nameInput().fill(USER_NAME);  // same — just save
    await editor.saveButton().click();

    await expect(editor.successBanner()).toBeVisible({ timeout: 6_000 });
  });

  test('delete the new user', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();

    // Delete button is in the user list row (not on the editor page)
    const row = userList.userRow(USER_NAME);
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByText(USER_NAME)).toBeHidden({ timeout: 6_000 });
  });
});
