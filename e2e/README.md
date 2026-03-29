# Beacon2 — End-to-End User Tests

Playwright-based user acceptance tests for the Beacon2 administration system.

Tests are organised to mirror the **Beacon User Guide** sections, so that each
test can be traced back to documented user behaviour.

---

## Prerequisites

- Node.js 18+
- A running Beacon2 **staging** instance (frontend + backend + database)
- A system-admin account on that instance (to create the test tenant)

---

## Quick start

```bash
cd e2e
npm install
npx playwright install chromium   # download the test browser

# Copy the environment template and fill in your staging values
cp .env.example .env
$EDITOR .env

# Run all tests
npm test

# Run headed (watch the browser)
npm run test:headed

# Open the interactive Playwright UI
npm run test:ui

# Show the HTML report after a run
npm run test:report
```

---

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BEACON2_BASE_URL` | Frontend URL | `http://localhost:5173` |
| `BEACON2_API_URL` | Backend API URL (for setup calls) | `http://localhost:3001` |
| `BEACON2_SYSADMIN_USERNAME` | System-admin username | `sysadmin` |
| `BEACON2_SYSADMIN_PASSWORD` | System-admin password | `changeme` |
| `BEACON2_TEST_TENANT_SLUG` | Slug for the dedicated test tenant | `e2etest` |
| `BEACON2_TEST_TENANT_NAME` | Display name for the test tenant | `E2E Test u3a` |
| `BEACON2_TEST_ADMIN_USERNAME` | Admin username inside the test tenant | `testadmin` |
| `BEACON2_TEST_ADMIN_PASSWORD` | Admin password | `TestAdmin99!` |
| `BEACON2_TEST_ADMIN_NAME` | Admin full name | `Test Administrator` |
| `BEACON2_TEST_ADMIN_EMAIL` | Admin email (placeholder OK) | `testadmin@beacon2-e2e.invalid` |

---

## How it works

### Global setup (`global-setup.js`)

Runs **once** before any test file.

1. Logs in as system admin.
2. Creates the test tenant (`BEACON2_TEST_TENANT_SLUG`) if it does not already exist.
   If it does exist, resets the admin password to the known value (so tests always
   start from a known state even after a previous failed run).
3. Logs in as the test-tenant admin.
4. Seeds a **"Current Account"** finance account and a **"Joint"** member class
   (the four default member statuses and "Individual" class are created automatically
   by the Beacon2 tenant-creation process).

### Auth fixture (`fixtures/admin.js`)

Each test that needs a logged-in browser imports `{ test, expect }` from
`fixtures/admin.js` instead of `@playwright/test`.  The `adminPage` fixture
performs a fresh browser login before each test and provides the authenticated
page.

Because Beacon2 stores the access token **in memory only** (never cookies or
localStorage), there is no way to share a session via Playwright's `storageState`.
A fresh login per test adds ~200 ms and keeps tests fully independent.

### Test data isolation

Every test creates its own data (with a `Date.now()` suffix to avoid collisions)
and cleans it up in the same test or the last test in a `describe` block.  Tests
within a file run **serially** (Playwright `fullyParallel: false`) so the
create → edit → delete sequence within a describe block is reliable.

### Global teardown (`global-teardown.js`)

Enabled by default.  The test tenant is **always** deleted after the run,
regardless of whether tests passed or failed.  This prevents leftover tenants
from accumulating in the database.

---

## Test file index

| File | Beacon UG section | Coverage |
|------|--------------------|----------|
| `01-auth.spec.js` | §2 Login | Login, wrong password, logout |
| `02-members.spec.js` | §4 Membership | List, add, edit, search, validate, delete |
| `03-membership-setup.spec.js` | §8.7 Membership set-up | Classes and statuses CRUD |
| `04-groups.spec.js` | §5 Groups | List, add, edit, tabs (Schedule, Members, Ledger), delete |
| `05-venues-faculties.spec.js` | §5.7–5.8 | Venues and Faculties CRUD |
| `06-finance.spec.js` | §7, §8.6 | Accounts, categories, transactions, ledger views |
| `07-roles-users.spec.js` | §8.1, §8.4 | Roles/privileges, system users CRUD |
| `08-settings.spec.js` | §8.3, §9.1 | System settings, personal preferences |
| `09-officers.spec.js` | §9.3 | u3a Officers CRUD |
| `10-audit-log.spec.js` | §9.2 | Audit log page and filters |
| `11-backup.spec.js` | §9.5 | Export downloads, member data validator |

---

## Page Object Models

| File | Pages covered |
|------|--------------|
| `pages/LoginPage.js` | `/login` |
| `pages/HomePage.js` | `/` (home menu) |
| `pages/MemberListPage.js` | `/members` |
| `pages/MemberEditorPage.js` | `/members/new`, `/members/:id` |
| `pages/GroupsPage.js` | `/groups`, `/groups/:id` |
| `pages/FinancePage.js` | `/finance/accounts`, `/finance/categories`, `/finance/transactions/*`, `/finance/ledger` |
| `pages/SettingsPage.js` | `/settings`, `/roles`, `/users`, `/users/:id` |

---

## Adding new tests

1. Create a new spec file in `tests/` (use the next number in the sequence).
2. Import `{ test, expect }` from `../fixtures/admin.js`.
3. Use the `adminPage` fixture to get a logged-in page.
4. Use an existing Page Object Model or add methods to the relevant POM file.
5. Reference the Beacon UG section in the file header comment.

### Adding a new Page Object Model

Create a new file in `pages/` following the pattern of the existing POMs:
- Constructor takes `page` (the Playwright page object).
- Methods return locators (not resolved values) so tests can use `expect(locator).toBeVisible()`.
- Navigation methods (`goto()`, `gotoNew()`) include a `waitFor()` on the heading.

---

## Regression testing strategy

The tests are structured for **regression after deployment**:

1. **Global setup** ensures a clean, known baseline every run.
2. **Tests are self-contained** — no shared mutable state between test files.
3. **Numbered ordering** matches the Beacon UG so gaps are obvious when new
   features are added.
4. **Acceptance criteria** map directly to user-guide behaviour, not
   implementation details — so tests remain valid as the frontend evolves.

When a new Beacon2 feature is implemented:
- Add a new spec file (or extend an existing one) that covers the corresponding
  UG section.
- If global-setup needs new seed data for those tests, add it to `global-setup.js`.

---

## Troubleshooting

**`global-setup` fails with "System-admin login failed"**
→ Check `BEACON2_API_URL`, `BEACON2_SYSADMIN_USERNAME`, `BEACON2_SYSADMIN_PASSWORD`.

**`global-setup` fails with "Tenant admin login failed"**
→ The tenant may have been left in a bad state from a previous run where teardown
didn't complete (e.g. process killed).  Manually delete the tenant via the system
admin UI, then re-run.

**Tests fail with "waitForURL timed out"**
→ The staging server may be slow.  Increase `navigationTimeout` in
`playwright.config.js`.

**Download tests time out**
→ The export endpoint may be generating a large file.  Increase the timeout
passed to `page.waitForEvent('download', { timeout: … })`.

**Selector not found**
→ The UI may have changed.  Check the relevant Page Object Model and update the
locator.  Prefer `getByRole` / `getByLabel` / `getByText` over CSS selectors for
resilience.
