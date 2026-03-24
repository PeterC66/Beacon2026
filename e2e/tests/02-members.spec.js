// beacon2/e2e/tests/02-members.spec.js
// Member management tests.
// Beacon UG §4   — "Membership"
// Beacon UG §4.1 — "The Membership List"
// Beacon UG §4.2 — "The Member Record"
// Beacon UG §4.3 — "Add a New Member"
//
// Tests:
//  ✓ Member list loads and displays filter controls
//  ✓ Add a new member (minimal required fields) → appears in list
//  ✓ Edit a member → changes saved
//  ✓ Search by surname → filters list
//  ✓ Validation: save without surname shows error
//  ✓ Delete a member → removed from list

import { test, expect } from '../fixtures/admin.js';
import { MemberListPage } from '../pages/MemberListPage.js';
import { MemberEditorPage } from '../pages/MemberEditorPage.js';

// Unique-enough suffix to avoid collisions if tests are run concurrently
const SUFFIX = Date.now();
const TEST_SURNAME   = `E2ETest${SUFFIX}`;
const TEST_FORENAMES = 'Alice';

test.describe('Member list', () => {
  test('page loads with filter controls', async ({ adminPage: page }) => {
    const listPage = new MemberListPage(page);
    await listPage.goto();

    await expect(listPage.heading()).toBeVisible();
    // Search input present
    await expect(listPage.searchInput()).toBeVisible();
    // "Add new member" link present (top + bottom NavBar both have one; use .first())
    await expect(page.getByRole('link', { name: 'Add new member' }).first()).toBeVisible();
  });

  test('alphabet jump links are shown', async ({ adminPage: page }) => {
    await new MemberListPage(page).goto();
    // A-Z quick-jump bar
    await expect(page.getByText('A').first()).toBeVisible();
    await expect(page.getByText('Z').first()).toBeVisible();
  });
});

test.describe('Add new member', () => {
  let createdMemberUrl;

  test('create a member with required fields', async ({ adminPage: page }) => {
    const editor = new MemberEditorPage(page);
    await editor.gotoNew();

    await editor.fillMinimal({
      forenames:  TEST_FORENAMES,
      surname:    TEST_SURNAME,
      statusName: 'Current',
      className:  'Individual',
      postcode:   'OX1 1AA',
      joinedOn:   '01/01/2024',
    });

    await editor.saveButton().click();
    await expect(editor.successBanner()).toBeVisible({ timeout: 10_000 });

    // After save, URL changes to the edit URL (/members/:id)
    await page.waitForURL(/\/members\/[^/]+$/, { timeout: 10_000 });
    createdMemberUrl = page.url();

    // Success: page now shows the member's name in the heading
    await expect(page.getByText(TEST_SURNAME)).toBeVisible();
  });

  test('newly created member appears in the member list', async ({ adminPage: page }) => {
    const listPage = new MemberListPage(page);
    await listPage.goto();
    await listPage.search(TEST_SURNAME);

    await expect(page.getByText(TEST_SURNAME)).toBeVisible();
  });
});

test.describe('Edit a member', () => {
  test('change known-as name and save', async ({ adminPage: page }) => {
    // Find our test member
    const listPage = new MemberListPage(page);
    await listPage.goto();
    await listPage.search(TEST_SURNAME);

    // Click Edit
    await listPage.editLinkForMember(TEST_SURNAME).click();
    await page.waitForURL(/\/members\/[^/]+$/);

    // Change knownAs
    const editor = new MemberEditorPage(page);
    await editor.knownAsInput().fill('Ali');
    await editor.saveButton().click();

    // Success banner should appear
    await expect(editor.successBanner()).toBeVisible({ timeout: 6_000 });
  });
});

test.describe('Member search', () => {
  test('search by surname filters the list', async ({ adminPage: page }) => {
    const listPage = new MemberListPage(page);
    await listPage.goto();
    await listPage.search(TEST_SURNAME);

    // At least one result containing the surname
    await expect(page.getByText(TEST_SURNAME).first()).toBeVisible();
  });

  test('search with no match shows empty table', async ({ adminPage: page }) => {
    const listPage = new MemberListPage(page);
    await listPage.goto();
    await listPage.search('ZZZNoSuchPersonXXX99');

    // Row count should be 0 (just header row remains)
    const count = await listPage.memberRowCount();
    expect(count).toBe(0);
  });
});

test.describe('Member validation', () => {
  test('cannot save without a surname', async ({ adminPage: page }) => {
    const editor = new MemberEditorPage(page);
    await editor.gotoNew();

    // Fill forenames only — no surname
    await editor.forenamesInput().fill('Noname');
    await editor.statusSelect().selectOption({ label: 'Current' });
    await editor.classSelect().selectOption({ label: 'Individual' });
    await editor.postcodeInput().fill('OX1 1AA');

    await editor.saveButton().click();

    // Should still be on the new-member page or show an error
    // (either the URL stays /members/new or an error message is shown)
    const url = page.url();
    const onNewPage = url.includes('/members/new');
    const errorVisible = await editor.errorBanner().isVisible();
    expect(onNewPage || errorVisible).toBe(true);
  });

  test('invalid UK postcode is rejected', async ({ adminPage: page }) => {
    const editor = new MemberEditorPage(page);
    await editor.gotoNew();

    await editor.forenamesInput().fill('Test');
    await editor.surnameInput().fill('Postcode');
    await editor.statusSelect().selectOption({ label: 'Current' });
    await editor.classSelect().selectOption({ label: 'Individual' });
    await editor.postcodeInput().fill('NOT-A-POSTCODE');

    await editor.saveButton().click();

    const url = page.url();
    const stayed = url.includes('/members/new');
    const errorVisible = await editor.errorBanner().isVisible();
    expect(stayed || errorVisible).toBe(true);
  });
});

test.describe('Delete a member', () => {
  test('delete the test member', async ({ adminPage: page }) => {
    // Navigate to the test member
    const listPage = new MemberListPage(page);
    await listPage.goto();
    await listPage.search(TEST_SURNAME);
    await listPage.editLinkForMember(TEST_SURNAME).click();
    await page.waitForURL(/\/members\/[^/]+$/);

    // Click Delete and confirm the dialog
    page.once('dialog', (dialog) => dialog.accept());
    await new MemberEditorPage(page).deleteButton().click();

    // After deletion, navigates back to /members
    await page.waitForURL('/members', { timeout: 10_000 });

    // Confirm member no longer appears
    await listPage.search(TEST_SURNAME);
    const count = await listPage.memberRowCount();
    expect(count).toBe(0);
  });
});
