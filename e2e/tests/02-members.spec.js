// beacon2/e2e/tests/02-members.spec.js
// Member management tests.
// Beacon UG §4   — "Membership"
// Beacon UG §4.1 — "The Membership List"
// Beacon UG §4.2 — "The Member Record"
// Beacon UG §4.3 — "Add a New Member"
//
// Tests:
//  ✓ Member list loads and displays filter controls
//  ✓ Add a new member with payment → stays Current, appears in list
//  ✓ Add a new member without payment → becomes Applicant
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

// Second member for the no-payment (Applicant) path
const APPLICANT_SURNAME = `E2EAppl${SUFFIX}`;

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
  test('create a member with payment keeps status Current', async ({ adminPage: page }) => {
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

    // Include payment so the member stays "Current" (no payment → Applicant)
    await editor.fillPayment({ amount: '1', accountName: 'Current Account' });

    // If the amount is below the class fee, a confirm dialog warns about
    // underpayment. Accept it so the save proceeds.
    page.once('dialog', (d) => d.accept());
    await editor.saveButton().click();
    await expect(editor.successBanner()).toBeVisible({ timeout: 10_000 });

    // After save, URL changes to the edit URL (/members/:id)
    await page.waitForURL(/\/members\/[^/]+$/, { timeout: 10_000 });

    // Success: page now shows the member's name in the heading
    await expect(page.getByText(TEST_SURNAME)).toBeVisible();
  });

  test('create a member without payment saves as Applicant', async ({ adminPage: page }) => {
    const editor = new MemberEditorPage(page);
    await editor.gotoNew();

    await editor.fillMinimal({
      forenames:  'Bob',
      surname:    APPLICANT_SURNAME,
      statusName: 'Current',
      className:  'Individual',
      postcode:   'OX1 1AA',
      joinedOn:   '01/01/2024',
    });

    // No payment — backend will switch to Applicant.
    // If the member has an email, a confirm() dialog offers to email a payment link.
    // We don't set an email so no dialog fires.
    await editor.saveButton().click();
    await expect(editor.successBanner()).toBeVisible({ timeout: 10_000 });

    // After save, URL changes to the edit URL (/members/:id)
    await page.waitForURL(/\/members\/[^/]+$/, { timeout: 10_000 });

    // The status select (visible on the edit form) should show "Applicant"
    await expect(editor.statusSelect()).toHaveValue(/.+/);    // has some value
    const selectedText = await editor.statusSelect().evaluate(
      (sel) => sel.options[sel.selectedIndex]?.text,
    );
    expect(selectedText).toBe('Applicant');
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

    // When no members match, the component shows "No members found." instead
    // of a table — wait for that message before checking the count.
    await page.getByText('No members found.').waitFor({ timeout: 10_000 });
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
    // Status is auto-set to "Current" on the new-member form (hidden select)
    await editor.waitForClassOptions();
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
    // Status is auto-set to "Current" on the new-member form (hidden select)
    await editor.waitForClassOptions();
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
    await page.getByText('No members found.').waitFor({ timeout: 10_000 });
    const count = await listPage.memberRowCount();
    expect(count).toBe(0);
  });
});
