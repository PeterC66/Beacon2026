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

- [ ] **Shared components** — import `PageHeader`, `NavBar`, `SortableHeader`, `DateInput`,
  `RequiredMark` instead of duplicating.

- [ ] **Shared hooks** — use existing hooks instead of reimplementing:
  `useUnsavedChanges`, `useSortedData`, `usePreferences`, `useCookieConsent`.

- [ ] **Shared utilities** — use `formatMemberName()` from `usePreferences.js`,
  `formatShortAddress()`, `formatPhone()`, and `isSubscriptionOverdue()` from
  `frontend/src/lib/memberFormatters.js`.

- [ ] **Record timestamps** — use `<RecordTimestamp label="X record" createdAt={…} updatedAt={…} />`
  from `frontend/src/components/RecordTimestamp.jsx` for all "created / last changed"
  displays on record detail pages. Do not duplicate the `fmtTimestamp` logic inline.

- [ ] **NavBar privilege-gated links** — every NavBar link to a privileged page must use
  `disabled: !can(resource, action)` so unprivileged users see the link greyed out rather
  than missing. Home link never needs a gate.

## Form inputs

- [ ] **Every `<input>`, `<textarea>`, and `<select>` must have a `name` attribute.**
  Use the React state/form property name (e.g., `value={form.forenames}` → `name="forenames"`).
  This is required for E2E test locators (`input[name="..."]`) and for accessibility.
  Checkboxes and radio buttons may be skipped when they are pure UI toggles.

## Edit forms

- [ ] **`useUnsavedChanges` hook** on every full-page edit form.
  Call `markDirty()` on field change, `markClean()` before navigate on save/cancel.

- [ ] **Save success feedback** — transient green banner, auto-dismiss after 3 seconds.
  **Always scroll to top** after `setSaved(true)`:
  `window.scrollTo({ top: 0, behavior: 'smooth' });`
  so the user sees the success message even if the form is long.

- [ ] **Mandatory field indicator** — use `<RequiredMark />` from
  `frontend/src/components/RequiredMark.jsx` next to the label text. Renders a red
  asterisk (`<span className="text-red-500 ml-0.5" aria-hidden="true">*</span>`).
  Never use plain `*` in label text or `<strong>` to indicate required fields.

- [ ] **Validation UX** — use `noValidate` on `<form>`, single `runValidation()` returning
  `{ fieldName: 'error message' }`, set all errors at once. Also validate on individual
  field blur.

- [ ] **Scroll to first error on validation failure** — every form must scroll to the
  first error when the user clicks Save and validation fails.
  - **Field-level errors** (`fieldErrors` object): call
    `scrollToFirstFieldError(Object.keys(errs))` from `frontend/src/lib/scrollToError.js`.
    This finds the first `<input>`/`<select>` by its `name` attribute and scrolls + focuses it.
  - **Form-level errors** (single error string): add `data-form-error` to the error
    display element, then call `scrollToFormError()` which scrolls to that element
    after the next render frame.

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

- [ ] **Always use `@map` for snake_case columns** in Prisma models — every field must
  have an explicit `@map("snake_case_name")` annotation so that `prisma db push` creates
  snake_case columns. Without `@map`, Prisma uses the camelCase field name as the column
  name, which then requires quoted identifiers (`"camelCase"`) in all raw SQL and causes
  "column does not exist" errors when the table is created by a different path.

## API and network

- [ ] **Use `frontend/src/lib/api.js` for all backend calls** — never raw `fetch()`.
  The client auto-attaches the Bearer token and tenant slug, handles 401 refresh,
  and sends credentials for the httpOnly cookie.

- [ ] **Handle API errors via `ApiError`** — catch blocks should check `err.status`
  and `err.body`. 422 responses with `issues` array → map to `setFieldErrors()`.

## Code and modules

- [ ] **ES modules** (`import`/`export`) throughout — never `require()`.

- [ ] **Zod validation** on all request bodies before processing.

- [ ] **Access token in memory only** — never localStorage or sessionStorage.

- [ ] **Auth context** — use `useAuth()` from `frontend/src/context/AuthContext.jsx`
  to access `{ user, tenant, can(resource, action), isSiteAdmin }`. Never roll
  your own privilege checks.

## Backend routes

- [ ] **Middleware chain** — every tenant route follows:
  `requireAuth` → `requirePrivilege(resource, action)` → `async (req, res, next) => { try { … } catch (e) { next(e); } }`.

- [ ] **Audit logging** — call `logAudit(slug, { userId, userName, action, entityType, entityId, entityName, detail })`
  from `backend/src/utils/audit.js` for create/update/delete operations. `logAudit`
  never throws, so no try/catch needed around it.

## List pages

- [ ] **Sortable columns** — use `useSortedData` hook + `SortableHeader` component.

- [ ] **Selection and bulk action layout** — on pages with checkbox selection and
  "Do with selected" actions, follow this order top-to-bottom:

  1. **Selection quick-picks** — above the table, in a single line:
     `{count} items shown | Select: All · Clear All · Email only · Without email ·
     Portal password set · Without portal password · Email not confirmed · {N} selected`
     Style: `text-sm text-blue-700 hover:underline` links, count in `text-slate-500`,
     selected count in `font-medium text-blue-700`.

  2. **The table** — with a select-all checkbox in the header row.

  3. **Bulk action bar** — below the table, shown only when `selected.size > 0`.
     Wrapped in `bg-white/90 rounded-lg shadow-sm p-3`. Contains a labelled dropdown
     ("Do with {N} selected …"), any secondary pickers (poll, group, fields), and
     an action button.

  Pages following this standard: MemberList, GroupList, MembershipCards,
  MembershipRenewals, RecentMembers. Specialised pages (FinanceLedger,
  ReconcileAccount, CreditBatches, AddressesExport) may vary.

## Loading states

- [ ] **Initial load** — `const [loading, setLoading] = useState(true)`, call
  `setLoading(false)` in a `finally` block after the fetch.

- [ ] **Display while loading** —
  `<p className="text-center text-slate-500 py-8">Loading...</p>`

## Delete confirmations

- [ ] **Use `window.confirm()` before every destructive action** — with a clear,
  user-friendly message naming the item being deleted.
  Example: `if (!window.confirm('Delete group "Chess Club"? This cannot be undone.')) return;`

## Success and error banners

- [ ] **Success banner** — use this pattern consistently:
  ```jsx
  <p className="rounded-md bg-green-50 border border-green-300 px-4 py-3
     text-green-700 text-sm font-medium text-center mb-4">
  ```
  Auto-dismiss after 3 seconds with `setTimeout(() => setSaved(false), 3000)`.

- [ ] **Error banner** — use this pattern consistently:
  ```jsx
  <p className="rounded-md bg-red-50 border border-red-300 px-4 py-3
     text-red-700 text-sm text-center mb-4">
  ```

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
