# Beacon2 — Cross-Cutting Standards Checklist

**Read this before starting implementation of any new page or endpoint.**
Every item below applies to every new feature — no exceptions.

---

## New pages and endpoints

- [ ] **Named privilege resource** — never reuse `settings:view` as a general admin gate.
  Add to `privilegeResources.js`, grant in `defaultRoles.js`, add to `ALL_PRIVS` in test helpers,
  use `requirePrivilege` on backend route and `can` in frontend guard.

- [ ] **Never define component functions inside other components.**
  Use a plain render function (`renderRow(key)`) or extract to a top-level component.

- [ ] **Tailwind CSS only** — no custom CSS classes. Follow the common patterns in CLAUDE.md
  (inputs, buttons, table rows, cards, grids, labels).

- [ ] **Shared components** — import `PageHeader`, `NavBar`, `SortableHeader`, `DateInput`
  instead of duplicating.

## Form inputs

- [ ] **Every `<input>`, `<textarea>`, and `<select>` must have a `name` attribute.**
  Use the React state/form property name (e.g., `value={form.forenames}` → `name="forenames"`).
  This is required for E2E test locators (`input[name="..."]`) and for accessibility.
  Checkboxes and radio buttons may be skipped when they are pure UI toggles.

## Edit forms

- [ ] **`useUnsavedChanges` hook** on every full-page edit form.
  Call `markDirty()` on field change, `markClean()` before navigate on save/cancel.

- [ ] **Save success feedback** — transient green banner, auto-dismiss after 3 seconds.

- [ ] **Mandatory field indicator** — use `<RequiredMark />` from
  `frontend/src/components/RequiredMark.jsx` next to the label text. Renders a red
  asterisk (`<span className="text-red-500 ml-0.5" aria-hidden="true">*</span>`).
  Never use plain `*` in label text or `<strong>` to indicate required fields.

- [ ] **Validation UX** — use `noValidate` on `<form>`, single `runValidation()` returning
  `{ fieldName: 'error message' }`, set all errors at once. Also validate on individual
  field blur.

- [ ] **Backend Zod errors → inline field errors** — catch 422 with `issues` array,
  map to `setFieldErrors()`.

## Downloads and exports

- [ ] **Tenant name in filename** — first segment of every download filename.
  ```js
  const tenantPart = req.user.tenantSlug.replace(/^u3a_/, '');
  ```

- [ ] **`Content-Disposition` exposed** — CORS config must include
  `exposedHeaders: ['Content-Disposition']`.

## Database and SQL

- [ ] **Parameterised queries only** — never string concatenation.

- [ ] **Explicit PostgreSQL casts** for non-text columns in `$queryRawUnsafe`:
  `::date`, `::time`, `::numeric`.

- [ ] **`tenant_schema.sql` idempotent** — `CREATE ... IF NOT EXISTS`, `ON CONFLICT DO NOTHING`,
  explicit index names, no semicolons in SQL comments.

- [ ] **All tenant queries** through `tenantQuery()` or `withTenant()`.

## Code and modules

- [ ] **ES modules** (`import`/`export`) throughout — never `require()`.

- [ ] **Zod validation** on all request bodies before processing.

- [ ] **Access token in memory only** — never localStorage or sessionStorage.

## List pages

- [ ] **Sortable columns** — use `useSortedData` hook + `SortableHeader` component.

## Testing

- [ ] **Run tests after every code change** — `cd backend && npm test` / `cd frontend && npm test`.
  Fix failures before moving on.

- [ ] **New backend endpoint** → add test with mocked DB (`tenantQuery.mockResolvedValueOnce`).

- [ ] **New frontend page** → add smoke test (mock API, mock AuthContext, wrap in `<MemoryRouter>`,
  assert heading visible).

- [ ] **Multiple text instances** — if heading appears in NavBar breadcrumb AND `<h1>`,
  use `getAllByText` not `getByText` in tests.

## Naming and style

- [ ] **u3a** always lowercase.

- [ ] **Beacon2** (not Beacon 2, beacon2, etc.).

- [ ] **Development branch** — always `claude/...`; never push directly to `main`.

## Session discipline

- [ ] **Ask questions first** — until 95% certain you can carry out the task.

- [ ] **Session wrap-up** — review what was built; update `CLAUDE-REFERENCE.md` if anything
  new/non-obvious was learned; commit and tell the user.
