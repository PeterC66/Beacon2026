# Beacon2 Changelog

All notable changes are documented here.
Format: `## [version] — YYYY-MM-DD` with bullet points per change.

---

## [0.7.17] — 2026-03-30

### Changed
- **Member record** — renamed "Home u3a" label to "Home u3a and member no." for Associate members
- **Member record** — address section now shows "Address record created …; last changed …" timestamp note below the address fields
- **Members list** — consolidated surname/forenames/known-as into a single "Name" column
  formatted as "forenames (known as) surname", respecting display preference
- **Members list** — member number and name are both clickable links to the member record;
  removed the separate "Edit" link
- **Members list** — removed email column; added separate Telephone and Mobile columns
- **Members list** — moved Class column before Status
- **Members list** — Name column sortable by forenames; "by surname" link sorts by
  surname then forenames; default sort is by surname with visible indicator
- **`formatMemberName()`** — now includes `(known_as)` when present, in both display formats
- **`useSortedData`** — supports compound sort keys (array of field names) for multi-field sorting
- Backend member list query now returns `telephone` from the address table

### Added
- **No-email icon** — members without an email address now show a small struck-through
  envelope icon next to their checkbox on all member list pages (Members, Recent Members,
  Non-Renewals, Membership Renewals, Membership Cards)
- New shared `NoEmailIcon` component (`frontend/src/components/NoEmailIcon.jsx`)
- **Recent Members** — consolidated name using `formatMemberName()`, added Name/by surname
  sort options, member number now a clickable link
- **Non-Renewals** — consolidated name, Name/by surname sorting, removed email column and
  Edit link, added Address, Phone, and Last Renewal (year) columns; backend query now
  includes address fields, telephone, known_as, and last renewal year from transactions
- **Membership Renewals** — added `useSortedData` sorting (default: surname+forenames),
  Name/by surname sort headers, consolidated name with `formatMemberName()`, member number
  now a clickable link
- **Membership Cards** — consolidated name, removed email/town/postcode columns, added
  short address column, Name/by surname sorting, default sort by surname, member number
  now a clickable link
- **Overdue subscription highlighting** — member number and name shown in red on all
  member list pages (except Non-Renewals) when `next_renewal` is in the past
- New shared `isSubscriptionOverdue()` helper in `memberFormatters.js`
- Backend Recent Members query now returns `next_renewal`
- **Group record** — "Group record created …; last changed …" timestamp at the bottom
  of the Details tab
- New shared `RecordTimestamp` component — standard display for record created/changed
  timestamps; MemberEditor refactored to use it

---

## [0.7.16] — 2026-03-29

### Added
- Group members bulk actions ("Do with selected") — unified dropdown with:
  Send email, Download Excel, Download PDF, Remove members, Add to another group
- Backend endpoints for bulk remove (`DELETE /groups/:id/members/bulk`) and
  bulk add-to-group (`POST /groups/:id/members/bulk-add`) with waiting-list support
- Backend tests for both new endpoints (6 new tests)
- **Recent Members** — full "Do with selected" bulk actions: Download names as txt,
  Send E-mail, Send Letter, Add to poll, Add to group, Download Excel, Download PDF
- **Members list** — "Add to group" bulk action: select members and add them to a
  chosen group, respecting max-members and waiting-list logic
- **Groups list** — row selection with checkboxes and "Do with selected" bulk actions:
  - "Send email to leaders" — emails all leaders of the selected groups
  - "Download Excel" / "Download PDF" — download group data with field selection
  - "Add members to poll" — adds all members of selected groups to a chosen poll
- Backend `POST /groups/:id/members/bulk` endpoint for bulk adding members to a group
- Backend `GET /groups/download` endpoint for downloading groups list as Excel/PDF
### Changed
- Add New Member: hide Joined date field (auto-filled behind the scenes)
- Add New Member: hide Send email button (member not yet saved)
- Add New Member: moved Emergency contact above Notes
- Add New Member: overpayment now shown as highlighted blue banner ("£X will be put to donations")
- Add New Member: underpayment now shown as highlighted amber banner ("£X more needed to become a member")
- Standardised selection/bulk-action layout across list pages: selection quick-picks
  above table, "Do with selected" below table (MembershipRenewals, RecentMembers,
  NonRenewals updated to match MemberList/GroupList/MembershipCards pattern)
- Membership Renewals, Recent Members, and Non-renewals: added 7 selection quick-picks
  (All, Clear All, Email only, Without email, Portal password set, Without portal
  password, Email not confirmed)
- Non-renewals: replaced standalone Lapse/Delete buttons with "Do with selected"
  dropdown including Lapse/Delete, Send email, and Send letter options

---

## [0.7.15] — 2026-03-28

### Added
- Beacon2 User Guide (`docs/Beacon2UG/`) — 64 sections covering all modules,
  structured around Beacon2's actual navigation. Outline-level content with
  screenshot placeholders, ready to be fleshed out and have screenshots added.

---

## [0.7.14] — 2026-03-28

### Added
- 7 new E2E spec files (12–18) covering all previously untested areas:
  Calendar, Open Meetings, Transfer Money, Reconcile Account, Financial Statement,
  Groups Statement, Credit Batches, Recent Members, Statistics, Membership Renewals,
  Non-renewals, Membership Cards, Addresses Export, Gift Aid Declaration, Gift Aid Log,
  Email Compose/Delivery/Unblocker, Polls, System Messages, Public Links, Custom Fields,
  Letters, and Utilities (~40 new tests total)
- E2E deferred items documented in `KNOWN-ISSUES.md` (8 items: email send, download
  content verification, portal flow, online joining, password recovery, data restore,
  membership renewals bulk, credit batch full workflow)

### Changed
- Comprehensive review and update of `Beacon2 Project Definition.md`:
  - Updated version reference from 0.7.10 to 0.7.14
  - Added missing features to "What has been built": Letters module, Custom fields,
    Utilities page
  - Updated project layout tree with ~30 missing files (routes, pages, components, hooks)
  - Rewrote "What still needs building" to accurately reflect only 2 unbuilt items
    (public groups list + public calendar pages) plus 2 partial items
  - Fixed outdated reference to Members Portal as "not yet built"
  - Added portal pages (PortalHome, PortalGroups, PortalCalendar, etc.) to layout tree
- Comprehensive review and update of `CLAUDE-REFERENCE.md`:
  - Fixed duplicate section numbering (§14, §16, §19 each appeared twice); renumbered to §1–§24
  - Updated outdated deferred items: portal replacement card is built, portal features are built
  - Added 7 missing portal pages to frontend pages table + documented `portalApi` methods
  - Fixed Cookie Consent section (all 8 items implemented, removed stale "deferred" reference)
  - Added missing localStorage key `beacon2_tam_submission`
  - Added new sections: §22 Custom Fields, §23 Gift Aid Log
  - Added missing shared components: BeaconLogo, GoToMemberButton
- Added test coverage inventory to `CLAUDE-E2E.md`: catalog of all 11 spec files,
  7 page objects, and 20 areas without E2E coverage yet
- Updated `KNOWN-ISSUES.md` — marked portal photo upload and migration DDL warning
  as resolved

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
- **Drag-and-drop photo upload** — both Member Editor and Portal personal details
  support drag-and-drop as well as click-to-browse for photo uploads, with visual
  feedback (blue border highlight) during drag
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
