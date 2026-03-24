// beacon2/e2e/pages/GroupsPage.js
// Page Object Models for Groups list and record.
// Beacon UG §5 — "Groups"

export class GroupListPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // SPA navigation — see CLAUDE-E2E.md
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/groups"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/groups');
    await this.page.getByRole('heading', { name: 'Groups' }).waitFor();
  }

  addNewButton() {
    return this.page.getByRole('link', { name: 'Add new group' }).first();
  }

  groupLink(name) {
    return this.page.getByRole('link', { name }).first();
  }

  async rowCount() {
    // Rows in the groups table (excluding header)
    return this.page.getByRole('row').count().then((n) => Math.max(0, n - 1));
  }
}

export class GroupRecordPage {
  constructor(page) {
    this.page = page;
  }

  async gotoNew() {
    // Navigate to /groups first (SPA), then click "Add New Group"
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/groups/new"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) {
      // No /groups/new link on current page — go to groups list first
      const listClicked = await this.page.evaluate(() => {
        const link = document.querySelector('a[href="/groups"]');
        if (link) { link.click(); return true; }
        return false;
      });
      if (!listClicked) await this.page.goto('/groups');
      await this.page.getByRole('heading', { name: 'Groups' }).waitFor();
      // Now click "Add New Group" from the list page NavBar
      await this.page.getByRole('link', { name: /add new group/i }).first().click();
    }
    await this.page.getByRole('heading', { name: /add new group/i }).waitFor();
  }

  nameInput()        { return this.page.locator('input[name="name"]').first(); }
  descriptionInput() { return this.page.locator('textarea[name="description"], input[name="description"]').first(); }
  saveButton()       { return this.page.getByRole('button', { name: /save|add group/i }).first(); }
  deleteButton()     { return this.page.getByRole('button', { name: /delete/i }).first(); }
  successBanner()    { return this.page.getByText('✓ Saved successfully.'); }

  tab(name) {
    return this.page.getByRole('tab', { name }).first();
  }

  async clickTab(name) {
    await this.tab(name).click();
  }

  // Members tab
  addMemberSelect()  { return this.page.getByRole('combobox').first(); }
  addMemberButton()  { return this.page.getByRole('button', { name: /add/i }).first(); }

  memberRow(name) {
    return this.page.getByRole('row').filter({ hasText: name });
  }

  // Schedule tab
  addEventButton() {
    return this.page.getByRole('button', { name: /add event/i }).first();
  }

  eventDateInput() {
    return this.page.getByPlaceholder('dd/mm/yyyy').first();
  }
}
