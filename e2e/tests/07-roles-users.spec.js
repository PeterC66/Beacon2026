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
import { MemberEditorPage } from '../pages/MemberEditorPage.js';

const SUFFIX    = Date.now();
const ROLE_NAME = `E2ERole${SUFFIX}`;
const USER_UNAME = `e2euser${SUFFIX % 100000}`;  // keep to <=12 lowercase chars
const MEMBER_SURNAME   = `E2EUserMbr${SUFFIX}`;
const MEMBER_FORENAMES = 'Test';

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
    // Step 1: Create a member to link to the new user
    const memberEditor = new MemberEditorPage(page);
    await memberEditor.gotoNew();
    await memberEditor.surnameInput().fill(MEMBER_SURNAME);
    await memberEditor.forenamesInput().fill(MEMBER_FORENAMES);
    await memberEditor.saveButton().click();
    // Wait for save success (banner appears, then SPA redirects after 1200ms)
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 10_000 });

    // Step 2: Navigate to the users list
    const userList = new UserListPage(page);
    await userList.goto();

    // Step 3: Click "Add New User" link
    await userList.addNewLink().click();
    await page.getByRole('heading', { name: 'Add New User' }).waitFor({ timeout: 10_000 });

    // Step 4: Select the member from the dropdown
    const memberSelect = page.locator('select[name="memberId"]');
    await memberSelect.selectOption({ label: new RegExp(MEMBER_SURNAME) });

    // Step 5: Fill required fields
    await page.locator('input[name="username"]').fill(USER_UNAME);
    await page.locator('input[name="email"]').fill(`${USER_UNAME}@beacon2-e2e.invalid`);

    await page.getByRole('button', { name: /save user/i }).click();

    // After save, should show temp password notice or success
    await expect(page.getByText(/temporary password|saved/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('new user appears in the users list', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();
    // The user's display name comes from the linked member
    await expect(page.getByText(MEMBER_SURNAME)).toBeVisible();
  });

  test('edit user username', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();

    // Click the user name (member surname) to navigate to the editor
    await userList.nameButton(new RegExp(MEMBER_SURNAME)).click();
    await page.getByRole('heading', { name: 'System User Record' }).waitFor({ timeout: 10_000 });

    // Change email and save
    await page.locator('input[name="email"]').fill(`${USER_UNAME}2@beacon2-e2e.invalid`);
    await page.getByRole('button', { name: /save user/i }).click();

    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 6_000 });
  });

  test('delete the new user', async ({ adminPage: page }) => {
    const userList = new UserListPage(page);
    await userList.goto();

    // Delete button is in the user list row (not on the editor page)
    const row = userList.userRow(MEMBER_SURNAME);
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    await expect(row).toBeHidden({ timeout: 6_000 });
  });
});
