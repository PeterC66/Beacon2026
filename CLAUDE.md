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

## Reference documentation

### User Guide — `docs/BeaconUG/`

Admin and user documentation for the original Beacon system lives in `docs/BeaconUG/`.
Each subfolder corresponds to one webpage from the Beacon User Guide: the page was
printed to PDF, then the PDF was transcribed into Markdown, with all images kept
alongside it in the same folder.

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

At the end of any session that raised problems, learned something new, or required
a non-obvious fix, **update this file** with the lessons learned before pushing.
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
