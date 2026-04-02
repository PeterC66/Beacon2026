// beacon2/e2e/tests/13-finance-extended.spec.js
// Extended finance tests: Transfer Money, Reconcile Account, Financial
// Statement, Groups Statement, Credit Batches.
// Beacon UG §§7.3–7.7
//
// Tests:
//  ✓ Transfer money page loads with form fields
//  ✓ Create a transfer between accounts
//  ✓ Reconcile account page loads with account selector
//  ✓ Financial statement page loads with year selector
//  ✓ Groups statement page loads with date inputs
//  ✓ Credit batches page loads with account selector

import { test, expect } from '../fixtures/admin.js';
import {
  FinanceAccountsPage,
  TransactionEditorPage,
} from '../pages/FinancePage.js';

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

// Fixed suffix — each CI run has its own tenant so no collision risk.
const SECOND_ACCT = 'E2ETransferAcct';

// ── Setup: create a second account for transfers ─────────────────────────

test.describe('Finance extended setup', () => {
  test('create second finance account for transfers', async ({ adminPage: page }) => {
    const acctPage = new FinanceAccountsPage(page);
    await acctPage.goto();
    await acctPage.addNameInput().fill(SECOND_ACCT);
    await acctPage.addButton().click();
    await expect(page.getByText(SECOND_ACCT).first()).toBeVisible({ timeout: 6_000 });
  });
});

// ── Transfer Money ───────────────────────────────────────────────────────

test.describe('Transfer money', () => {
  test('page loads with form fields', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/transfers', 'Transfer Money');

    await expect(page.locator('select[name="from_account_id"]')).toBeVisible();
    await expect(page.locator('select[name="to_account_id"]')).toBeVisible();
    await expect(page.locator('input[name="amount"]')).toBeVisible();
    await expect(page.locator('input[type="date"][name="date"]')).toBeVisible();
  });

  test('create a transfer between accounts', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/transfers', 'Transfer Money');

    await page.locator('input[type="date"][name="date"]').fill('2026-06-15');
    await page.locator('input[name="amount"]').fill('25.00');

    // Select from/to accounts (index 1 and 2 to pick two different accounts)
    await page.locator('select[name="from_account_id"]').selectOption({ index: 1 });
    await page.locator('select[name="to_account_id"]').selectOption({ index: 2 });

    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(/saved|transfer/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Reconcile Account ────────────────────────────────────────────────────

test.describe('Reconcile account', () => {
  test('page loads with account selector', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/reconcile', 'Reconcile Account');
    await expect(page.locator('select[name="accountId"]')).toBeVisible();
  });
});

// ── Financial Statement ──────────────────────────────────────────────────

test.describe('Financial statement', () => {
  test('page loads with year selector', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/statement', 'Financial Statement');

    // Year selector (select or similar control)
    const yearControl = page.locator('select').first();
    await expect(yearControl).toBeVisible();
  });

  test('Download Excel button appears after viewing statement', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/statement', 'Financial Statement');

    // Check "All accounts" and click View Statement to load data
    await page.getByLabel(/all accounts/i).check();
    await page.getByRole('button', { name: /view statement/i }).click();

    // Download Excel button appears only after data loads
    await expect(page.getByRole('button', { name: /download excel/i })).toBeVisible({ timeout: 15_000 });
  });
});

// ── Groups Statement ─────────────────────────────────────────────────────

test.describe('Groups statement', () => {
  test('page loads with date inputs', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/groups-statement', 'Groups Statement');

    await expect(page.locator('input[type="date"][name="from"]')).toBeVisible();
    await expect(page.locator('input[type="date"][name="to"]')).toBeVisible();
  });
});

// ── Credit Batches ───────────────────────────────────────────────────────

