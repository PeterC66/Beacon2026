# Beacon2 — Claude Code Instructions

## Session startup

At the start of every session, run:

```bash
git fetch origin main
git merge origin/main --no-edit
```

This ensures that any files uploaded directly to `main` (design docs, prompts,
reference material in `docs/`) are present in the working branch before starting work.

## Project task description

The full project brief is at `docs/FromBeacon/CLAUDE_CODE_PROMPT.md`. Read it at the
start of any session where you are unsure what to build next.

An up-to-date summary of **what has been built and what remains** is at
`docs/FromBeacon/Beacon2 Project Definition.md`. Read this at the start of every
session — it is maintained as a living document and is more accurate than the original
prompt.

## If a document is not in your branch

If the user refers to a document that you cannot find in your working branch, check the
`main` branch before concluding it does not exist. The user may have uploaded it directly
to `main` without it having been merged into your branch yet:

```bash
git fetch origin main
git merge origin/main --no-edit
```

Running this (as required by the Session startup rule above) will bring it in. If the
file still does not appear after the merge, then ask the user to provide it.

## Reference documentation

### User Guide — `docs/BeaconUG/`

Admin and user documentation for the original Beacon system lives in `docs/BeaconUG/`.
Each subfolder corresponds to one webpage from the Beacon User Guide: the page was
printed to PDF, then the PDF was transcribed into Markdown, with all images kept
alongside it in the same folder.

**Naming note:** The section 8 index document is called **"Set-Up Operations"**
(folder `8. System settings – u3a Beacon/`). Do not confuse it with the
**System Settings screen** (doc `8.3 System Settings – u3a Beacon/`), which is
the specific configuration page. "Set-Up Operations" is the broader section covering
system users, roles, settings, system messages, finance accounts, etc.

**Before using any folder in `docs/BeaconUG/`**, check whether it still contains PDF
files. If it does, warn the user that those pages have not yet been transcribed and ask
them to convert the PDFs to Markdown before you proceed — do not attempt to interpret
raw PDFs yourself.

If you need documentation for a Beacon feature that does not appear anywhere in
`docs/BeaconUG/`, ask the user to supply it rather than guessing or sourcing it
elsewhere.

### Legacy Beacon source — `docs/FromBeacon/`

`docs/FromBeacon/` contains selected files from the original Beacon codebase. Refer to
them when they shed light on existing behaviour or data structures you are replicating.
If you need a specific file from the old codebase that is not already present, ask the
user to add it rather than assuming its contents.

## Development branch

All work goes on a branch whose name starts with `claude/`. Never push directly to `main`.

## Never define component functions inside other components

Defining a React component function inside another component causes the inner component
to be treated as a **new type** on every render. React unmounts and remounts it, which
resets state and re-fires `autoFocus`. This manifests as focus jumping unexpectedly
when typing.

**Wrong** (causes remount on every keystroke):
```jsx
function ParentForm() {
  function InnerRow() {         // ← new function reference every render
    return <tr><td><input autoFocus /></td></tr>;
  }
  return <table><tbody><InnerRow /></tbody></table>;
}
```

**Correct** — use a plain render function (not called with JSX tags):
```jsx
function ParentForm() {
  function renderRow(key) {     // ← called as renderRow(key), not <RenderRow />
    return <tr key={key}><td><input autoFocus /></td></tr>;
  }
  return <table><tbody>{renderRow('main')}</tbody></table>;
}
```

Or extract to a top-level component (outside the parent function) and pass props.

## Privileges for new functionality

**Every new page or function must use a proper named privilege resource — never re-use `settings:view` as a general admin gate.**

### Rule

When building a new feature that users should be able to access:

1. Add the resource to `backend/src/seed/privilegeResources.js` with appropriate actions (`view`, `change`, `create`, `delete`, or custom).
2. Grant the privilege to the relevant default roles in `backend/src/seed/defaultRoles.js`. The **Administration** role always gets it. Consider whether **Membership Secretary**, **Treasurer**, or other roles should too.
3. Update `backend/src/__tests__/helpers.js` → `ALL_PRIVS` to include the new `resource:action` strings.
4. Use `requirePrivilege('resource', 'action')` on the backend route and `can('resource', 'action')` in the frontend guard.

The migration system (`migrate.js`) automatically re-seeds privilege resources and re-syncs default role privileges on every server startup, so existing tenants pick up changes without manual intervention.

### Current custom privilege resources (Beacon2-only, not in original Beacon)

| Resource | Actions | Granted to |
|----------|---------|------------|
| `member_data_validation` | `view`, `change` | Administration, Membership Secretary |

## Key conventions

- Always spell **u3a** in lowercase
- The system is called **Beacon2**; the original system is **Beacon**
- Use ES modules (`import`/`export`) throughout — never `require()`
- Frontend access token is stored **in memory only** — never localStorage or sessionStorage
- All tenant database queries must go through `tenantQuery()` or `withTenant()` in `backend/src/utils/db.js`
- Validate all request bodies with **Zod** before processing
- Never construct SQL with string concatenation — always use parameterised queries
- Always, before you start, ask any questions one by one, until you are 95% certain that you can carry out this task.

## Frontend styling — Tailwind CSS (Option B, adopted March 2026)

All frontend pages now use **Tailwind CSS v3** exclusively. No custom `.b-*` CSS classes remain.

### Infrastructure
- `frontend/tailwind.config.js` — content paths: `./index.html` and `./src/**/*.{js,jsx}`
- `frontend/postcss.config.cjs` — uses `.cjs` extension because `package.json` has `"type": "module"`
- `frontend/src/index.css` — only `@tailwind base/components/utilities` + the background-image rule

### Design decisions (confirmed with user)
- **Modernised look** — clean slate/blue palette, not preserving the old yellow/grey Beacon colours except where noted
- **Data tables on mobile** — horizontal scroll (`overflow-x-auto`) with `min-w-max` table; no card/stack layout
- **Home menu on mobile** — single-column stacked sections; desktop (`md:`) retains 5-column grid

### Shared components
- `frontend/src/components/PageHeader.jsx` — logo + tenant display name (`text-xl sm:text-4xl`); import this instead of duplicating the header in every page
- `frontend/src/components/NavBar.jsx` — glass-effect backdrop, blue links, `–` separator

### Privilege matrix (RoleEditor) — keep Beacon colours
The privilege table in `RoleEditor.jsx` deliberately retains Beacon documentation colours using inline styles:
- Row backgrounds: `#ffffcc` (even) / `#f0f0f0` (odd)
- Resource name text: `color: #0000cc; font-style: italic`
- Save Privileges button: `bg-[#e08000]`
Do **not** replace these with generic Tailwind classes — they match the Beacon spec.

### Common patterns
- Inputs: `border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`
- Primary button: `bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors`
- Destructive button: `border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm`
- Alternating table rows: `i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'` with `bg-slate-50` header
- Content cards: `bg-white/90 rounded-lg shadow-sm p-4 sm:p-6`
- Form labels: stacked above inputs on all screen sizes (`block text-sm font-medium text-slate-700 mb-1`)
- Responsive grids: always `grid-cols-1 sm:grid-cols-2`, never bare `grid-cols-2`

### SystemLogin / SystemDashboard
These already used Tailwind before the Option B migration. They use `bg-slate-100` for the whole page (no lighthouse background) — this is intentional for the system-admin area.

## Session wrap-up

**This step is mandatory and must be in your TodoWrite list from the start of every session.**

