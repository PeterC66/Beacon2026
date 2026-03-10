# Beacon2 Changelog

All notable changes are documented here.
Format: `## [version] — YYYY-MM-DD` with bullet points per change.

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
