# Beacon2 — E2E Test Reference

End-to-end tests live in `e2e/` and run via Playwright against a live
staging deployment on Render.

---

## Architecture overview

| Path | Purpose |
|------|---------|
| `e2e/global-setup.js` | Creates (or resets) a test tenant before any tests run |
| `e2e/global-teardown.js` | Always deletes the test tenant after the run |
| `e2e/success-reporter.js` | Writes `.e2e-passed` marker file (housekeeping) |
| `e2e/fixtures/admin.js` | `adminPage` fixture — logs in as the test-tenant admin |
| `e2e/pages/*.js` | Page Object Models (one per frontend page/group) |
| `e2e/tests/*.spec.js` | Test specs — numbered to control execution order |
| `e2e/.e2e-state.json` | Written by global-setup; holds the generated tenant slug |
| `e2e/.e2e-storage.json` | Written by global-setup; Playwright storageState for cookies |

---

## How to run

```bash
cd e2e && npm test          # local (needs frontend + backend running)
```

In CI the workflow (`.github/workflows/e2e.yml`) runs against the Render
staging deployment. Backend/frontend URLs and credentials come from
GitHub Secrets.

---

## Critical constraint: in-memory auth token

The access token is stored **in React memory only** — not in localStorage,
sessionStorage, or any cookie the browser can read directly.

**Consequence:** calling `page.goto()` from a page object causes a full page
reload, which destroys the in-memory token. The app then tries to restore the
session via the httpOnly `beacon2_refresh` cookie, but this is unreliable in CI
because:

- The frontend and backend are on different origins (cross-origin cookie
  handling depends on `SameSite=None; Secure`, browser version, etc.)
- Concurrent or duplicated refresh requests can trigger token-rotation race
  conditions (Prisma unique constraint violation on `token_hash`)
- React 18 StrictMode can double-invoke the restore effect in dev builds

### The SPA-navigation pattern

**All page-object `goto()` / `gotoNew()` methods must avoid `page.goto()`.**

Instead, click the matching `<a href="...">` link already in the DOM. This
triggers React Router's client-side navigation and preserves the auth token.

```javascript
async goto() {
  const clicked = await this.page.evaluate(() => {
    const link = document.querySelector('a[href="/members"]');
    if (link) { link.click(); return true; }
    return false;
  });
  if (!clicked) await this.page.goto('/members');   // fallback
  await this.page.getByRole('heading', { name: 'Members' }).waitFor();
}
```

**Why `evaluate` instead of `locator.click()`?** The Home page has both a
mobile layout (`md:hidden`) and a desktop grid. `page.evaluate()` fires the
DOM click directly, which triggers React Router's `onClick` handler regardless
of CSS visibility. Using Playwright's `.click()` would fail if it resolved the
hidden mobile element first.

**When the fallback fires:** If the page object is used from a context where
no matching `<a>` exists (unlikely — the `adminPage` fixture always starts
from `/`), the fallback to `page.goto()` kicks in. Session restoration may
or may not succeed; this is acceptable as a last resort.

---

## Locator patterns

**Prefer `name` attribute selectors over `getByLabel` for selects.**
Many MemberEditor fields use a plain `<label>` sibling + `<select>` without
`htmlFor`/`id` pairing. Playwright's `getByLabel('Status')` requires a proper
label–input association — it won't match unconnected sibling labels. Use
`page.locator('select[name="statusId"]')` instead.

For text `<input>` elements that already have `name` attributes (added to
all forms), `input[name="..."]` is the most reliable locator.

---

## Cookie-consent setup

The `beacon2_cookie_consent` cookie must be pre-set to `'accepted'` in the
Playwright storageState. Without it:

- `setLastU3aCookie()` in Login.jsx is a no-op (cookie consent not given)
- Session restoration after any full page reload silently fails (no slug cookie)
- The cookie-consent modal may overlay the page and block form interaction

Global-setup writes `.e2e-storage.json` with this cookie; Playwright's config
applies it to every browser context via `use.storageState`.

---

## The `adminPage` fixture

Defined in `e2e/fixtures/admin.js`. Every spec file except `01-auth.spec.js`
imports `{ test, expect }` from this fixture instead of `@playwright/test`.

The fixture:
1. Navigates to `/login`
2. Fills tenant slug, username, password
3. Clicks Enter and waits for `waitForURL('/')`
4. Hands the logged-in `page` to the test

After the fixture, the page is always at `/` (the Administration home page)
with a valid in-memory access token. All page-object `goto()` calls should
navigate from this starting point using SPA links.