Add a todo item — "Update CLAUDE.md if anything new was learned" — at session start
alongside your other planned tasks. Mark it complete only after explicitly checking
whether anything in the session warrants documentation.

At the end of every session:
1. Review what was built or fixed.
2. If anything new, non-obvious, or previously problematic was encountered, add it
   to this file under a dated heading.
3. Commit and push the updated CLAUDE.md along with (or just after) the code changes.
4. **Tell the user** "I have updated CLAUDE.md with: [brief description]" (or "No
   CLAUDE.md update needed this session" if nothing warranted it). This makes the
   step visible and auditable.

This keeps future sessions from repeating the same mistakes.

---

## Tenant schema migrations

### Background

`backend/prisma/tenant_schema.sql` is executed once when a tenant is first created
(`src/seed/createTenant.js`). Tables added to that file after a tenant already exists
will be **missing** from that tenant, causing 500 errors on any endpoint that queries
those tables.

### The fix (in place since March 2026)

`src/utils/migrate.js` → `migrateTenantSchemas()` re-runs the full
`tenant_schema.sql` against every active tenant on every server startup.

**Rules to keep this working:**

1. Every `CREATE TABLE`, `CREATE SEQUENCE`, and `CREATE INDEX` in
   `tenant_schema.sql` must use **`IF NOT EXISTS`**.
2. `CREATE INDEX` statements must have **explicit names** (required for
   `IF NOT EXISTS` to work):
   `CREATE INDEX IF NOT EXISTS :schema_idx_<table>_<col> ON :schema.<table> (<col>);`
3. Seed `INSERT` statements use **`ON CONFLICT DO NOTHING`** (or
   `WHERE NOT EXISTS` when the target column has no UNIQUE constraint).
4. The DDL loop in `migrateTenantSchemas()` has **per-statement** try/catch so
   one failing statement never prevents the rest from running.
5. **No semicolons in SQL comments** — the migration splits `tenant_schema.sql`
   on `;`, so a semicolon inside a `--` comment silently breaks the following
   statement (Postgres error 42601 `syntax error at or near …`).

### Diagnosing "unexpected error" on a page

When a page shows "An unexpected error occurred." the backend logged the real error.
Check Render (or server) logs for the line:
`[timestamp] METHOD /path: Error: ...`

Common causes:
- `relation "u3a_xxx.some_table" does not exist` — table missing from that tenant's
  schema; check `git log -- backend/prisma/tenant_schema.sql` to see when it was added
  relative to when the tenant was created
- `function nextval(...)` error — `membership_number_seq` sequence missing
- FK violation — status_id/class_id not found in the referenced table

---

## Prisma `$queryRawUnsafe` and PostgreSQL type casting

### The problem

`tenantQuery()` uses `prisma.$transaction` → `tx.$queryRawUnsafe(sql, ...params)`.
Prisma sends JavaScript string parameters **without explicit PostgreSQL type OIDs**.
In PostgreSQL's extended query protocol this means the implicit `text → date` (and
`text → time`, `text → numeric`, etc.) casts may not fire, causing a 500 error like:

```
ERROR: column "joined_on" is of type date but expression is of type text
```

This manifests as: operation succeeds when the field is `null` but fails when a
non-null value (e.g. a date string) is supplied — because `null` has no type conflict.

### The fix

Add an explicit PostgreSQL cast in the SQL wherever a non-text column type is involved:

```sql
-- DATE columns
VALUES (..., $12::date, $13::date, $14::date, ...)

-- TIME columns
start_time = $3::time

-- NUMERIC columns
fee = $4::numeric
```

`null::date` is valid in PostgreSQL (returns NULL), so explicit casts are safe even
when the parameter value is null.

### Affected columns to watch for

Any column whose PostgreSQL type is **not** `TEXT` / `VARCHAR` / `BOOLEAN` / `INTEGER`
needs an explicit cast when set via `$queryRawUnsafe`. Key examples in this codebase:

| Column | Type | Cast needed |
|--------|------|-------------|
| `joined_on`, `next_renewal`, `gift_aid_from` | `DATE` | `::date` |
| `start_time`, `end_time` | `TIME` | `::time` |
| `fee`, `gift_aid_fee` | `NUMERIC` | `::numeric` |

---

## Testing harness (set up March 2026)

### How to run tests

```bash
# Backend (from /backend)
npm test           # runs vitest --run (exits after one pass)

# Frontend (from /frontend)
npm test           # runs vitest --run (exits after one pass)
```

CI runs automatically on every push to `claude/**` branches via `.github/workflows/ci.yml`.

### Backend tests — architecture

- **Framework**: vitest + supertest
- **Config**: `backend/vitest.config.js` — sets JWT secrets in `env` block so `jwt.js` loads without throwing
- **No real database**: the DB layer (`../utils/db.js`) is mocked with `vi.mock()` in every test file
- **Auth bypass**: `../utils/redis.js` is mocked so `isSessionInvalidated` always returns false
- **Token helper**: `backend/src/__tests__/helpers.js` exports `makeAuthHeader()` and `makeSysAdminHeader()` — use these instead of hard-coding tokens
- **Test files**: `backend/src/__tests__/{health,auth,users,roles}.test.js`
- **app.js vs server.js**: `app.js` exports the pure Express app (safe to import in tests); `server.js` handles `migrateAndSeed()` + `app.listen()` — never import `server.js` in tests

### Backend testing patterns

When adding tests for a new endpoint:
1. Add `vi.mock('../utils/db.js', ...)` and `vi.mock('../utils/redis.js', ...)`
2. Use `tenantQuery.mockResolvedValueOnce([...])` to simulate DB responses
3. Use `makeAuthHeader()` for the `Authorization` header
4. Use `makeAuthHeader({ privileges: [] })` to test 403 responses

### Frontend tests — architecture

- **Framework**: vitest + React Testing Library + jsdom
- **Config**: `vite.config.js` `test` block — environment `jsdom`, setupFiles loads `@testing-library/jest-dom`
- **All API calls mocked**: `vi.mock('../lib/api.js', ...)` with resolved empty arrays
- **Auth context mocked**: `vi.mock('../context/AuthContext.jsx', ...)` injects a test user with `can` always returning true
- **Router mocked**: `useParams` and `useNavigate` are overridden via `vi.mock('react-router-dom', ...)`; pages are wrapped in `<MemoryRouter>`
- **Test files**: `frontend/src/__tests__/*.test.jsx` — one per page

### Frontend testing patterns

When adding a new page, add a smoke test that:
1. Mocks `AuthContext` with the minimum fields the page needs
2. Mocks any API calls the page makes
3. Wraps in `<MemoryRouter>`
4. Asserts the page heading is visible (use `getByText`)

This catches: import errors, JSX syntax errors, missing context, broken component props.

### Run tests after every code change

After making any code change (backend or frontend), run the relevant test suite:

```bash
cd backend && npm test   # if backend files changed
cd frontend && npm test  # if frontend files changed
```

If any test fails, **do not stop and report success**. Instead:
1. Read the full error output carefully
2. Identify the root cause (broken import, wrong mock, changed API, logic error, etc.)
3. Fix the code (or the test if the test itself is wrong)
4. Re-run the suite to confirm it passes
5. Only then move on

Repeat until the suite is green. If after two fix attempts the cause is still unclear,
explain the failure to the user and ask for guidance rather than guessing further.

---

## Phone number and postcode validation (March 2026)

### Phone numbers

