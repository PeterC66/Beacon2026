# Beacon2 — Project Definition (Updated March 2026)

> **Note:** This document describes the *current* state of the project as of March 2026.
> Read it alongside `CLAUDE.md`, `CLAUDE-STANDARDS.md`, and `CLAUDE-REFERENCE.md` in the
> repository root, which contain coding conventions and implementation details.

---

## What this is

**Beacon2** is a modern full-stack web application replacing **Beacon** — the management
platform used by u3a organisations in the UK.

A **u3a** (always lowercase) is a community organisation for retired and semi-retired
people, offering learning and social activities. Each u3a has members, groups (activity
classes), a committee, finances, and so on.

Beacon2 is a ground-up rebuild with these goals:
- Modernise the codebase (maintainable, extensible, secure)
- Improve multi-tenancy architecture
- Replicate all Beacon functionality
- Support a small development team working in Claude Code

---

## What has been built (as of version 0.4.9)

### Infrastructure and platform
- Full multi-tenant architecture (PostgreSQL schema-per-tenant)
- Auth: JWT (access) + refresh token (httpOnly cookie), bcrypt password hashing
- Login by **username** (with email fallback for legacy users)
- Roles and Privileges: fully configurable per-u3a, seeded defaults on tenant creation
- System tier: separate system admin login, tenant CRUD, set-temp-password
- Auto-migrate and auto-seed on startup (`migrate.js`) — no shell access needed
- Redis session invalidation (disabled in POC; `USE_REDIS=false`)
- Deployed: backend on Render, frontend on Vercel, DB on Render PostgreSQL
- CI: GitHub Actions runs backend + frontend tests on every push to `claude/**` branches
- E2E: Playwright test suite against staging

### Membership module
- **Members list** — status/class/poll/letter/search filters; row selection; bulk actions
  (add to poll, send email); download (Excel/PDF/email CSV); sortable columns
- **Member record** — full edit: personal details, address (sharing/partner linking),
  phone/email/postcode validation, status, class, dates (DateInput), Gift Aid, partner
  linking (bidirectional, auto-shares address), poll tick boxes, groups & ledger tab
- **Add New Member** — dedicated form with auto-Current status, Gift Aid tickbox,
  default town/county/STD code pre-fill from system settings, postcode auto-uppercase,
  creates membership payment entry
- **Member classes** — CRUD; monthly fee grid when `fee_variation = 'varies_by_month'`;
  delete guard
- **Member statuses** — inline rename
- **Validate member data** — checks all members for issues; inline fix for most fields
- **Recent members** — list of recently joined/renewed members
- **Statistics** — per-class counts, status breakdown, group stats, renewal stats
- **Membership renewals** — period tabs, bulk renew with finance transactions
- **Non-renewals** — this year / long term modes; bulk lapse / delete
- **Membership cards** — card-printed tracking; radio-button filters (outstanding/poll/all);
  download PDF cards (85×54mm, 10 per A4, Code 128 barcode); blank cards PDF;
  Excel card data export; send card by email; mark-as-printed flow;
  advance expiry to next year option
- **Addresses export** — filtered download (Excel/CSV/TSV/TAM) + PDF label printing

### Groups module
- **Groups list** — sortable; create/edit/delete
- **Group record** — Details, Members, Schedule, Ledger tabs
- **Group members** — add/remove; mark leaders; waiting list with auto-enforcement
- **Group schedule** — single + recurring events; inline edit; bulk delete
- **Group ledger** — independent from finance; per-group in/out; download Excel
- **Venues** — CRUD; venue dropdown on group details
- **Faculties** — inline CRUD

### Finance module
- **Finance accounts** — CRUD, locked protection, active toggle, balance b/f,
  Group B/F tickbox (7.10.6 / 8.6)
- **Finance categories** — same pattern
- **Financial ledger** — account/category/group views; year selector; running balance;
  group view shows per-group B/F rows when enabled (7.10.6)
- **Transaction editor** — full form; category splits; cleared lock
- **Transfer money** — paired transactions with shared transfer_id
- **Credit batches** — group incoming transactions into batches for simpler
  reconciliation; create/view/delete batches; add/remove transactions; batches
  appear as single rows in reconciliation
