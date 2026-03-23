# Beacon2 — E2E Test Reference

End-to-end tests live in `e2e/` and run via Playwright against a live
staging deployment on Render.

---

## Architecture overview

| Path | Purpose |
|------|---------|
| `e2e/global-setup.js` | Creates (or resets) a test tenant before any tests run |
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

## Debugging E2E failures

- **Render logs** — check the backend's application log for auth errors.
  Common patterns:
  - `POST /auth/login: Invalid credentials` at line 24 → tenant not found
  - `POST /auth/login: Invalid credentials` at line 48 → wrong password or
    user inactive
  - `POST /auth/refresh: Invalid refresh token` → token revoked or not found
  - Prisma `P2010` / code `23505` on `token_hash` → duplicate refresh token
    (race condition)

- **Playwright report** — downloaded from the CI artifact. Contains
  screenshots, traces, and videos for failed tests.

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

### DDL idempotency

`ALTER TABLE ... ADD CONSTRAINT` fails with code `42710` if the constraint
already exists (PostgreSQL < 17 doesn't support `IF NOT EXISTS` for
constraints). Wrap in a `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL;
END $$` block for idempotency.