Install **`libphonenumber-js`** in the frontend (`npm install libphonenumber-js`).
Validate with `isValidPhoneNumber(value, 'GB')`. Returns `false` for empty/null,
so guard with `if (!value || !value.trim()) return null` first.

```js
import { isValidPhoneNumber } from 'libphonenumber-js';

function validatePhone(value) {
  if (!value || !value.trim()) return null;
  try {
    return isValidPhoneNumber(value, 'GB') ? null : 'Enter a valid UK phone number';
  } catch {
    return 'Enter a valid UK phone number';
  }
}
```

### UK postcodes

Use this regex (covers GIR 0AA + all standard AN/ANN/AAN/AANA formats):

```js
const UK_POSTCODE_RE = /^(GIR\s?0AA|[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2})$/i;
```

### Showing all validation errors at once

Do **not** rely on HTML `required` attributes for form validation — use `noValidate`
on the `<form>` and a single `runValidation()` function that returns a flat
`{ fieldName: 'error message' }` map. Call it at submit time and set all errors
in one `setFieldErrors(errs)` call. Also call it on individual field blur to give
early per-field feedback.

```js
// Pattern:
const [fieldErrors, setFieldErrors] = useState({});

function runValidation() {
  const errs = {};
  if (!form.foo.trim()) errs.foo = 'Foo is required';
  // ... all fields ...
  return errs;
}

async function handleSave(e) {
  e.preventDefault();
  const errs = runValidation();
  if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
  // ... proceed with save ...
}
```

---

## Shared address and partner linking (March 2026)

### Data model

Two members can share a single `addresses` row by both having `address_id` pointing
to the same record. `partner_id` is a separate bi-directional link on `members`.

### `address_shared` flag

`GET /members/:id` returns `address_shared: boolean` — true when the member's partner
exists **and** both have the same `address_id`. Computed in SQL:

```sql
(p.id IS NOT NULL AND p.address_id = m.address_id) AS address_shared
```

### Editing a shared address (addressScope)

When saving address edits for a member whose address is shared, the frontend asks
*"Is this change for both X and Y, or just X?"* and sends `addressScope: 'both' | 'me-only'`
in the PATCH body.

- **`'both'`** — update the shared `addresses` row in place (both see the change)
- **`'me-only'`** — INSERT a new `addresses` row (copying unchanged fields from the
  shared base), link only this member to it; partner's `address_id` is untouched

### Changing a member's partner (PATCH side-effects)

When `partnerId` changes in a PATCH request the backend must:

