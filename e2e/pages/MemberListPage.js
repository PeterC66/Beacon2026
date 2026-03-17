// beacon2/e2e/pages/MemberListPage.js
// Page Object Model for the member list (/members).
// Beacon UG §4.1 — "The Membership List"

export class MemberListPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/members');
    await this.page.getByRole('heading', { name: 'Members' }).waitFor();
  }

  heading() {
    return this.page.getByRole('heading', { name: 'Members' });
  }

  searchInput() {
    return this.page.getByPlaceholder('search…');
  }

  async search(term) {
    await this.searchInput().fill(term);
    await this.page.keyboard.press('Enter');
  }

  async clickAddNew() {
    await this.page.getByRole('link', { name: 'Add new member' }).click();
  }

  /** Returns the Edit link for the first row containing the given name. */
  editLinkForMember(name) {
    return this.page
      .getByRole('row')
      .filter({ hasText: name })
      .getByRole('link', { name: 'Edit' })
      .first();
  }

  /** Counts visible table rows (excludes header). */
  async memberRowCount() {
    return this.page.getByRole('row').count().then((n) => n - 1);
  }

  memberName(name) {
    return this.page.getByRole('cell', { name }).first();
  }
}
