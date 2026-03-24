// beacon2/e2e/pages/MemberEditorPage.js
// Page Object Model for the member editor (/members/new, /members/:id).
// Beacon UG §4.2 — "The Member Record"
// Beacon UG §4.3 — "Add a New Member"

export class MemberEditorPage {
  constructor(page) {
    this.page = page;
  }

  async gotoNew() {
    // Prefer SPA link-click navigation to preserve the in-memory auth token.
    // page.goto() causes a full page reload which loses auth state.
    const currentUrl = this.page.url();
    console.log(`[MemberEditorPage.gotoNew] Current URL before navigation: ${currentUrl}`);

    const debugInfo = await this.page.evaluate(() => {
      const link = document.querySelector('a[href="/members/new"]');
      const allLinks = [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).slice(0, 20);
      return { found: !!link, allLinks, bodyLength: document.body.innerHTML.length };
    });
    console.log(`[MemberEditorPage.gotoNew] Link found: ${debugInfo.found}, body length: ${debugInfo.bodyLength}`);
    console.log(`[MemberEditorPage.gotoNew] First 20 links on page: ${JSON.stringify(debugInfo.allLinks)}`);

    if (debugInfo.found) {
      await this.page.evaluate(() => {
        document.querySelector('a[href="/members/new"]').click();
      });
      console.log(`[MemberEditorPage.gotoNew] SPA click succeeded`);
    } else {
      console.log(`[MemberEditorPage.gotoNew] Link NOT found — falling back to page.goto (full reload)`);
      await this.page.goto('/members/new');
    }

    const urlAfterNav = this.page.url();
    console.log(`[MemberEditorPage.gotoNew] URL after navigation: ${urlAfterNav}`);

    await this.page.getByRole('heading', { name: 'Add New Member' }).waitFor({ timeout: 10_000 })
      .catch(async (err) => {
        const finalUrl = this.page.url();
        const pageTitle = await this.page.title();
        const bodyText = await this.page.locator('body').innerText().catch(() => '(could not read body)');
        console.log(`[MemberEditorPage.gotoNew] HEADING NOT FOUND. URL: ${finalUrl}, title: ${pageTitle}`);
        console.log(`[MemberEditorPage.gotoNew] Body text (first 500 chars): ${bodyText.slice(0, 500)}`);
        throw err;
      });
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

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Fill in the minimum required fields to create a member.
   * statusName / className must already exist in the test tenant.
   */
  async fillMinimal({ forenames, surname, statusName, className, postcode, joinedOn }) {
    await this.forenamesInput().fill(forenames);
    await this.surnameInput().fill(surname);
    await this.statusSelect().selectOption({ label: statusName });
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