---

## Global-setup flow

1. Wait for frontend and backend services (handles Render cold starts)
2. Log in as system admin
3. Create the test tenant (or reset admin password if it already exists)
4. Log in as the test-tenant admin
5. Seed a finance account and a second member class
6. Write `.e2e-state.json` (slug) and `.e2e-storage.json` (cookie consent)

The tenant slug is generated per run (`e2e_<hex>`) to avoid collisions.

### Test data naming — use fixed suffixes, not `process.pid` or `Date.now()`

Test data names (member surnames, role names, account names) must use **fixed
string suffixes** (e.g. `'E2ETestMbr'`), not `process.pid` or `Date.now()`.
Playwright restarts workers on retry, which changes both the PID and the
timestamp.  Tests that depend on data created by earlier tests (e.g. "search
for the member created in the Add test") would look for a member under the
new PID/timestamp that doesn't exist.

Since each CI run creates its own tenant, fixed names cannot collide across runs.

### Prefer auto-waiting assertions over snapshot checks

Playwright's `locator.count()` is a snapshot — it checks the DOM once and
returns immediately.  If the React component hasn't finished rendering, `count()`
returns 0.  Instead, wait for at least one element first:

```js
// BAD — snapshot, may return 0 before React renders
const count = await page.getByPlaceholder('dd/mm/yyyy').count();
expect(count).toBeGreaterThanOrEqual(2);

// GOOD — auto-waits, then counts
const inputs = page.getByPlaceholder('dd/mm/yyyy');
await expect(inputs.first()).toBeVisible();
const count = await inputs.count();
expect(count).toBeGreaterThanOrEqual(2);
```

### Page-object `goto()` methods should wait for data

When a list page loads, the heading renders before the API data arrives.  The
page object's `goto()` should wait for the loading indicator to disappear so
that callers can immediately assert on list content:

```js
await this.page.getByRole('heading', { name: 'Groups' }).waitFor();
await this.page.getByText('Loading…').waitFor({ state: 'hidden', timeout: 15_000 });
```

---

## Member creation and the Applicant status

When a member is created **without payment details**, the backend automatically
switches their status from "Current" to "Applicant" and generates a payment
token (see `POST /members` in `backend/src/routes/members.js`).

This affects E2E tests because:
- The **member list** defaults to the "Current" status filter — Applicant members
  are hidden unless the "All" checkbox is ticked
- The **available-members dropdown** on the Add User form (`/users/available-members`)
  only returns members with status "Current"

**When writing tests that need a Current member**, include payment via
`editor.fillPayment({ amount: '1', accountName: 'Current Account' })` after
`fillMinimal()`. The global setup seeds a "Current Account" finance account.

**When testing the Applicant path**, omit payment and verify the status select
shows "Applicant" on the resulting edit page.

---

## Adding a new page object

1. Create `e2e/pages/FooPage.js`
2. Use the SPA-navigation pattern in `goto()` — never raw `page.goto()`
3. Verify the target `<a href="...">` exists on the Home page (check
   `frontend/src/pages/Home.jsx`)
4. For pages reachable only via sub-navigation (e.g. `/groups/new`), the
   `<a>` link may be on the parent list page — ensure your test navigates
   to the parent first, then clicks through

---

## Refresh-token rotation pitfalls

The backend rotates the refresh token on every `/auth/refresh` call (revoke
old, insert new). If two requests arrive with the same token:

1. First request succeeds: revokes old token, inserts new hash
2. Second request finds the token already revoked → calls
   `invalidateUserSessions()` → all tokens for the user are revoked
3. Subsequent restores fail for that user until a fresh login

This is by design (token-reuse detection), but means any accidental double
refresh call kills the entire session. The SPA-navigation pattern avoids
this by never triggering a full reload (and thus never triggering
`restoreSession`).

---

## Viewing test artifacts

Playwright captures screenshots, videos, and traces on test failure.

### After a CI run (GitHub Actions)

1. Go to the GitHub repo → **Actions** tab → click the E2E workflow run
2. Scroll to the bottom — the **Artifacts** section lists downloadable zips:
   - **playwright-report** — always uploaded (kept 14 days). This is the most
     useful artifact: a self-contained HTML report with pass/fail status,
     failure screenshots, embedded video playback, and an interactive trace
     viewer. After downloading and unzipping, open `index.html` in a browser.
   - **test-results** — uploaded only on failure (kept 7 days). Contains the
     raw screenshot PNGs, video WebM files, and trace ZIPs.

### After a local run

```bash
cd e2e && npm test               # run the tests
npm run test:report              # open the HTML report in a browser
```

Raw artifacts are in `e2e/test-results/`. To view a trace file directly:

```bash
npx playwright show-trace e2e/test-results/<test-folder>/trace.zip
```

### Configuration (in `playwright.config.js`)

| Setting | Value |
|---------|-------|
| `screenshot` | `only-on-failure` |
| `video` | `retain-on-failure` |
| `trace` | `retain-on-failure` |
| HTML report output | `e2e/playwright-report/` |
| Raw artifact output | `e2e/test-results/` |

---

## Debugging E2E failures

- **Render logs** — check the backend's application log for auth errors.
  Common patterns:
  - `POST /auth/login: Invalid credentials` at line 24 → tenant not found
  - `POST /auth/login: Invalid credentials` at line 48 → wrong password or
    user inactive
  - `POST /auth/refresh: Invalid refresh token` → token revoked or not found
  - Prisma `P2010` / code `23505` on `token_hash` → duplicate refresh token
    (race condition)

- **Playwright report** — see "Viewing test artifacts" above.

- **Fast failures vs timeouts** — a test that fails in ~3 s likely hit a
  locator / assertion error. A test that fails at ~18 s typically timed out
  waiting for a heading or element that never appeared (usually because auth
  failed and the page redirected to `/login`).

- **Auto-computed fields** — some form fields are auto-populated by async
  API calls (e.g. `nextRenewal` depends on a `yearConfig` fetch). After
  filling the triggering field (like `joinedOn`), always wait for the
  dependent field to be populated before clicking Save. Without this the
  frontend validation silently blocks submission and the `waitForURL` for
  the saved record times out.

---

## Common pitfalls

### Form inputs must have `name` attributes

Page object locators like `this.page.locator('input[name="forenames"]')` rely
on the HTML `name` attribute. React controlled inputs often omit `name` since
the form state is managed via `onChange` / `useState`. Always add explicit
`name` attributes to inputs that E2E tests target.

### Duplicate elements from responsive / repeated NavBars

Some list pages render `<NavBar>` at both the top and bottom of the page for
UX convenience. This means locators like `getByRole('link', { name: '…' })`
may match two elements, causing Playwright strict mode violations. Always use
`.first()` on such locators.

### POM locators must match all button-text variants

Submit buttons often have different text depending on context — e.g. "Add Member"
for new records vs "Save" for existing ones. POM locators must match **all**
variants. Use a regex: `/save|add member/i` rather than just `/save/i`.

Similarly, success/error banner text in POM helpers must match the **exact**
rendered text (e.g. `'✓ Member record saved.'`), not a generic approximation.

### `waitForURL` regexes must exclude `/new`

When waiting for a redirect from `/entity/new` to `/entity/:id` after form
submission, the naive regex `/\/entity\/[^/]+$/` matches `/entity/new`
immediately — so the test never waits for the actual redirect. Use a negative
lookahead to exclude the `new` segment:

```javascript
// BAD — matches /groups/new instantly
await page.waitForURL(/\/groups\/[^/]+$/);

// GOOD — skips /groups/new, waits for /groups/<id>
await page.waitForURL(/\/groups\/(?!new\b)[^/]+$/);
```

### Heading locators must avoid matching multiple headings

Many pages have both an `<h1>` and `<h2>` that contain similar words. A broad
regex like `/transaction/i` will match both `<h1>Add Transaction</h1>` and
`<h2>Associate transaction with</h2>`, causing a Playwright strict mode
violation. **Always use exact heading text** or scope to a specific level:

```javascript
// BAD — matches multiple headings
await page.getByRole('heading', { name: /transaction/i }).waitFor();

// GOOD — exact match
await page.getByRole('heading', { name: 'Add Transaction' }).waitFor();
```

### SPA navigation via `onClick` + `navigate()` — never use `waitForURL`

Some list pages use `<a href="#edit" onClick={(e) => { e.preventDefault(); navigate(...); }}>`.
Clicking these triggers React Router's `navigate()` (pushState), which changes the
URL but does **not** fire the "load" event that `page.waitForURL()` waits for by
default. The test will time out at 30 s.

Instead, wait for content that appears on the destination page:

```javascript
// BAD — times out because SPA navigation doesn't fire "load"
await roleList.editLink('Administration').click();
await page.waitForURL(/\/roles\/\d+/);

// GOOD — wait for content on the target page
await roleList.editLink('Administration').click();
await expect(page.getByRole('heading', { name: /privileges/i })).toBeVisible({ timeout: 10_000 });
```

### Verify actual element types before writing POM locators

Always check the actual component source to determine whether interactive
elements are `<a>` links, `<button>` buttons, or clickable `<td>` cells:

- **RoleList**: Edit/Delete are `<a>` tags (`getByRole('link')`)
- **UserList**: Name is a `<button>` (`getByRole('button')`), not a link
- **UserList**: Delete is a `<button>` in the list row, not on the editor page

### DDL idempotency

`ALTER TABLE ... ADD CONSTRAINT` fails with code `42710` if the constraint
already exists (PostgreSQL < 17 doesn't support `IF NOT EXISTS` for
constraints). Wrap in a `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL;
END $$` block for idempotency.

---

## Test coverage inventory

### Spec files (18)

| File | Area | Key tests |
|------|------|-----------|
| `01-auth.spec.js` | Login / logout | Valid login, wrong password, unknown tenant, version display, logout redirect |
| `02-members.spec.js` | Member CRUD | Create with/without payment (Current vs Applicant), edit, search, validation, delete |
| `03-membership-setup.spec.js` | Classes / statuses | List, add, edit, delete; locked-item guard |
| `04-groups.spec.js` | Group + Team CRUD + tabs | Create, edit, delete groups and teams; Schedule/Members/Ledger tabs; add event; Groups↔Teams switching links |
| `05-venues-faculties.spec.js` | Venues / faculties | Full CRUD for both |
| `06-finance.spec.js` | Accounts / categories / transactions / ledger | Add/delete account+category, add transaction, ledger views (account/category/group), delete guard |
| `07-roles-users.spec.js` | Roles / system users | CRUD for both; privilege matrix load; user link to member |
| `08-settings.spec.js` | System settings / prefs | Page loads, save+persist, personal preferences sections |
| `09-officers.spec.js` | u3a Officers | Add, list, delete |
| `10-audit-log.spec.js` | Audit log | Page loads, date filter, entries present |
| `11-backup.spec.js` | Export / validator | Export type labels, .xlsx download, member validator |
| `12-calendar.spec.js` | Calendar / Event Types | Page loads, filters (all/group/other), PDF button, Show Detail checkbox, event type dropdown, Open Meetings nav |
| `13-finance-extended.spec.js` | Transfers / reconcile / statements / batches | Transfer creation, reconcile page, statement pages, credit batch with own transaction |
| `14-membership-extended.spec.js` | Renewals / cards / addresses / recent / stats | Page loads and structure for all 6 membership sub-pages |
| `15-gift-aid.spec.js` | Gift Aid declaration + log | Year selector, action buttons, date filters |
| `16-email.spec.js` | Email compose / delivery / unblocker | Compose form (no send), delivery date filters, unblocker input |
| `17-setup-extended.spec.js` | Polls / messages / public links / custom fields / feature config / event types | Poll CRUD, message templates, link sections, field label inputs, feature toggle sections + Update button, event type CRUD |
| `18-letters-utilities.spec.js` | Letters / utilities | Letter editor + tokens, download button, utilities validate link |

### Page objects (7)

| File | Exposes |
|------|---------|
| `LoginPage.js` | `fillLogin()`, `submit()`, `getError()` |
| `HomePage.js` | `goto()`, link helpers |
| `MemberListPage.js` | `goto()`, `searchBySurname()`, `getRows()`, `clickMember()` |
| `MemberEditorPage.js` | `gotoNew()`, `fillMinimal()`, `fillPayment()`, `save()`, `delete()`, field locators |
| `GroupsPage.js` | `GroupListPage`, `GroupRecordPage` — CRUD + tabs + events + members |
| `FinancePage.js` | `FinanceAccountsPage`, `FinanceCategoriesPage`, `TransactionEditorPage`, `FinanceLedgerPage` |
| `SettingsPage.js` | `SystemSettingsPage`, `RoleListPage`, `UserListPage`, `UserEditorPage` |

### Deferred E2E coverage

The following areas are **not yet tested end-to-end**. See `KNOWN-ISSUES.md`
§ "E2E Test Coverage — Deferred Items" for details and context:

| Area | Why deferred |
|------|-------------|
| Email send action | SendGrid not live in test env |
| PDF/Excel download content | Only button presence tested; file content verification deferred |
| Membership renewals bulk action | Would change member statuses + create transactions mid-run |
| Portal full flow | Separate auth, email verification, complex multi-step |
| Online joining flow | PayPal stub, public unauthenticated context |
| Password recovery / force-change | Multi-step auth with state flags |
| Data restore | Destructively overwrites tenant data |
