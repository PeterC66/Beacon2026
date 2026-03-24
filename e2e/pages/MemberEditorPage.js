// beacon2/e2e/pages/MemberEditorPage.js
// Page Object Model for the member editor (/members/new, /members/:id).
// Beacon UG §4.2 — "The Member Record"
// Beacon UG §4.3 — "Add a New Member"

export class MemberEditorPage {
  constructor(page) {
    this.page = page;
  }

  async gotoNew() {
    // Use page.evaluate() to fire a DOM click — this triggers React Router's
    // onClick handler regardless of CSS visibility.  The Home page renders both
    // a mobile layout (md:hidden) and a desktop grid; Playwright's locator.click()
    // would fail if it resolved the hidden mobile element first.
    // See CLAUDE-E2E.md § "The SPA-navigation pattern".
    const url = this.page.url();
    console.log(`[MemberEditorPage.gotoNew] Current URL before navigation: ${url}`);

    const clicked = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/members/new"]');
      console.log('[gotoNew] link found in DOM:', !!link, link?.offsetParent, link?.getBoundingClientRect());
      if (link) { link.click(); return true; }
      return false;
    });
    console.log(`[MemberEditorPage.gotoNew] SPA link clicked: ${clicked}`);

    if (!clicked) {
      console.log('[MemberEditorPage.gotoNew] Falling back to page.goto("/members/new")');
      await this.page.goto('/members/new');
    }

    console.log(`[MemberEditorPage.gotoNew] Waiting for "Add New Member" heading...`);
    await this.page.getByRole('heading', { name: 'Add New Member' }).waitFor({ timeout: 15_000 });
    console.log(`[MemberEditorPage.gotoNew] Heading found. URL: ${this.page.url()}`);
  }

  heading() {
    return this.page.getByRole('heading').first();
  }

  // ── Personal details ────────────────────────────────────────────────────

  titleSelect()     { return this.page.locator('select[name="title"]'); }
  forenamesInput()  { return this.page.locator('input[name="forenames"]'); }
  surnameInput()    { return this.page.locator('input[name="surname"]'); }
  knownAsInput()    { return this.page.locator('input[name="knownAs"]'); }
  emailInput()      { return this.page.locator('input[name="email"]'); }
  mobileInput()     { return this.page.locator('input[name="mobile"]'); }
  statusSelect()    { return this.page.locator('select[name="statusId"]'); }
  classSelect()     { return this.page.locator('select[name="classId"]'); }

  // DateInput renders a plain text input with placeholder dd/mm/yyyy
  joinedOnInput()     { return this.page.getByPlaceholder('dd/mm/yyyy').first(); }
  nextRenewalInput()  { return this.page.getByPlaceholder('dd/mm/yyyy').nth(1); }

  // ── Address ─────────────────────────────────────────────────────────────

  houseNoInput()    { return this.page.locator('input[name="houseNo"]'); }
  streetInput()     { return this.page.locator('input[name="street"]'); }
  townInput()       { return this.page.locator('input[name="town"]'); }
  postcodeInput()   { return this.page.locator('input[name="postcode"]'); }

  // ── Buttons ─────────────────────────────────────────────────────────────

  // Button text is "Add Member" for new, "Save" for existing, "Saving…" while in-flight
  saveButton()   { return this.page.getByRole('button', { name: /save|add member/i }).first(); }
  deleteButton() { return this.page.getByRole('button', { name: /delete/i }).first(); }

  // ── Feedback ────────────────────────────────────────────────────────────

  errorBanner()   { return this.page.locator('.bg-red-50.border-red-300').first(); }
  successBanner() { return this.page.getByText('✓ Member record saved.'); }

  fieldError(name) {
    // Field errors appear after the relevant input
    return this.page.locator(`[name="${name}"] ~ *`).filter({ hasText: /required|invalid|valid/i }).first();
  }

  /** Wait for class select options to load from the API. */
  async waitForClassOptions() {
    await this.page.waitForFunction(
      (sel) => {
        const select = document.querySelector(sel);
        return select && select.options.length > 1;
      },
      'select[name="classId"]',
      { timeout: 10_000 },
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Fill in the minimum required fields to create a member.
   * statusName / className must already exist in the test tenant.
   *
   * NOTE: On the "new member" form the status select is hidden — the
   * component auto-sets status to "Current" via useEffect. We only
   * interact with the status select when it exists (editing an
   * existing member).
   */
  async fillMinimal({ forenames, surname, statusName, className, postcode, joinedOn }) {
    await this.forenamesInput().fill(forenames);
    await this.surnameInput().fill(surname);

    // Status select only exists on the edit form, not on "Add New Member".
    // The new-member form auto-sets status to "Current" in a useEffect.
    const statusCount = await this.statusSelect().count();
    if (statusCount > 0) {
      await this.statusSelect().selectOption({ label: statusName });
    }

    // Class options load async from the API — wait before selecting.
    await this.waitForClassOptions();
    await this.classSelect().selectOption({ label: className });

    await this.postcodeInput().fill(postcode);
    if (joinedOn) {
      await this.joinedOnInput().fill(joinedOn);
      // Wait for the auto-computed "Next renewal" date to be populated.
      // The frontend fetches year-config from the API and computes the
      // renewal date in a useEffect — this can lag behind the fill,
      // especially in CI where the API may be slow.
      await this.nextRenewalInput().waitFor({ state: 'visible' });
      await this.page.waitForFunction(
        (sel) => { const el = document.querySelectorAll(sel)[1]; return el && el.value.length > 0; },
        'input[placeholder="dd/mm/yyyy"]',
        { timeout: 10_000 },
      );
    }
  }
}