1. Validate `newPartnerId !== memberId` (can't be own partner)
2. Look up Y's `address_id` → set `data._newAddressId` so X.address_id = Y.address_id
3. `UPDATE members SET partner_id = X WHERE id = Y` (bi-directional)
4. If old partner Z exists and Z ≠ Y: `UPDATE members SET partner_id = NULL WHERE id = Z`
5. Note `current.address_id` as `oldAddressIdForCleanup`
6. **Skip** applying `data.address` (address linking takes precedence over field edits)
7. After the member UPDATE: if `oldAddressIdForCleanup` ≠ `newAddressId` and no other
   member references `oldAddressIdForCleanup`, `DELETE FROM addresses` that row

The frontend detects a partner change (`partnerChanged` state flag), fetches the new
partner's full record via `membersApi.get()`, updates the address display fields, greys
them out (pointer-events-none), and omits `address` from the PATCH body so the backend
handles all linking.

---

## System settings (March 2026)

### Data model

`tenant_settings` is a **single-row** table (enforced by `CHECK (id = 'singleton')`).
The singleton row is automatically inserted by `tenant_schema.sql` via
`INSERT … ON CONFLICT (id) DO NOTHING`, so every tenant gets it on first schema
migration and every new tenant gets it at creation time.

### Fields (all from Beacon 8.3 doc)

| Field | Type | Notes |
|-------|------|-------|
| `card_colour` | TEXT | Hex colour for membership cards |
| `email_cards` | BOOLEAN | Attach cards to online join/renew emails |
| `public_phone`, `public_email` | TEXT | Public enquiry contact details |
| `home_page` | TEXT | u3a website URL |
| `online_join_email`, `online_renew_email` | TEXT | Online service enquiry emails |
| `fee_variation` | TEXT | `'same_all_year'` or `'varies_by_month'` |
| `extended_membership_month` | INTEGER (1–12) | Month new memberships include next year; NULL = disabled |
| `advance_renewals_weeks` | INTEGER | Weeks before year-start renewals open |
| `grace_lapse_weeks` | INTEGER | Weeks after year-start before members lapse |
| `deletion_years` | INTEGER (2–7) | Years before long-term lapsed members can be bulk-deleted |
| `default_payment_method` | TEXT | One of: Cash, Cheque, Standing Order, Direct Debit, Online, Other |
| `gift_aid_enabled` | BOOLEAN | Enable Gift Aid claims |
| `gift_aid_online_renewals` | BOOLEAN | Show Gift Aid tick boxes for online renewals |
| `default_town`, `default_county`, `default_std_code` | TEXT | Pre-filled on new member record |
| `paypal_email`, `paypal_cancel_url` | TEXT | PayPal integration (future) |
| `shared_address_warning` | BOOLEAN | Warn if shared-address members have differing status/class |

### "Hide Address from group leaders" setting

This Beacon setting is **deprecated** (per the Feb 2026 Beacon update) and
intentionally **not included** in Beacon2. It has been replaced by the
per-group `show_addresses` column on the `groups` table.

### Privilege resource

Uses the existing `settings` privilege resource (actions: `view`, `change`).
The `Administration` default role has both actions granted.

### API

- `GET  /settings`   — requires `settings:view`
- `PATCH /settings`  — requires `settings:change`

### Frontend

`frontend/src/pages/settings/SystemSettings.jsx` — single-page form, grouped
into sections: Membership Cards, Contact Details, Membership Year & Fees,
Gift Aid, Defaults for New Members, Online Payments (PayPal), Member Record.
Save button calls PATCH and reflects the returned (server-authoritative) values.

### Test pattern note

The SystemSettings page renders "System Settings" in **both** the NavBar
breadcrumb and the page `<h1>`, so use `getAllByText` (not `getByText`) in tests.

---

## Sortable table columns (March 2026)

### Shared infrastructure

- `frontend/src/hooks/useSortedData.js` — `useSortedData(data, defaultKey?, defaultDir?)` returns `{ sorted, sortKey, sortDir, onSort }`. Handles strings (locale-aware), numbers, booleans (true-first in asc), and nulls (always last).
- `frontend/src/components/SortableHeader.jsx` — `<SortableHeader col="..." label="..." sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="..." />` renders a `<th>` with ▲/▼/⇅ indicator.

### Pages updated

Every main list page uses client-side sorting via the hook above. The columns that are **not** made sortable (by design):
- Action columns (Edit/Delete links)
- `leaders` in GroupList (array of objects — no clear sort key)
- Email/tel in GroupRecord group-members tab (hidden for some members)
- RoleEditor privilege matrix (functional grid, not a data list)
- UserEditor role-assignment checkboxes (functional grid)
- MemberStatusList (single-column inline-edit table — minimal value)

### Pattern for new list pages

```jsx
import SortableHeader from '../../components/SortableHeader.jsx';
import { useSortedData } from '../../hooks/useSortedData.js';

const { sorted, sortKey, sortDir, onSort } = useSortedData(myList);
// In thead:
<SortableHeader col="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="px-4 py-2.5 font-normal" />
// In tbody:
{sorted.map((item, i) => ...)}
```

---

## Username-based login (March 2026)

### Overview

System users log in with a **username** (not email). Usernames are lowercase
letters and numbers only, no spaces (e.g. `jbloggs`).

### Data model

`users` table has a `username TEXT` column (nullable, unique where non-null).
- Added via `ALTER TABLE :schema.users ADD COLUMN IF NOT EXISTS username TEXT;`
- Uniqueness enforced by partial index: `CREATE UNIQUE INDEX IF NOT EXISTS :schema_idx_users_username ON :schema.users (username) WHERE username IS NOT NULL;`

### Auth flow

- `POST /auth/login` accepts `{ tenantSlug, username, password }` (no longer `email`)
- `authService.loginUser()` looks up users by `WHERE username = $1`
- Existing users without a username cannot log in until a username is set by admin

### Validation

Backend Zod schema: `username: z.string().regex(/^[a-z0-9]+$/)` (create and update).
Frontend `UserEditor`: input auto-lowercases and strips invalid chars on change.

---

## DateInput component (March 2026)

### Location

`frontend/src/components/DateInput.jsx`

### Usage

Replaces `<input type="date">` everywhere. Accepts typed UK-format (dd/mm/yyyy)
input and has a calendar icon button that opens the native date picker.

```jsx
import DateInput from '../../components/DateInput.jsx';

<DateInput
  value={form.joinedOn}          // ISO string (YYYY-MM-DD) or ''
  onChange={(v) => set('joinedOn', v)}   // always called with ISO or ''
  onBlur={() => handleBlur('joinedOn')}  // optional
  className={ic('joinedOn')}     // applies to the text input
  max="2026-12-31"               // optional, passed to hidden date picker
/>
```

### Behaviour

- Displays in `dd/mm/yyyy` format for typing
- Parses both `dd/mm/yyyy` (typed) and syncs via hidden `<input type="date">` for picker
- Calendar 📅 button calls `input.showPicker()` (Chrome 99+, FF 101+, Safari 14.1+)
- `value` prop changes from outside are synced via `useEffect`

---

## App version display (March 2026)

The frontend version (`frontend/package.json` → `"version"`) is injected at build time
via `vite.config.js` → `define: { __APP_VERSION__: ... }` and shown discreetly in the
top-right corner of every `PageHeader`.

**To release a new version:** bump `"version"` in `frontend/package.json` before committing.
Use semantic versioning — `0.x.0` for feature releases during early development.

## Login transition: username vs email fallback (March 2026)

`authService.loginUser()` first looks up by `username`, then falls back to `email`
if no match is found. This allows existing users without a username set to keep
logging in with their email address while they transition to a username.

Once all users have usernames, the fallback can be removed from `authService.js`.

---

## Finance module (March 2026)

### DB tables

All in `backend/prisma/tenant_schema.sql` (idempotent, picked up by `migrateTenantSchemas()`):

| Table | Notes |
|-------|-------|
| `finance_accounts` | `active`, `locked`, `sort_order`; locked = cannot rename/delete |
| `finance_categories` | same pattern as accounts |
| `transaction_number_seq` | sequential integer auto-assigned |
| `transactions` | `type IN ('in','out')`, `amount NUMERIC(10,2) > 0`, `cleared_at DATE` |
| `transaction_categories` | splits; `SUM(amount)` must equal `transactions.amount` |

### Backend routes — `backend/src/routes/finance.js`

Mounted at `/finance` in `app.js`. Privilege resources used:

| Route pattern | Privilege |
|--------------|-----------|
| `GET /finance/accounts` | `finance_accounts:view` |
| `POST/PATCH/DELETE /finance/accounts` | `finance_accounts:create/change/delete` |
| `GET/POST/PATCH/DELETE /finance/categories` | `finance_categories:*` |
| `GET /finance/transactions` (ledger query) | `finance_ledger:view` |
| `GET /finance/transactions/:id` | `finance_transactions:view` |
| `POST/PATCH/DELETE /finance/transactions/:id` | `finance_transactions:create/change/delete` |

Key rules enforced server-side:
- **Locked** accounts/categories: cannot change name or delete
- **Cleared** transactions (`cleared_at IS NOT NULL`): cannot PATCH or DELETE
- **Category sum**: `|SUM(category.amount) - transaction.amount| > 0.001` → 400

### Frontend pages

| File | Route | Notes |
|------|-------|-------|
| `FinanceAccounts.jsx` | `/finance/accounts` | Inline rename, active toggle, add/delete |
| `FinanceCategories.jsx` | `/finance/categories` | Same pattern |
| `FinanceLedger.jsx` | `/finance/ledger?view=account\|category\|group` | Year selector, running balance in account view |
| `TransactionEditor.jsx` | `/finance/transactions/new`, `/finance/transactions/:id` | Full form per doc 7.2 |

### Finance ledger design decisions

- **Calendar year** (Jan 1–Dec 31) used for year filtering — not financial year.
  The year selector shows current year back 5 years.
- **Running balance** computed client-side in `useMemo`; only meaningful in account view
  sorted by date ascending (the default).
- **Member search** in TransactionEditor: loads all members, filters client-side
  (first 50 results shown). Uses a `size={4}` `<select>` list — not a combobox.
- **Category amounts** stored as individual rows in `transaction_categories`; the
  frontend shows all active categories with number inputs.

### API namespace

```js
import { finance as financeApi } from '../../lib/api.js';

financeApi.listAccounts()
financeApi.createAccount(data)
financeApi.updateAccount(id, data)
financeApi.deleteAccount(id)
// same pattern for listCategories / createCategory / updateCategory / deleteCategory
financeApi.listTransactions({ accountId?, categoryId?, groupId?, year? })
financeApi.getTransaction(id)
financeApi.createTransaction(data)   // data includes `categories: [{category_id, amount}]`
financeApi.updateTransaction(id, data)
financeApi.deleteTransaction(id)
```

### Test helpers note

`backend/src/__tests__/helpers.js` `ALL_PRIVS` must include finance privileges.
They were added in this session — if new finance privilege resources are added,
update `ALL_PRIVS` accordingly.

---

## Validation UX patterns (March 2026)

### Backend Zod errors → inline field errors

The backend returns 422 with `{ error: 'Validation error', issues: [{path, message}, ...] }` for Zod failures. In `MemberEditor` (and should be applied to other forms), catch these and call `setFieldErrors()` to surface per-field errors instead of just showing "Validation error":

```js
} else if (err.status === 422 && err.body?.issues?.length) {
  const newErrs = {};
  for (const issue of err.body.issues) {
    const key = issue.path.replace(/^address\./, '');
    newErrs[key] = issue.message;
  }
  setFieldErrors((prev) => ({ ...prev, ...newErrs }));
  setError('Please correct the errors highlighted below.');
}
```

### Error message styling

- `errMsgCls = 'text-sm text-red-600 mt-1 font-medium'` — not `text-xs`
- Top-level error banner: `rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center`

### Postcode validation when sharing an address

When `existingPartnerId` is set or `newPartnerMode` is true, skip ALL postcode validation (not just the "required" check) — the address is not sent to the backend.

---

## Member classes — varying fees by month (March 2026)

`class_monthly_fees` table: 13 rows per class (month_index 1-12 = Jan-Dec, 13 = Renewals), each with `fee` and `gift_aid_fee`.

- Schema: `backend/prisma/tenant_schema.sql` (idempotent)
- Routes: `GET` and `PUT /member-classes/:id/monthly-fees`
- Frontend: monthly fee grid shown in `MemberClassEditor` when system settings `fee_variation = 'varies_by_month'`
- Auto-propagate: when the checkbox is ticked, typing a fee copies it to all subsequent months

When `fee_variation = 'varies_by_month'`, the single `fee`/`gift_aid_fee` fields on the class record are hidden from the form (they are not meaningful in that mode).

Delete guard: backend now checks member count before deleting a class; returns 409 with message "N members are assigned — make it non-current instead."

---

## Member data validator (March 2026)

### Route

`GET /members/validate` — requires `settings:view` — returns all members with their address fields. **Must stay above `GET /:id`** in members.js to avoid routing conflict.

### Page

`frontend/src/pages/admin/MemberValidator.jsx` at `/admin/validate-members`. Admin-only (shown in Misc section of Home only when `can('settings', 'view')`).

### Validation rules (all client-side)

| Check | Behaviour |
|-------|-----------|
| Postcode | Required; must match `UK_POSTCODE_RE` |
| Email | Optional — missing is OK; present value must be `x@x.x` format |
| Mobile / telephone | Optional — missing is OK; present value validated with `isValidPhoneNumber(v, 'GB')` |
| status_id, class_id, joined_on | Must not be null/empty |

### Fix method

- **Inline** for postcode, email, mobile, telephone — input + Save button; on success local data updated so issue vanishes without re-fetch
- **Link** for missing status/class/joined date — opens the member's edit record
- "Open record →" link always present on every card
- "Re-check now" button re-fetches and re-validates the full dataset

### Extending the validator

When a new member data field is added (e.g. a required date, a new contact field, a format-validated field), **add a corresponding check to `getIssues()` in `MemberValidator.jsx`**. If the field lives on the address table rather than the members table, ensure `GET /members/validate` returns it in its SQL select. Inline-editable fields need a `saveField()` branch to map them to the correct PATCH payload.

### Congratulations state

When `flagged.length === 0`, shows a green "All member data is valid!" banner with member count.

---

## Audit log, u3a Officers, Personal Preferences (March 2026)

### Audit log (doc 9.2a)

- Backend: `GET /audit?from=&to=` (3-month cap, 500-row limit) + `DELETE /audit {before}` (delete-before-date)
- Privilege resources: `audit_trail:view` and `audit_trail:delete`
- Frontend: `frontend/src/pages/misc/AuditLog.jsx` at `/audit`
- Route in Home.jsx: gated on `can('audit_trail', 'view')`
- `logAudit()` in `backend/src/utils/audit.js` is a best-effort helper — wraps everything in try/catch so logging failures never block callers. Call without `await`.

### u3a Officers (doc 9.3)

- Backend: full CRUD + `GET /offices/members` (member list for dropdown with status for colouring)
- Privilege resource: `offices` with actions `view`, `create`, `change`, `delete`
- Frontend: `frontend/src/pages/misc/OfficerList.jsx` at `/officers`
- Post-holder styling: red if status contains "Lapsed"; red + strikethrough if "Deceased" or "Resigned" (case-insensitive substring match)
- Route in Home.jsx: gated on `can('offices', 'view')`

### Personal Preferences (doc 9.1)

- Frontend only: `frontend/src/pages/settings/PersonalPreferences.jsx` at `/preferences`
- Always visible (no privilege gate) — every logged-in user can access
- Three sections: (a) display prefs + inactivity timeout, (b) change password, (c) security Q&A
- Display prefs stored in `localStorage` via `frontend/src/hooks/usePreferences.js` (key `beacon2_prefs`)
  - `getPreferences()` — returns snapshot (not reactive)
  - `savePreferences(updates)` — merges partial updates with defaults
  - `formatMemberName(member)` — respects `displayFormat` setting
- Inactivity timeout: wired in `AuthContext` via `useRef` timer. Resets on `mousemove`, `keydown`, `click`, `touchstart`. Dispatches `auth:expired` when timer fires.
- Change password: calls `PATCH /auth/change-password`; shows 5-bar strength meter
- Security Q&A: loads existing question via `GET /auth/qa`; saves hashed answer via `PATCH /auth/qa`

### Frontend test note: multiple instances of same text

When a heading label also appears on a submit button (e.g. "Change Password"), `getByText` throws "Found multiple elements". Use `getAllByText(...).length > 0` instead.

---

## Data Export & Backup (March 2026)

### Architecture

- Backend export: `backend/src/routes/backup.js` — mounted at `/backup` in `app.js`
- Backend restore: `backend/src/routes/system.js` — `POST /system/restore/:tenantSlug` (system-admin only)
- Frontend export: `frontend/src/pages/misc/DataBackup.jsx` at `/backup` (tenant user, needs `data_export_backup:view`)
- Frontend restore: `frontend/src/pages/system/SystemDashboard.jsx` (system admin panel only)
- Privilege: `data_export_backup` (actions: `view`, `download`, `restore`) — granted to Administration for export

### Export — 8 options

`GET /backup/export?type=<type>` streams an `.xlsx` file. Types:

| type | label | sheets |
|------|-------|--------|
| `members` | Members and addresses | Members |
| `finance` | Finance ledger with detail | Ledger, Detail |
| `groups` | Groups, with members, venues and faculties | Groups, Group members, Venues, Faculties |
| `calendar` | Calendar | Calendar (empty — not yet implemented) |
| `system` | System users, roles and privileges | System Users, User roles, Roles, Privileges |
| `officers` | u3a Officers | u3a Officers |
| `settings` | Site settings and set up | Site Settings 1/2, Finance Accounts/Categories, Membership Classes/Fees, Member Statuses, Polls, Poll assignments, System Messages |
| `all` | Backup all data | All of the above |

The frontend uses `fetch()` with auth header → blob → `URL.createObjectURL` trigger download. This is the `requestBlob` helper in `api.js`. Direct browser navigation cannot be used because the auth token is in memory (not cookies).

Backup filenames include the tenant display name (slugified), type label, date and time, e.g. `oxfordshire_u3a_beacon2_backup_all_data_2026-03-17_14-30.xlsx`.

### Restore — two modes, auto-detected, system admin only

`POST /system/restore/:tenantSlug` accepts a multipart `backup` file upload (system admin token required). Detection: if the `Members` sheet first column is `mkey` → Beacon (legacy); if `id` → Beacon2.

- **Beacon2 restore**: UUIDs preserved; all FK-dependent tables re-inserted in order. Includes users/roles.
- **Beacon restore**: Maps `mkey`/`gkey`/`tkey`/etc to new UUIDs. Partner detection via shared `akey` (exactly 2 members sharing an `akey` are linked as partners). Beacon month `0` in `Membership Fees` = Beacon2 `month_index` 13 (Renewals). Beacon ledger amounts: positive = `in`, negative = `out`.

Both modes use a single `prisma.$transaction` with 5-minute timeout for atomicity.

**User accounts/roles ARE included in the restore** — `clearTenantData` deletes users, roles, and privileges before restore.

The restore helpers (`clearTenantData`, `resetSequences`, `restoreBeacon2`, `restoreBeacon`) are named exports from `backup.js`, imported by `system.js`.

### Critical: restore helpers need a Prisma transaction client

All restore helpers accept a **Prisma transaction client** (`tx`) as their first argument and call `tx.$executeRawUnsafe()`. They do **not** accept a tenant slug.

The restore route in `system.js` must wrap everything in `prisma.$transaction` with `SET search_path` before calling any helper:

```js
const schema = `u3a_${tenantSlug}`;
await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe(`SET search_path TO ${schema}, public`);
  await clearTenantData(tx);
  if (format === 'beacon2') {
    await restoreBeacon2(tx, wb);  // calls resetSequences internally
  } else {
    await restoreBeacon(tx, wb);
    await resetSequences(tx);
  }
}, { timeout: 300_000 });
```

### Backup filenames

The backend sets `Content-Disposition: attachment; filename="..."` including tenant name and timestamp. The frontend `requestBlob()` reads this header — do **not** pass a client-generated filename.

`Content-Disposition` is a non-"safe" header that browsers only expose when the server includes it in `Access-Control-Expose-Headers`. The CORS config in `app.js` must include `exposedHeaders: ['Content-Disposition']` — without this the browser sees `null` for the header and the file downloads as `download.xlsx`.

### Beacon restore: placeholder email for imported users

The `users` table has `email TEXT NOT NULL UNIQUE`. Beacon's System Users sheet does not include email addresses. When importing Beacon users, each gets a unique placeholder email `{uuid}@beacon-migrated.invalid` so the constraint is satisfied. These users can log in by username but cannot receive emails until an admin sets a real email.

### Delete-last-admin guard

`DELETE /users/:id` checks whether the target user is the last holder of the Administration role before deleting. Returns 400 "Cannot delete the last user with the Administration role" if so. This check runs before self-deletion is checked (self-deletion returns 400 first).

### New tenant: adminUsername required

`createTenantSchema()` and the system.js Zod schema both require `adminUsername` (lowercase letters and numbers, `/^[a-z0-9]+$/`). The SystemDashboard create-tenant form has a username field that auto-strips invalid characters on input.

### Libraries

- `exceljs` — Excel generation (write) and parsing (read), installed in backend
- `multer` — multipart file upload handling, installed in backend

### Sequences reset after restore

After inserting all data, `membership_number_seq` and `transaction_number_seq` are reset to `MAX + 1` so new records get correct sequential numbers.

### Zero-amount transactions (Beacon restore)

The `transactions.amount` constraint is `CHECK (amount >= 0)` (not `> 0`) to allow zero-amount transactions that exist in Beacon exports (e.g. free/honorary memberships). The `tenant_schema.sql` includes `ALTER TABLE ... DROP/ADD CONSTRAINT` statements so existing tenants are updated on the next server startup.

### Beacon Site Settings mapping (partial)

| Beacon key | Beacon2 column |
|-----------|----------------|
| `AdvRenewals` | `advance_renewals_weeks` |
| `GraceLapse` | `grace_lapse_weeks` |
| `GiftAidEnable` | `gift_aid_enabled` |
| `GiftAidOnlineRenew` | `gift_aid_online_renewals` |
| `DefaultTown/County/STD` | `default_town/county/std_code` |
| `defaultPaymentMethod` (1–6) | `default_payment_method` (Cash/Cheque/SO/DD/Online/Other) |
| `EnqTelephone/Email/NewMem/Renew` | `public_phone/email/online_join_email/online_renew_email` |
| Site Settings 2 `paypal_account` | `paypal_email` |

---

## Group Venues, Faculties, Schedule, Waiting List (March 2026)

### Group Venues (doc 5.7)

- DB table: `venues` in `tenant_schema.sql` — all fields optional except `name`; `private_address` and `accessible` booleans
- Backend: `backend/src/routes/venues.js` mounted at `/venues` in `app.js`; privilege `group_venues` (view/create/change/delete)
- Frontend: `VenueList.jsx` at `/venues`, `VenueEditor.jsx` at `/venues/new` and `/venues/:id`
- Home.jsx: Venues link gated on `can('group_venues', 'view')`

### Group Faculties (doc 5.8)

- Backend CRUD already existed in `faculties.js`
- Frontend: `FacultyList.jsx` at `/faculties` — inline edit (click Edit → input + Save/Cancel in the row), inline delete, add-new form below table
- Home.jsx: Faculties link gated on `can('group_faculties', 'view')`

### Group Schedule (doc 5.3)

- DB table: `group_events` in `tenant_schema.sql` — FK to `groups`, optional FK to `venues`, `is_private` boolean
- Backend: added to `groups.js` at sub-resource `/groups/:id/events`
  - `GET` — list events ordered by date/time (joins venue name)
  - `POST` — create single or recurring events; if `repeatEvery + repeatUnit + repeatUntil` supplied, generates multiple rows
  - `PATCH /:eventId` — update individual event
  - `DELETE` (body `{ ids }`) — bulk delete selected event IDs
- Frontend: `GroupSchedule` component in `GroupRecord.jsx` (Schedule tab, now `available: !isNew`)
  - Click blue date link to expand inline edit row
  - Show Detail checkbox toggles contact/details columns
  - Checkboxes + "Select all / Deselect all / Delete selected" for bulk delete
  - Add Events form at bottom with recurrence fields (then every N days/weeks/months until date)

### Waiting List (doc 5.10)

- `PATCH /groups/:id/members/:memberId` extended to accept `{ waitingSince: null }` to promote a waiting member to a full member
- Frontend `GroupMembers`: filter checkboxes (Joined members / Waiting list) appear when any waiting members exist; both sets shown in the same table with a "Waiting" column; "join group" button promotes; "remove" button removes
- Members not on waiting list show "Make leader / Remove leader"; waiting members show "join group / remove"

---

## Save success feedback pattern (March 2026)

When a form saves successfully, show a transient green banner that auto-dismisses after 3 seconds:

```jsx
const [saved, setSaved] = useState(false);
const savedTimer = useRef(null);

// After successful save:
setSaved(true);
clearTimeout(savedTimer.current);
savedTimer.current = setTimeout(() => setSaved(false), 3000);

// In JSX (below the form, above buttons or at top of panel):
{saved && (
  <p className="text-green-700 text-sm font-medium bg-green-50 border border-green-200 rounded px-3 py-2">
    ✓ Saved successfully.
  </p>
)}
```

Apply this pattern to any form that does PATCH/PUT saves (not just create flows).

## Venue FK on groups (March 2026)

The `groups` table has `venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL` (added via safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). The venue is shown as a dropdown in GroupDetails populated from `venuesApi.list()`. The parent `GroupRecord` loads venues into `allVenues` state and passes `venues={allVenues}` to `<GroupDetails>`.

## Max-members waiting list enforcement (March 2026)

When `POST /groups/:id/members` is called, the route queries:
```sql
SELECT max_members, enable_waiting_list,
       (SELECT COUNT(*)::int FROM group_members WHERE group_id = $1 AND waiting_since IS NULL) AS joined_count
FROM groups WHERE id = $1
```
If `enable_waiting_list && max_members !== null && joined_count >= max_members`, the member is inserted with `waiting_since = CURRENT_DATE` instead of `NULL`. The frontend `addMember` flow does not need to know — the backend decides automatically.

The test for `POST /groups/:id/members` needs a 4th mock: `{ max_members: null, enable_waiting_list: false, joined_count: 0 }` (the new group-info query).

---

## PostgreSQL DATE/TIME columns return JavaScript Date objects via $queryRawUnsafe (March 2026)

When `event_date DATE` or similar columns are returned from `$queryRawUnsafe`, Prisma/pg serialises them as full ISO-8601 timestamps (`2026-03-26T00:00:00.000Z`), not plain `YYYY-MM-DD` strings. When these values reach the frontend:

- **Display**: always normalise with `.slice(0, 10)` before splitting on `-`  
- **Form fields** (`<input type="date">`): set `value` to `String(ev.event_date).slice(0, 10)` — the browser rejects the full ISO string and shows blank  
- **Time columns** (`HH:MM:SS`): already plain strings; `.slice(0, 5)` is sufficient for display

Pattern:
```js
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10); // handles ISO timestamp or plain date
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}
// In startEdit:
eventDate: ev.event_date ? String(ev.event_date).slice(0, 10) : '',
```

## Beacon restore: default password and system admin "Set password" (March 2026)

Beacon exports do not contain password hashes. On restore, all imported users are given the default password `Beacon2!` (constant `BEACON_DEFAULT_PASSWORD` exported from `backup.js`). The restore success message tells the system admin this.

For locked-out tenants or post-restore access, system admin has a **"Set password"** button per tenant (`POST /system/tenants/:id/set-temp-password`) that sets the password for ALL users in that tenant. This is preferable to a permanent master-user backdoor because:
- It is explicit and auditable (admin chooses when to use it)
- It is scoped to a specific tenant
- The password can be changed back by the tenant admin immediately

---

## Group Schedule — topic field and table design (March 2026)

Per doc 5.3, the schedule table columns are always: Select | Date & Time | Until (end_time) | Venue | Topic | Enquiries (contact). The "Details" field is shown as an indented sub-row beneath each event, controlled by the "Show Detail" checkbox (not as a table column).

The `topic` field is a short subject line, distinct from `details` (longer description). Both are TEXT columns on `group_events`.

Time inputs use `step="900"` (15-minute intervals).

---

## Group Ledger (doc 5.5) (March 2026)

### Architecture

A per-group money in/out ledger entirely independent from the Finance Ledger.

### DB table

`group_ledger_entries` in `tenant_schema.sql` — fields: `id`, `group_id`, `entry_date DATE`, `payee TEXT`, `detail TEXT`, `money_in NUMERIC(10,2)`, `money_out NUMERIC(10,2)`, `created_at`, `updated_at`. Two indexes on `group_id` and `entry_date`.

### Backend routes (in `groups.js`)

| Route | Privilege check |
|-------|----------------|
| `GET /:id/ledger?from=&to=` | `hasLedgerAccess(req, groupId, 'view')` |
| `POST /:id/ledger` | `hasLedgerAccess(req, groupId, 'create')` |
| `PATCH /:id/ledger/:entryId` | `hasLedgerAccess(req, groupId, 'change')` |
| `DELETE /:id/ledger/:entryId` | `hasLedgerAccess(req, groupId, 'delete')` |
| `GET /:id/ledger/download` | `hasLedgerAccess(req, groupId, 'download')` |

`GET /ledger` returns `{ broughtForward: number, entries: [...] }`. `broughtForward` is the net balance of entries BEFORE the `from` date, computed server-side.

`hasLedgerAccess(req, groupId, action)` — checks `group_ledger_all:action` OR (`group_ledger_as_leader:action` AND user's linked member is a leader of that group via a DB join).

The download route generates an Excel file using `exceljs` with a running balance column.

### Frontend component

`GroupLedger` — defined as a top-level function in `GroupRecord.jsx` (not nested). Shows:
- Date range filter (From/To, defaulting to current calendar year Jan 1–Dec 31)
- Table: Brought Forward row | entries with Date, Payee, Detail, In, Out, Running Balance columns | edit/delete links
- Inline edit form (expands the row in place)
- Add Transaction form at bottom

### Privilege resources

`group_ledger_all` and `group_ledger_as_leader`, each with actions `view`, `create`, `change`, `delete`, `download`.

- **Administration** and **Groups Co-ordinator** get `group_ledger_all` (all actions)
- **Group Leader** gets `group_ledger_as_leader` (view, create, change, delete — no download)

### `requestBlob` export

`frontend/src/lib/api.js` exports `requestBlob` (was previously a private function). Import it directly for blob downloads.

### Beacon privkey mapping for group ledger

- `$pGROUPLEDGER = 1510` → `group_ledger_all`
- `$pGROUPLEDGERASLEADER = 1520` → `group_ledger_as_leader`

---

## End-to-end (user acceptance) tests (March 2026)

### Location

`e2e/` — Playwright-based tests that run against a live staging deployment.

### How to run

```bash
cd e2e
npm install
npx playwright install chromium
cp .env.example .env   # fill in staging URL + credentials
npm test
```

### Architecture

- **`global-setup.js`** — runs once before all tests; creates (or resets) a dedicated test tenant via the system-admin API, then seeds a finance account and an extra member class.
- **`fixtures/admin.js`** — extended Playwright fixture that logs in as the test-tenant admin before each test. Because Beacon2 stores the access token in memory only, a fresh login is needed per test (~200 ms overhead).
- **`pages/`** — Page Object Models; use `getByRole`/`getByLabel`/`getByText` selectors for resilience against markup changes.
- **`tests/01–11`** — specs numbered to match Beacon UG sections.

### Test data

Every test creates its own data (with a `Date.now()` suffix) and cleans up in the same test file. Tests within a file run serially so create→edit→delete sequences are reliable.

### Extending

When a new Beacon2 feature is built, add a new spec (or extend an existing one) that:
1. References the corresponding Beacon UG section in the file header.
2. Imports `{ test, expect }` from `../fixtures/admin.js`.
3. Uses the `adminPage` fixture.
4. If setup seed data is needed, add it to `global-setup.js`.

---

## Addresses Export and Label Printing (March 2026)

### Architecture

- Backend: `backend/src/routes/addressExport.js` — mounted at `/address-export` in `app.js`
- Frontend: `frontend/src/pages/members/AddressesExport.jsx` at `/addresses-export`
- PDF generation: `pdfkit` package installed in backend (installed March 2026)
- Privilege resources: `addresses_export` (view/download) and `address_labels` (download) — already in `privilegeResources.js` and `defaultRoles.js`

### Endpoints

| Route | Privilege | Description |
|-------|-----------|-------------|
| `GET /address-export` | `addresses_export:view` | List members (with filters) for selection |
| `GET /address-export/download?format=...&ids=...` | `addresses_export:download` | Download Excel/CSV/TSV/TAM |
| `GET /address-export/labels?ids=...&cols=...&...` | `address_labels:download` | Download PDF labels |

### Filters supported

`status` (comma-separated IDs), `classId`, `pollId`, `negatePoll` (`'1'`), `groupId`

### Label settings

Default: 3 columns, 7 rows, 70mm wide, 38mm high, 10mm top offset, 7mm left offset, 9pt font.
Saved in `localStorage` under key `beacon2_label_settings`.

### PDF label generation (PDFKit)

- A4 page (595.28pt × 841.89pt), margin=0
- Converts mm → points using factor `72/25.4`
- Partners sharing the same `address_id` are combined into one label (same surname → "Title Init1 & Title Init2 Surname"; different surnames → full name & full name)
- Multi-page: new page added when all label positions on current page are filled

### NavBar prop

`NavBar` accepts a `links` prop (not `items`). Passing `items` causes "Cannot read properties of undefined (reading 'map')" crash.

### Test note

"Addresses Export" appears in both the NavBar breadcrumb and the `<h1>`, so use `getAllByText` not `getByText` in tests.
## Recent Members and Statistics (March 2026 — doc 4.4 and 4.9)

### Membership year start setting

`tenant_settings` now has `year_start_month INTEGER DEFAULT 1` and `year_start_day INTEGER DEFAULT 1` (added via safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). These are exposed in `GET/PATCH /settings` and editable in the Membership Year & Fees section of SystemSettings.

The statistics backend computes the current membership year start date from these: if `month/day` is in the future this calendar year, use last year; otherwise use this year.

### Statistics backend (GET /members/statistics)

Returns six parallel queries combined into one JSON response:
1. Settings (year start, advance weeks, grace weeks)
2. `classStats` — per-class counts for current members (total, with_email, first_year, second_year_plus)
3. `statusCounts` — current_not_renewed (next_renewal < year_start), lapsed_count
4. `groupStats` — active_groups, avg_members
5. `notInGroup` — current members with no active group membership
6. `renewStats` — per-class not_renewed and new_members for the from/to date range

Current members are identified by `status ILIKE '%Current%'`; lapsed by `status ILIKE '%Lapsed%'`.

### Route ordering note

`GET /members/recent` and `GET /members/statistics` must be placed **above** `GET /members/:id` in the router, just like `/validate`. This is already the case.

### Frontend test: multiple instances of "Recent Members"

"Recent Members" appears in both the NavBar breadcrumb and the `<h1>`, so use `getAllByText(...).length > 0` not `getByText(...)` in tests. The same principle applies to "Statistics" if it appears in multiple places.

---

## Membership Renewals and Non-renewals (March 2026 — docs 4.5 and 4.6)

### Backend routes added to members.js

| Route | Privilege | Notes |
|-------|-----------|-------|
| `GET /members/renewals` | `membership_renewals:view` | Returns members + year boundaries |
| `POST /members/renew` | `membership_renewals:renew` | Bulk renew; inserts finance transactions directly |
| `GET /members/non-renewals?mode=` | `members_non_renewals:view` | `this_year` or `long_term` modes |
| `POST /members/lapse` | `members_non_renewals:lapse` | Bulk-updates status to Lapsed |

All placed **above** `GET /members/validate` which is above `GET /members/:id`.

### Finance transactions in POST /renew

The `POST /finance/transactions` route enforces `categories.min(1)` in its Zod schema.
For bulk renewals, transactions are inserted **directly via SQL** in the `/renew` handler
(bypassing the finance route), with no category splits. Users can categorize later via TransactionEditor.

```sql
INSERT INTO transactions
  (account_id, date, type, from_to, amount, payment_method, member_id_1)
VALUES ($1, CURRENT_DATE, 'in', $2, $3::numeric, $4, $5)
RETURNING id, transaction_number
```

### Year boundary computation

Done in JavaScript to avoid PostgreSQL interval casting issues:
- `yearStart`, `prevYearStart`, `nextYearStart` computed from `year_start_month`/`year_start_day` settings
- `showNextYear` = advance renewals period is currently open (within `advance_renewals_weeks` of next year)
- Passed to SQL as `$1::date`

### Non-renewals modes

- **`this_year`**: Current members whose `next_renewal < yearStart` (not yet Lapsed)
- **`long_term`**: All members whose `next_renewal` is before a cutoff computed as `now - deletion_years`

### Lapse bulk action

`POST /members/lapse` uses `UPDATE ... WHERE id = ANY($2::text[])` for efficiency.
Finds Lapsed status via `WHERE name ILIKE '%Lapsed%'`.

### pdfkit missing from backend node_modules

If backend tests fail with `Error: Failed to load url pdfkit`, run `npm install pdfkit` in
the backend directory. The package is declared in `package.json` but was missing from
`node_modules` (possibly due to a branch divergence).

### Frontend pages

- `frontend/src/pages/membership/MembershipRenewals.jsx` — period tabs (current/prev/next year),
  account + payment method selectors, per-member table with gift aid checkbox and received amount input,
  confirmation dialog, bulk renew + add-to-poll actions
- `frontend/src/pages/membership/NonRenewals.jsx` — radio mode selector (this year / long term),
  sortable table, Lapse action (this_year mode), Delete action (long_term mode), confirmation dialogs

### Home.jsx links

```js
{ label: 'Membership renewals', to: can('membership_renewals', 'view') ? '/membership/renewals' : null },
{ label: 'Non-renewals',        to: can('members_non_renewals', 'view') ? '/membership/non-renewals' : null },
```

---

## Transfer Money, Reconcile Account, Financial Statement, Groups Statement (March 2026 — docs 7.3, 7.5, 7.6, 7.7)

### DB additions

- `transactions.transfer_id TEXT` — shared UUID linking two paired transfer transactions
- `finance_accounts.balance_brought_forward NUMERIC(10,2) DEFAULT 0` — account opening balance before Beacon2 started

Both added via safe `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.

### Transfer Money (7.3)

- Backend: `GET/POST/PATCH/DELETE /finance/transfers` — privilege `finance_transfer_money`
- A transfer creates two `transactions` rows sharing the same `transfer_id`: type=`out` for from_account, type=`in` for to_account
- Deleting either leg via `/transfers/:transferId` deletes both; the existing `PATCH /transactions/:id` and `DELETE /transactions/:id` routes return 400 if the transaction has a `transfer_id`
- Frontend: `TransferMoney.jsx` at `/finance/transfers` — combined form + list page
- The `listTransfers` query filters `WHERE t_out.type = 'out'` to avoid duplicate rows per transfer

### Reconcile Account (7.5)

- Backend: `GET /finance/reconcile?accountId=` returns `{ account, clearedBalance, uncleared }`
- `clearedBalance = account.balance_brought_forward + SUM(cleared in - cleared out)`
- `POST /finance/reconcile` body: `{ accountId, statementDate, transactionIds }` — sets `cleared_at = statementDate`
- Balance difference is computed client-side; reconcile button available even if diff ≠ 0 (with warning)
- Frontend: `ReconcileAccount.jsx` at `/finance/reconcile`

### Financial Statement (7.6)

- Backend: `GET /finance/statement?accountId=&year=` and `GET /finance/statement/download?...&format=xlsx`
- `accountId='all'` combines all active accounts
- Financial year bounds computed from `tenant_settings.year_start_month/day`; year named by calendar year at start
- Opening balance = sum of `balance_brought_forward` + net of all transactions before year start
- Category breakdown uses `transaction_categories JOIN finance_categories`; totals include uncategorized transactions
- Download uses ExcelJS; outputs Receipts section, Payments section, Balance Sheet
- Year selector: current year minus 5 years
- Frontend: `FinancialStatement.jsx` at `/finance/statement`
- Previous year comparison and membership count deferred per agreed scope

### Groups Statement (7.7)

- Backend: `GET /finance/groups-statement?from=&to=&showTransactions=` and download
- Queries `group_ledger_entries` (separate from main transactions); figures do NOT link to main Finance Ledger
- Optional `showTransactions` returns per-group entries as a parallel array
- Download uses ExcelJS; group rows optionally followed by indented transaction rows; totals row at end
- Frontend: `GroupsStatement.jsx` at `/finance/groups-statement`

### Finance Accounts — balance b/f

`GET /finance/accounts` now returns `balance_brought_forward`. The `FinanceAccounts.jsx` page has an inline-editable column for it (click the value to edit, save/cancel inline). The `POST` and `PATCH /accounts/:id` routes accept `balance_brought_forward`.

### Financial year — existing settings

The financial year start (`year_start_month`, `year_start_day`) already existed in `tenant_settings`. No new columns were needed for the financial statement feature.
