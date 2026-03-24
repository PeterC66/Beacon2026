// beacon2/e2e/pages/FinancePage.js
// Page Object Models for Finance pages.
// Beacon UG §7 — "Finance"

export class FinanceAccountsPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // SPA navigation — see CLAUDE-E2E.md
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/finance/accounts"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/finance/accounts');
    await this.page.getByRole('heading', { name: 'Finance Accounts' }).waitFor();
  }

  addNameInput()  { return this.page.getByPlaceholder(/account name/i); }
  addButton()     { return this.page.getByRole('button', { name: /save/i }).first(); }
  accountRow(name) {
    return this.page.getByRole('row').filter({ hasText: name });
  }
  deleteButtonFor(name) {
    return this.accountRow(name).getByRole('button', { name: /delete/i });
  }
}

export class FinanceCategoriesPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // SPA navigation — see CLAUDE-E2E.md
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/finance/categories"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/finance/categories');
    await this.page.getByRole('heading', { name: 'Finance Categories' }).waitFor();
  }

  addNameInput()  { return this.page.getByPlaceholder(/category name/i); }
  addButton()     { return this.page.getByRole('button', { name: /save/i }).first(); }
  categoryRow(name) {
    return this.page.getByRole('row').filter({ hasText: name });
  }
}

export class TransactionEditorPage {
  constructor(page) {
    this.page = page;
  }

  async gotoNew() {
    // SPA navigation — see CLAUDE-E2E.md
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/finance/transactions/new"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/finance/transactions/new');
    await this.page.getByRole('heading', { name: 'Add Transaction' }).waitFor();
  }

  /** Transaction type toggle — buttons labelled "Money received" / "Payment" */
  typeButton(label) { return this.page.getByRole('button', { name: label }); }
  accountSelect() { return this.page.locator('select[name="account_id"]'); }
  dateInput()     { return this.page.getByPlaceholder('dd/mm/yyyy').first(); }
  fromToInput()   { return this.page.locator('input[name="from_to"]'); }
  detailInput()   { return this.page.locator('input[name="detail"], textarea[name="detail"]').first(); }
  amountInput()   { return this.page.locator('input[name="amount"]'); }
  saveButton()    { return this.page.getByRole('button', { name: /save/i }).first(); }
  deleteButton()  { return this.page.getByRole('button', { name: /delete/i }).first(); }
  successBanner() { return this.page.getByText(/saved/i).first(); }
}

export class FinanceLedgerPage {
  constructor(page) {
    this.page = page;
  }

  /** @private SPA-navigate to /finance/ledger, preserving auth token */
  async _gotoLedger() {
    // Wait for the SPA link to exist in the DOM before clicking
    await this.page.waitForSelector('a[href="/finance/ledger"]', { timeout: 5_000 }).catch(() => null);
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/finance/ledger"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/finance/ledger');
    await this.page.getByRole('heading', { name: /ledger/i }).waitFor();
  }

  async gotoByAccount() {
    await this._gotoLedger();
  }

  async gotoByCategory() {
    await this._gotoLedger();
  }

  async gotoByGroup() {
    await this._gotoLedger();
  }

  transactionRow(payee) {
    return this.page.getByRole('row').filter({ hasText: payee });
  }

  addTransactionLink() {
    return this.page.getByRole('link', { name: /add transaction/i });
  }
}