- **Reconcile account** — mark transactions as cleared against statement;
  supports clearing whole batches in one tick
- **Financial statement** — per-account or all-accounts; year selector; download Excel;
  excludes pending transactions with warning banner
- **Groups statement** — per-group ledger summary; optional transactions; download
- **Pending transactions** — per-account config (disabled/optional/by_type); auto-pending
  on creation; bulk confirm/make-pending from ledger; excluded from running balance
  and financial statement
- **Refunds** (doc 7.10.7 / 8.6e) — per-account enable_refunds toggle; "Refund this
  transaction" nav link on eligible transactions; dedicated refund form with per-category
  amounts; reciprocal refund_of_id/refunded_by_id linking; financial statement nets
  refund amounts; ledger shows Refund column with linked transaction numbers; refund
  rows in red; date must be after original and in same financial year; blocks refund
  of cleared, transferred, or Gift-Aid-claimed transactions

### Gift Aid module
- **Gift Aid declaration** — financial-year filtered view of GA-eligible transactions;
  row selection; download Excel (HMRC column format); mark as claimed; send email
  with `#GIFTAID` and `#GIFTAIDLIST` tokens

### Email module
- **Email compose** — member selection, token substitution, attachments (SendGrid)
- **Standard messages** — CRUD templates
- **Email delivery** — batch list; per-recipient status; SendGrid Activity refresh
- **Email unblocker** — admin tool to remove from bounce/spam lists

### Set-up module
- **System settings** — all fields from Beacon doc 8.3
- **Roles and privileges** — full privilege matrix
- **System users** — CRUD, role assignment, username-based login
- **Polls** — CRUD; member list filter; bulk assign

### Online Joining and Portal module
- **Online joining** — public form for new members; class selection, personal details,
  address, Gift Aid consent; PayPal payment stub; creates member with Applicant status,
  promotes to Current on payment confirmation; finance transaction creation;
  confirmation email + officer notifications
- **Portal registration/login** — separate auth on members table; identity verification
  (memno + name + postcode); email verification flow; password reset flow
- **System messages** — admin page for editing auto-sent email templates (joining
  confirmation, officer notification); token substitution support
- **Public links** — admin page with online joining toggle, privacy policy URL,
  copyable public URLs, PayPal status indicator

### Calendar module
- **Calendar page** — chronological view of all group events + open meetings within date range
  (default: next 3 months); filters by all / member (search autocomplete) / venue / group;
  Show Detail toggle; clickable date/time → Group Schedule tab; clickable group/venue → record;
  Google Maps link for venues with postcode; Download PDF
- **Open Meetings** — events not tied to any group (group_id = NULL in group_events);
  add/edit/delete with recurrence support; same UI pattern as Group Schedule;
  controlled by `meetings` privilege resource

### Admin / Misc module
- **Audit log** — date-filtered view + delete-before-date; clickable When → Audit Record detail; clickable Record → entity view
- **Gift Aid log** — date-filtered view of Gift Aid consent given/withdrawn; member filter dropdown
- **u3a Officers** — CRUD; email sending; status-based styling
- **Personal preferences** — display prefs, change password, security Q&A, inactivity timeout
- **Data export & backup** — 8 export types (Excel); full restore (Beacon2 + Beacon format)
- **Validate member data** — comprehensive data quality tool

---

## Architecture

### Multi-tenancy

Every u3a gets its own PostgreSQL schema `u3a_{slug}`. All tenant queries go through
`tenantQuery()` or `withTenant()` in `backend/src/utils/db.js`.

### Auto-migration

`migrateTenantSchemas()` re-runs `tenant_schema.sql` against every active tenant on
startup. All DDL uses `IF NOT EXISTS`; seed INSERTs use `ON CONFLICT DO NOTHING`.

