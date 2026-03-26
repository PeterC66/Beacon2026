# Beacon2 Changelog

All notable changes are documented here.
Format: `## [version] — YYYY-MM-DD` with bullet points per change.

---

## [0.7.7] — 2026-03-26

### Added
- Home page bottom panel with fixed links (Beacon Users' Forum, User Guide,
  Beacon Website), public website links (Join, Portal, groups, calendar),
  and Documents row
- System-wide message (`sys_settings` table) — editable from System Dashboard,
  displayed on every tenant's Home page (default: `<<System Message here>>`)
- Home page tenant notice — displays `home_page_notice` system message with
  `#U3ANAME` substitution
- `GET /settings/home-info` endpoint — returns tenant name, home page notice,
  and system-wide message in one call
- `GET/PATCH /system/settings` endpoints for system-wide settings
- Read-only compact member view (`/members/:id/compact`) — condensed single-screen
  layout inspired by Beacon, with two-column grid on laptop and responsive stacking
  on smaller screens
- GoToMemberButton component — quick-navigate to partner member from member record
- Clear button on Gift Aid From date field
- Payment method filter and info text on Members List
- Hint text below Home u3a field for Associate members
- Show login attempts remaining on failed login
- Show "Settings last changed" timestamp on System Settings page
- Scroll-to-first-error on form validation failure — shared utility applied to all
  6 forms (MemberEditor, JoinForm, PortalRegister, TransactionEditor,
  TransactionRefund, TransferMoney)

### Changed
- Street field label renamed to "Street/Building" on member record
- GoToMemberButton scrolls to top when navigating

### Fixed
- Invalid Date display in Gift Aid Log for withdrawn entries
- BeaconUG comparison document — 5 inaccuracies corrected

---

## [0.7.0] — 2026-03-25

### Added
- Member record: emergency contact field, nav links, groups and transactions
  display, created/last changed timestamps, editable initials field
- "All" status filter on Members List (show all members regardless of status)
- Address display on Members List and Recent Members pages
- RequiredMark component — standardised mandatory field indicator across all forms
- Add New Member form improvements per doc 4.3: default joined date to today,
  auto-compute next renewal, partner handling, payment recording
- Payment method defaults: BACS + Current account pre-selected for all methods
- Shared address change dialog: 3-option modal (both / me-only / cancel),
  triggered only on address-field changes
- Utilities menu added under Misc on Home screen
- BeaconUG-Comparison.md — living comparison document tracking Beacon2 vs
  original Beacon User Guide

### Fixed
- Member class default: use locked "Individual" class, not current flag
- `partnerClassId2` reference error on shared address save
- Recent members query: telephone is on addresses table, not members table
- Auto-generated membership transaction detail field now populated
- Member record created/changed text made more legible

---

## [0.6.0] — 2026-03-24

### Added
- SiteWorks Activated setting — hides scheduling fields from Group screen
  when SiteWorks integration is not enabled
- Flexible account selection on Financial Statement (any account, not just default)
- `role="tab"` and `role="tablist"` ARIA attributes on group record tabs
- E2E test documentation: pitfalls for heading strict mode, SPA `waitForURL`,
  element types, and `/new` URL gotchas

### Changed
- Group names in GroupList now use `<Link>` for SPA navigation instead of `<button>`
- Unsaved-changes guard no longer blocks navigation when creating new records

### Fixed
- Extensive E2E test suite fixes across all modules (members, finance, groups,
  roles, users, settings, venues, faculties, officers, backup) — strict mode
  violations, SPA navigation patterns, selector mismatches, and timeout issues

---

## [0.3.0] — 2026-03-10

### Added
- Finance module — accounts, categories, transactions, ledger (docs 7.1, 7.2, 8.6)
  - `GET/POST/PATCH/DELETE /finance/accounts` and `/finance/categories`
  - `GET/POST/PATCH/DELETE /finance/transactions/:id`
  - `GET /finance/transactions` — ledger query (filter by account / category / group / year)
  - Locked accounts/categories cannot be renamed or deleted
  - Cleared transactions cannot be edited or deleted
  - Category amounts must sum to transaction total (enforced frontend + backend)
  - Running balance column in account ledger view (client-side, date-ascending sort)
