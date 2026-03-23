// beacon2/e2e/pages/MemberListPage.js
// Page Object Model for the member list (/members).
// Beacon UG §4.1 — "The Membership List"

export class MemberListPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // Prefer SPA link-click navigation to preserve the in-memory auth token.
    // page.goto() causes a full page reload which loses auth state; session
    // restoration via the refresh cookie is unreliable in CI.
    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/members"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await this.page.goto('/members');
    await this.page.getByRole('heading', { name: 'Members' }).waitFor();
  }

  heading() {
    return this.page.getByRole('heading', { name: 'Members' });
  }

  searchInput() {
    return this.page.getByPlaceholder('Name, address, postcode, no…');
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
