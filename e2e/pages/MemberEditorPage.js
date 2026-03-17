// beacon2/e2e/pages/MemberEditorPage.js
// Page Object Model for the member editor (/members/new, /members/:id).
// Beacon UG §4.2 — "The Member Record"
// Beacon UG §4.3 — "Add a New Member"

export class MemberEditorPage {
  constructor(page) {
    this.page = page;
  }

  async gotoNew() {
    await this.page.goto('/members/new');
    await this.page.getByRole('heading', { name: 'New Member' }).waitFor();
  }

  heading() {
    return this.page.getByRole('heading').first();
  }

  // ── Personal details ────────────────────────────────────────────────────

  titleSelect()     { return this.page.getByLabel('Title'); }
  forenamesInput()  { return this.page.locator('input[name="forenames"]'); }
  surnameInput()    { return this.page.locator('input[name="surname"]'); }
  knownAsInput()    { return this.page.locator('input[name="knownAs"]'); }
  emailInput()      { return this.page.locator('input[name="email"]'); }
  mobileInput()     { return this.page.locator('input[name="mobile"]'); }
  statusSelect()    { return this.page.getByLabel('Status'); }
  classSelect()     { return this.page.getByLabel('Class'); }

  // DateInput renders a plain text input with placeholder dd/mm/yyyy
  joinedOnInput()   { return this.page.getByPlaceholder('dd/mm/yyyy').first(); }

  // ── Address ─────────────────────────────────────────────────────────────

  houseNoInput()    { return this.page.locator('input[name="houseNo"]'); }
  streetInput()     { return this.page.locator('input[name="street"]'); }
  townInput()       { return this.page.locator('input[name="town"]'); }
  postcodeInput()   { return this.page.locator('input[name="postcode"]'); }

  // ── Buttons ─────────────────────────────────────────────────────────────

  saveButton()   { return this.page.getByRole('button', { name: /save/i }).first(); }
  deleteButton() { return this.page.getByRole('button', { name: /delete/i }).first(); }

  // ── Feedback ────────────────────────────────────────────────────────────

  errorBanner()   { return this.page.locator('.bg-red-50.border-red-300').first(); }
  successBanner() { return this.page.getByText('✓ Saved successfully.'); }

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
    if (joinedOn) await this.joinedOnInput().fill(joinedOn);
  }
}