- Searchable group filter in FinanceLedger (per doc 7.1)
- `GET /health` now returns `{ status, version, env, uptime }` — deployable sanity check
- CHANGELOG.md (this file)
- CI version-bump check: PRs to `main` fail if `frontend/package.json` version is unchanged

### Changed
- Semver policy adopted: MINOR for sprints, PATCH for hot-fixes, MAJOR for breaking changes
- `frontend/package.json` version bump is now enforced by CI on every PR to `main`

---

## [0.2.0] — 2026-03-08 to 2026-03-10

### Added
- Members module — member list, member editor (docs 4.1, 4.2, 4.3, 4.3.1, 4.3.2)
  - Full CRUD: `GET/POST/PATCH/DELETE /members`
  - Shared address handling: `addressScope: 'both' | 'me-only'` on PATCH
  - Partner linking with bi-directional sync and old-address cleanup
  - Phone number validation (`libphonenumber-js`, GB locale)
  - UK postcode validation regex
- Groups module — group list, group record with tabs: Details, Members, Ledger (docs 5.1, 5.2, 5.4, 5.6)
  - `GET/POST/PATCH/DELETE /groups`
  - Group member management (add by member number, remove, promote to leader)
  - Faculties endpoint (`/faculties`) for group categorisation
  - Group venues (data model in place)
- Membership set-up — member classes and member statuses (doc 8.7)
  - `GET/POST/PATCH/DELETE /member-classes` and `/member-statuses`
  - Locked classes/statuses (Current, Lapsed, Resigned, Deceased) cannot be deleted
- System settings — single-row `tenant_settings` table (doc 8.3)
  - `GET/PATCH /settings` with full field set (cards, contact, fees, Gift Aid, defaults, PayPal)
- Username-based login — users now log in with `username` (not email)
  - Fallback to email for users without a username (transition period)
  - Username validated as lowercase alphanumeric only
- `DateInput` component — typed UK-format (dd/mm/yyyy) + native date picker via calendar button
- App version display in `PageHeader` (injected at build time via `vite.config.js` `define`)
- Sortable table columns on all list pages (`useSortedData` hook + `SortableHeader` component)
- Tailwind CSS v3 adopted across all pages (Option B migration); removed all `.b-*` custom classes
- Testing harness — vitest + supertest (backend), vitest + React Testing Library (frontend)
- CI via GitHub Actions (`.github/workflows/ci.yml`) — runs on push to `claude/**` and PRs to `main`
- Tenant schema auto-migration on startup (`migrateTenantSchemas()`) — idempotent, `IF NOT EXISTS`
- `PageHeader` and `NavBar` as shared components used on every page

### Fixed
- Prisma `$queryRawUnsafe` type-cast issue — explicit `::date`, `::time`, `::numeric` casts required
- Login: `sameSite=none` cookie for cross-origin Vercel/Render setup
- Express rate-limit: trust Render proxy for correct `X-Forwarded-For`

---

## [0.1.0] — 2026-03-06

### Added
- Initial project scaffold — Express backend, React + Vite frontend, PostgreSQL schema-per-tenant
- Auth module — JWT access tokens (15 min, in-memory) + refresh tokens (30 days, httpOnly cookie)
  - `POST /auth/login`, `/auth/logout`, `/auth/refresh`
  - `POST /auth/system/login` (system-admin tier, separate endpoint)
  - bcrypt password hashing (12 rounds)
  - Redis session invalidation (disabled in POC via `USE_REDIS=false`)
- Roles and privileges — full CRUD, privilege matrix UI (`RoleEditor`)
  - `GET/POST/PATCH/DELETE /roles`, `PUT /roles/:id/privileges`
  - `GET /privileges/resources` — complete resource list
  - Five default roles seeded per tenant: Administration, Group Leaders, Groups Coordinator, Membership Secretary, Treasurer
- Users — CRUD, role assignment (`GET/POST/PATCH/DELETE /users`)
- System admin — tenant management (`GET/POST/PATCH /system/tenants`)
- System login + dashboard pages (`SystemLogin`, `SystemDashboard`)
- Login page with tenant-slug cookie persistence
- Home page menu (5-column grid desktop, single-column mobile)
- Multi-tenancy: schema-per-tenant, `tenantQuery()` / `withTenant()` utilities
- Render + Vercel deployment configuration (`render.yaml`, `vercel.json`)
- Auto-migrate and seed on startup (`migrateAndSeed()` before `app.listen()`)
