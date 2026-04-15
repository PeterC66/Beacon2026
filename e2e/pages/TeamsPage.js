// beacon2/e2e/pages/TeamsPage.js
// Page Object Models for Teams list and record.
// Beacon UG §5 — "Teams"

export class TeamListPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/teams"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/teams');
    await this.page.getByRole('heading', { name: 'Teams' }).waitFor({ timeout: 10_000 });
  }

  addNewButton() {
    return this.page.getByRole('link', { name: /add new team/i }).first();
  }

  teamLink(name) {
    return this.page.getByRole('link', { name }).first();
  }
}

export class TeamRecordPage {
  constructor(page) {
    this.page = page;
  }

  async gotoNew() {
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/teams/new"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) {
      const listClicked = await this.page.evaluate(() => {
        const link = document.querySelector('a[href="/teams"]');
        if (link) { link.click(); return true; }
        return false;
      });
      if (!listClicked) await this.page.goto('/teams');
      await this.page.getByRole('heading', { name: 'Teams' }).waitFor();
      await this.page.getByRole('link', { name: /add new team/i }).first().click();
    }
    await this.page.getByRole('heading', { name: /add new team/i }).waitFor({ timeout: 10_000 });
  }

  nameInput()     { return this.page.locator('input[name="name"]').first(); }
  saveButton()    { return this.page.getByRole('button', { name: /save|add team/i }).first(); }
  deleteButton()  { return this.page.getByRole('button', { name: /delete/i }).first(); }
}
