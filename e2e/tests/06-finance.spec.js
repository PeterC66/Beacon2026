// beacon2/e2e/tests/06-finance.spec.js
// Finance module tests.
// Beacon UG §7   — "Finance"
// Beacon UG §7.1 — "The Finance Ledger"
// Beacon UG §7.2 — "The Transaction Record"
// Beacon UG §8.6 — "Finance Set-Up" (accounts, categories)
//
// Tests:
//  ✓ Finance accounts page loads with the seeded "Current Account"
//  ✓ Add a finance account → appears in list
//  ✓ Delete a non-locked account → removed
//  ✓ Finance categories page loads
//  ✓ Add a finance category → appears in list
//  ✓ Delete a category → removed
//  ✓ Add a money-in transaction → appears in ledger
//  ✓ Finance ledger loads by account, category, and group

import { test, expect } from '../fixtures/admin.js';
import {
  FinanceAccountsPage,
  FinanceCategoriesPage,
  TransactionEditorPage,
  FinanceLedgerPage,
} from '../pages/FinancePage.js';

const SUFFIX    = Date.now();
const ACCT_NAME = `E2EAcct${SUFFIX}`;
const CAT_NAME  = `E2ECat${SUFFIX}`;
const PAYEE     = `E2EPayee${SUFFIX}`;

// ── Finance Accounts ──────────────────────────────────────────────────────

test.describe('Finance accounts', () => {
  test('accounts page loads with seeded Current Account', async ({ adminPage: page }) => {
    const acctPage = new FinanceAccountsPage(page);
    await acctPage.goto();
    await expect(page.getByText('Current Account')).toBeVisible();
  });

  test('add a new finance account', async ({ adminPage: page }) => {
    const acctPage = new FinanceAccountsPage(page);
    await acctPage.goto();

    await acctPage.addNameInput().fill(ACCT_NAME);
    await acctPage.addButton().click();

    await expect(page.getByText(ACCT_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('delete the new finance account', async ({ adminPage: page }) => {
    const acctPage = new FinanceAccountsPage(page);
    await acctPage.goto();

    page.once('dialog', (d) => d.accept());
    await acctPage.deleteButtonFor(ACCT_NAME).click();

    await expect(page.getByText(ACCT_NAME)).toBeHidden({ timeout: 6_000 });
  });
});

// ── Finance Categories ────────────────────────────────────────────────────

test.describe('Finance categories', () => {
  test('categories page loads', async ({ adminPage: page }) => {
    const catPage = new FinanceCategoriesPage(page);
    await catPage.goto();
    await expect(page.getByRole('heading', { name: /finance categor/i })).toBeVisible();
  });

  test('add a new category', async ({ adminPage: page }) => {
    const catPage = new FinanceCategoriesPage(page);
    await catPage.goto();

    await catPage.addNameInput().fill(CAT_NAME);
    await catPage.addButton().click();

    await expect(page.getByText(CAT_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('delete the new category', async ({ adminPage: page }) => {
    const catPage = new FinanceCategoriesPage(page);
    await catPage.goto();

    const row = catPage.categoryRow(CAT_NAME);
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByText(CAT_NAME)).toBeHidden({ timeout: 6_000 });
  });
});

// ── Transactions ──────────────────────────────────────────────────────────

test.describe('Finance transactions', () => {
  test('add a money-in transaction', async ({ adminPage: page }) => {
    const editor = new TransactionEditorPage(page);
    await editor.gotoNew();

    // Transaction type: money in
    const typeSelect = editor.typeSelect();
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption({ label: /in|income|receipt/i });
    }

    // Account
    const acctSelect = editor.accountSelect();
    if (await acctSelect.isVisible()) {
      await acctSelect.selectOption({ index: 0 });  // first available account
    }

    // Date — dd/mm/yyyy via DateInput component
    await editor.dateInput().fill('01/06/2026');

    // Payee and amount
    await editor.payeeInput().fill(PAYEE);
    await editor.amountInput().fill('50.00');

    await editor.saveButton().click();

    // After save, should redirect to the transaction list or show success
    await page.waitForURL(/\/finance\//, { timeout: 10_000 });
  });

  test('transaction appears in the finance ledger', async ({ adminPage: page }) => {
    const ledger = new FinanceLedgerPage(page);
    await ledger.gotoByAccount();

    // The payee should appear somewhere in the ledger
    await expect(page.getByText(PAYEE)).toBeVisible({ timeout: 6_000 });
  });
});

// ── Ledger views ──────────────────────────────────────────────────────────

test.describe('Finance ledger views', () => {
  test('ledger by account loads', async ({ adminPage: page }) => {
    await new FinanceLedgerPage(page).gotoByAccount();
    await expect(page.getByRole('heading', { name: /ledger/i })).toBeVisible();
  });

  test('ledger by category loads', async ({ adminPage: page }) => {
    await new FinanceLedgerPage(page).gotoByCategory();
    await expect(page.getByRole('heading', { name: /ledger/i })).toBeVisible();
  });

  test('ledger by group loads', async ({ adminPage: page }) => {
    await new FinanceLedgerPage(page).gotoByGroup();
    await expect(page.getByRole('heading', { name: /ledger/i })).toBeVisible();
  });
});
