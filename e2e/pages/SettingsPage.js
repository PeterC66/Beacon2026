// beacon2/e2e/pages/SettingsPage.js
// Page Object Models for System Settings, Roles, and Users pages.
// Beacon UG §8 — "Set-Up Operations"

export class SystemSettingsPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // SPA navigation — see CLAUDE-E2E.md
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/settings"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/settings');
    await this.page.getByRole('heading', { name: 'System Settings' }).waitFor();
  }

  publicPhoneInput() { return this.page.locator('input[name="public_phone"], input[name="publicPhone"]').first(); }
  publicEmailInput() { return this.page.locator('input[name="public_email"], input[name="publicEmail"]').first(); }
  saveButton()       { return this.page.getByRole('button', { name: /update/i }).first(); }
  successBanner()    { return this.page.getByText(/saved|updated/i).first(); }
}

export class RoleListPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // SPA navigation — see CLAUDE-E2E.md
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/roles"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/roles');
    await this.page.getByRole('heading', { name: /roles/i }).waitFor();
  }

  /** "Add Role" nav link — navigates to /roles/new */
  addRoleLink() { return this.page.getByRole('link', { name: /add role/i }).first(); }

  roleRow(name) {
    return this.page.getByRole('row').filter({ hasText: name });
  }

  /** Edit link inside a role row (text "Edit", <a> tag) */
  editLink(name) {
    return this.roleRow(name).getByRole('link', { name: /edit/i });
  }

  /** Delete link inside a role row (text "Delete", <a> tag) */
  deleteLink(name) {
    return this.roleRow(name).getByRole('link', { name: /delete/i });
  }
}

export class UserListPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // SPA navigation — see CLAUDE-E2E.md
    // First navigate Home (link is always in NavBar), then click the Users link
    await this.page.evaluate(() => {
      const homeLink = document.querySelector('a[href="/"]');
      if (homeLink) homeLink.click();
    });
    await this.page.waitForSelector('a[href="/users"]', { timeout: 5_000 }).catch(() => null);
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/users"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/users');
    await this.page.getByRole('heading', { name: /system users/i }).waitFor();
  }

  addNewLink()    { return this.page.getByRole('link', { name: /add/i }).first(); }
  userRow(name)   { return this.page.getByRole('row').filter({ hasText: name }); }
  /** Name is a clickable <button> that navigates to the user editor */
  nameButton(name) { return this.userRow(name).getByRole('button', { name }).first(); }
}

export class UserEditorPage {
  constructor(page) {
    this.page = page;
  }

  async gotoNew() {
    // SPA navigation — see CLAUDE-E2E.md
    // No direct link to /users/new on home; try the Users list "Add" link first
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/users/new"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/users/new');
    await this.page.getByRole('heading', { name: 'Add New User' }).waitFor();
  }

  nameInput()     { return this.page.locator('input[name="name"]').first(); }
  emailInput()    { return this.page.locator('input[name="email"]').first(); }
  usernameInput() { return this.page.locator('input[name="username"]').first(); }
  passwordInput() { return this.page.locator('input[name="password"], input[type="password"]').first(); }
  saveButton()    { return this.page.getByRole('button', { name: /save/i }).first(); }
  deleteButton()  { return this.page.getByRole('button', { name: /delete/i }).first(); }
  successBanner() { return this.page.getByText(/saved/i).first(); }
}