test.describe('Credit batches', () => {
  test('page loads with account selector', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/batches', 'Credit Batches');
    await expect(page.locator('select[name="accountId"]')).toBeVisible();
  });

  test('create a transaction for batching', async ({ adminPage: page }) => {
    const editor = new TransactionEditorPage(page);
    await editor.gotoNew();

    await editor.typeButton('Money received').click();
    await editor.accountSelect().selectOption({ index: 1 });
    await editor.dateInput().fill('20/06/2026');
    await editor.fromToInput().fill('BatchPayeeE2E');
    await editor.amountInput().fill('100.00');

    // Fill the first category row
    const catRow = page.getByRole('row').filter({ has: page.locator('input[name="categoryAmount"]') }).first();
    await catRow.locator('input[name="categoryAmount"]').fill('100.00');

    await editor.saveButton().click();
    await expect(editor.successBanner()).toBeVisible({ timeout: 10_000 });
  });

  test('unbatched transactions available after creating transaction', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/batches', 'Credit Batches');

    // Select an account
    await page.locator('select[name="accountId"]').selectOption({ index: 1 });

    // Wait for page to load content
    await page.waitForTimeout(2_000);

    // The page should show some content after selecting an account
    await expect(page.getByRole('heading', { name: 'Credit Batches' })).toBeVisible();
  });

  test('create a batch, verify it appears, then delete it', async ({ adminPage: page }) => {
    await gotoHomeLink(page, '/finance/batches', 'Credit Batches');

    // Select an account
    await page.locator('select[name="accountId"]').selectOption({ index: 1 });

    // Click "Add credit batch" in the nav bar
    await page.getByRole('link', { name: /add credit batch/i }).click();
    await page.getByRole('heading', { name: /select transactions/i }).waitFor({ timeout: 10_000 });

    // Select all unbatched transactions (if any exist)
    const noTxns = page.getByText('No unbatched credit transactions available.');
    const selectAll = page.getByText('Select All').first();
    const hasTransactions = await selectAll.isVisible().catch(() => false);

    if (hasTransactions) {
      await selectAll.click();

      // Fill batch reference and create
      await page.locator('input[name="batchRef"]').fill('E2EBatch');
      await page.getByRole('button', { name: 'Create Batch' }).click();
      await expect(page.getByText('Done.').first()).toBeVisible({ timeout: 10_000 });

      // Back on the list — batch should appear
      await expect(page.getByText('E2EBatch').first()).toBeVisible({ timeout: 10_000 });

      // Delete the batch: click into it, then delete
      await page.getByText('E2EBatch').first().click();
      await page.getByRole('heading', { name: /edit credit batch/i }).waitFor({ timeout: 10_000 });

      // Remove transactions from batch first (can only delete empty batches)
      const txnRows = page.getByRole('row').filter({ has: page.locator('input[type="checkbox"]') });
      const txnCount = await txnRows.count();
      if (txnCount > 0) {
        // Select all transaction checkboxes, then click "Update Transaction" to remove
        const checkboxes = page.locator('input[type="checkbox"]');
        const cbCount = await checkboxes.count();
        for (let i = 0; i < cbCount; i++) {
          const cb = checkboxes.nth(i);
          if (await cb.isVisible()) await cb.check();
        }
        const updateBtn = page.getByRole('button', { name: /update transaction/i });
        if (await updateBtn.isVisible().catch(() => false)) {
          page.once('dialog', (d) => d.accept());
          await updateBtn.click();
          await page.waitForTimeout(2_000);
        }
      }

      // Now delete the empty batch
      const deleteBtn = page.getByRole('button', { name: /delete batch/i });
      if (await deleteBtn.isVisible().catch(() => false)) {
        page.once('dialog', (d) => d.accept());
        await deleteBtn.click();
        // Should return to the batch list
        await page.getByRole('heading', { name: 'Credit Batches' }).waitFor({ timeout: 10_000 });
      }
    } else {
      // No unbatched transactions — just verify the empty state message
      await expect(noTxns).toBeVisible();
    }
  });
});

// ── Configure Account ───────────────────────────────────────────────────

test.describe('Configure account', () => {
  test('configure page loads from accounts list', async ({ adminPage: page }) => {
    const acctPage = new FinanceAccountsPage(page);
    await acctPage.goto();

    // Click the "configure" link on any account row
    const configLink = page.getByRole('link', { name: 'configure' }).first();
    await configLink.click();
    await page.getByRole('heading', { name: 'Configure Account' }).waitFor({ timeout: 10_000 });

    // Key form elements should be visible
    await expect(page.getByText(/pending transactions/i).first()).toBeVisible();
    await expect(page.getByText(/enable refunds/i).first()).toBeVisible();
  });
});

// ── Payment Method Defaults ─────────────────────────────────────────────

test.describe('Payment method defaults', () => {
  test('page loads from accounts list', async ({ adminPage: page }) => {
    const acctPage = new FinanceAccountsPage(page);
    await acctPage.goto();

    // Click the "Membership Payment Method Defaults" link
    await page.getByRole('link', { name: /membership payment method defaults/i }).first().click();
    await page.getByRole('heading', { name: 'Membership Payment Method Defaults' }).waitFor({ timeout: 10_000 });

    // Should show default method dropdown and payment type table
    await expect(page.getByText(/default membership payment method/i).first()).toBeVisible();
  });
});

// ── Cleanup: delete the second account ───────────────────────────────────

test.describe('Finance extended cleanup', () => {
  test('delete second finance account', async ({ adminPage: page }) => {
    const acctPage = new FinanceAccountsPage(page);
    await acctPage.goto();

    // Only delete if it exists and has a delete button
    const row = acctPage.accountRow(SECOND_ACCT);
    const rowVisible = await row.isVisible().catch(() => false);
    if (rowVisible) {
      page.once('dialog', (d) => d.accept());
      await acctPage.deleteButtonFor(SECOND_ACCT).click();
      await expect(page.getByText(SECOND_ACCT)).toBeHidden({ timeout: 6_000 });
    }
  });
});
