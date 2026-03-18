// beacon2/e2e/pages/LoginPage.js
// Page Object Model for the tenant login page (/login).
// Beacon UG §2 — "Logging in as a System User"

export class LoginPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(tenantSlug, username, password) {
    await this.goto();
    await this.page.getByLabel('u3a').fill(tenantSlug);
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Enter' }).click();
  }

  async loginAndWait(tenantSlug, username, password) {
    await this.login(tenantSlug, username, password);
    await this.page.waitForURL('/', { timeout: 10_000 });
  }

  errorMessage() {
    return this.page.locator('.bg-red-50.border-red-300');
  }

  heading() {
    return this.page.getByRole('heading', { name: 'Administration' });
  }
}
