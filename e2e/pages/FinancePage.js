// beacon2/e2e/pages/FinancePage.js
// Page Object Models for Finance pages.
// Beacon UG §7 — "Finance"

export class FinanceAccountsPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/finance/accounts');
    await this.page.getByRole('heading', { name: 'Finance Accounts' }).waitFor();
  }

  addNameInput()  { return this.page.getByPlaceholder(/account name/i); }
  addButton()     { return this.page.getByRole('button', { name: /add/i }).first(); }
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
    await this.page.goto('/finance/categories');
    await this.page.getByRole('heading', { name: 'Finance Categories' }).waitFor();
  }

  addNameInput()  { return this.page.getByPlaceholder(/category name/i); }
  addButton()     { return this.page.getByRole('button', { name: /add/i }).first(); }
  categoryRow(name) {
    return this.page.getByRole('row').filter({ hasText: name });
  }
}

export class TransactionEditorPage {
  constructor(page) {
    this.page = page;
  }

  async gotoNew() {
    await this.page.goto('/finance/transactions/new');
    await this.page.getByRole('heading', { name: /transaction/i }).waitFor();
  }

  typeSelect()    { return this.page.getByLabel(/type/i).first(); }
  accountSelect() { return this.page.getByLabel(/account/i).first(); }
  dateInput()     { return this.page.getByPlaceholder('dd/mm/yyyy').first(); }
  payeeInput()    { return this.page.locator('input[name="payee"]'); }
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

  async gotoByAccount() {
    await this.page.goto('/finance/ledger?view=account');
    await this.page.getByRole('heading', { name: /ledger/i }).waitFor();
  }

  async gotoByCategory() {
    await this.page.goto('/finance/ledger?view=category');
  }

  async gotoByGroup() {
    await this.page.goto('/finance/ledger?view=group');
  }

  transactionRow(payee) {
    return this.page.getByRole('row').filter({ hasText: payee });
  }

  addTransactionLink() {
    return this.page.getByRole('link', { name: /add transaction/i });
  }
}
