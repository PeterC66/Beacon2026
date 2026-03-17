// beacon2/e2e/pages/HomePage.js
// Page Object Model for the home / administration menu page (/).
// Beacon UG §3 — "The Beacon Home Page"

export class HomePage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/');
  }

  heading() {
    return this.page.getByRole('heading', { name: 'Administration' });
  }

  logoutButton() {
    return this.page.getByRole('button', { name: 'Log Out' });
  }

  async logout() {
    await this.logoutButton().click();
    await this.page.waitForURL('/login');
  }

  navLink(label) {
    return this.page.getByRole('link', { name: label }).first();
  }

  async clickNav(label) {
    await this.navLink(label).click();
  }

  /** Returns true when the given menu item is rendered as a clickable link. */
  async isEnabled(label) {
    const link = this.page.getByRole('link', { name: label }).first();
    return link.isVisible();
  }
}