### Technology stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + Vite |
| UI styling | Tailwind CSS v3 |
| Backend | Node.js + Express |
| Database | PostgreSQL (Render) |
| ORM/query | Prisma (system tables) + `$queryRawUnsafe` (tenant tables) |
| Auth | JWT access (15 min, in-memory) + refresh token (30 days, httpOnly cookie) |
| Password | bcrypt, 12 rounds |
| Email | SendGrid |
| Excel | ExcelJS (read + write) |
| PDF | PDFKit (labels, member list download) |
| Testing | Vitest (unit), Playwright (E2E) |
| Deployment | Render (backend + DB), Vercel (frontend) |

### Project layout

```
backend/
  prisma/
    schema.prisma          # System schema: tenants, system_admins
    tenant_schema.sql      # Per-tenant DDL — idempotent, applied on every startup
  src/
    app.js                 # Express app, registers all routes
    server.js              # migrateAndSeed() then app.listen()
    middleware/             auth.js  requirePrivilege.js  errorHandler.js
    routes/                auth  users  roles  privileges  system  members
                           memberClasses  memberStatuses  groups  venues
                           faculties  settings  finance  polls  backup
                           addressExport  email  giftAid  systemMessages
                           publicLinks  public
    services/              authService
    utils/                 db  jwt  password  redis  migrate  audit  emailTokens  paypal
    seed/                  index  createTenant  privilegeResources  defaultRoles
    __tests__/             helpers  health  auth  users  roles  members  groups
                           finance  polls  (+ more)

frontend/
  src/
    App.jsx                # Router + ProtectedRoute
    lib/api.js             # All API calls; auto token refresh
    context/AuthContext.jsx # isLoggedIn, user, tenant, can(), logout
    components/            PageHeader  NavBar  SortableHeader  DateInput
    hooks/                 useSortedData  usePreferences  useUnsavedChanges
    pages/
      Login  Home
      admin/               MemberValidator  PollList
      finance/             FinanceAccounts  FinanceCategories  FinanceLedger
                           TransactionEditor  TransferMoney  ReconcileAccount
                           FinancialStatement  GroupsStatement  GiftAidDeclaration
      groups/              GroupList  GroupRecord
      members/             MemberList  MemberEditor  AddressesExport
      membership/          MemberClassList  MemberClassEditor  MemberStatusList
                           MembershipRenewals  NonRenewals
                           RecentMembers  Statistics
      misc/                AuditLog  AuditRecord  auditHelpers  GiftAidLog  OfficerList  DataBackup
                           PublicLinks
      roles/               RoleList  RoleEditor
      settings/            SystemSettings  PersonalPreferences  SystemMessages
      system/              SystemLogin  SystemDashboard
      users/               UserList  UserEditor
      email/               EmailCompose  EmailDelivery  EmailDeliveryDetail
                           EmailUnblocker
      public/              JoinForm  JoinComplete  PortalLogin  PortalRegister
                           PortalVerifyEmail  PortalForgotPassword  PortalResetPassword

e2e/                       Playwright E2E tests against staging
docs/
  BeaconUG/                Beacon User Guide pages (Markdown + images)
  FromBeacon/              Selected files from original Beacon codebase
```

---

## What still needs building

Greyed-out items in `Home.jsx` (i.e. `to: null`) are the remaining roadmap:

**Not yet started:**
- ~~Letters~~ (done — docs 6.2, 6.2.1, 6.2.2)
- Meetings
- ~~Membership cards~~ (done)
- ~~Calendar~~ (done)
- Data migration tool (standalone import from Beacon — restore already handles this)
- Members Portal — full self-service features (registration/login built; view/update details,
  renewal, group browsing still to do)

---

## Key decisions already made

- **No email login field on member record** — members log in via Members Portal (not yet built)
- **"Hide address from group leaders"** deprecated — replaced by per-group `show_addresses`
- **Calendar year** for finance ledger year filtering
- **Member search in TransactionEditor** — client-side filter, `<select size={4}>`
- **Postcode required** on member record (unless sharing a partner's address)
- **Username-based login** — lowercase alphanumeric; email fallback for legacy users

---

## User guide documentation

The Beacon User Guide has been transcribed into `docs/BeaconUG/`. Each subfolder
is one webpage, converted from PDF to Markdown with images preserved.

**Before using any folder**, check for unconverted PDFs — warn the user if found.
If docs for a feature don't exist, ask the user.
