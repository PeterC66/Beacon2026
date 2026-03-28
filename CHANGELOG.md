# Beacon2 Changelog

All notable changes are documented here.
Format: `## [version] — YYYY-MM-DD` with bullet points per change.

---

## [0.7.10] — 2026-03-27

### Added
- **Member photos** (docs 4.2, 4.3, 5.4, 10.2.4) — upload, view, and remove photos
  on the member record (new and existing members); jpg/png/gif, max 2 MB, with
  square-format recommendation for membership cards
- Photos appear on **membership cards PDF** — displayed in the top-right corner of
  each card
- **Group members PDF** (doc 5.4) — when any member in the group has a photo, the PDF
  switches to a photo-aware card layout with contact details alongside each photo
- Backend API: `POST/DELETE/GET /members/:id/photo` endpoints with validation
- `has_photo` flag returned in member record (full photo data excluded from GET response)
- **Portal photo upload** (doc 10.2.4) — members can upload, view, and remove their
  photo from the Members Portal personal details page; uses same validation (jpg/png/gif,
  max 2 MB) and storage as admin-side upload
- TAM submission cookie — when downloading in TAM format, the selected Status
  and Class filters are saved to localStorage (consent-gated) and restored
  next time TAM format is selected (`beacon2_tam_submission`)

### Fixed
- CSV/TSV export column mismatch — headers had 8 columns (including "Address 4")
  but data rows only had 7 values; removed the unused "Address 4" header
## [0.7.13] — 2026-03-27

### Added
- Members Portal dashboard (doc 10.2) — home page after login with greeting,
  membership expiry, and conditional feature links based on portal_config
- Portal Groups (doc 10.2.2) — view all active groups with MEMBER/WAITING badges;
  expandable details (When, Venue, Contact, Information) controlled by group_info_config;
  Join group / Leave group with confirmation dialogs; waiting list support; group leader
  notification (stubbed)
- Portal Calendar (doc 10.2.3) — calendar view with All / Group / Own groups filters;
  date range from now to end of year; column visibility per calendar_config; Download PDF
- Portal Personal Details (doc 10.2.4) — edit personal details and address; change
  password; email change triggers re-verification flow; confirmation email via
  system_messages template
- Portal Replacement Card (doc 10.2.5) — request replacement membership card by email;
  validates Current status and within renewal period; marks card as not printed
- Backend portal auth middleware (`requirePortalAuth`) — validates portal JWT tokens
- `portal_details_updated` system message template — confirmation email for portal
  detail changes
- Production options document (`docs/production-options.md`) — high-level technical
  options paper for scaling Beacon2 to production

---

## [0.7.9] — 2026-03-27

### Fixed
- E2E tests: member creation now includes payment to keep status as "Current",
  fixing failures in member edit/search/delete and user creation tests caused
  by the Applicant auto-switch feature
- E2E tests: added test for the no-payment Applicant creation path
- E2E tests: fixed timeout waiting for hidden "Next renewal" input on new member form

---

## [0.7.8] — 2026-03-27

### Added
- E2E test tenant auto-cleanup — test tenant is now deleted on successful runs;
  preserved on failure for inspection (via success-reporter + global-teardown)
- Unpaid application process — when an online applicant submits but doesn't pay,
  they now see a JoinPending page with a "Pay Now" button, a bookmarkable
  resume-payment link, and an "Email me this link" option
- ResumePayment page (`/public/:slug/resume-payment/:token`) — lets applicants
  return and complete payment from a saved or emailed link
- `payment_token` column on members — generated at application time, cleared on
  payment confirmation
- `online_join_payment_link` system message template — customisable email sent
  when applicant requests the payment link; supports `#PAYMENTLINK` token
- Backend routes: `GET /:slug/resume-payment/:token` (lookup + re-initiate payment),
  `POST /:slug/email-payment-link` (send payment link email)
- Documented admin workflow for cleaning up stale Applicant records (filter by
  Applicant status in Members List, delete individually)
- Admin Add Member without payment — when no payment details are entered, the
  member is automatically saved as Applicant with a payment token; admin is
  offered to email the payment link to the new member

### Changed
- Online joining flow now goes through JoinPending page instead of redirecting
  directly to PayPal, giving applicants a chance to save the payment link
- `POST /:slug/join` response now includes `paymentToken` and `className`
- Payment confirmation (`POST /:slug/payment-confirm`) now clears `payment_token`

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
