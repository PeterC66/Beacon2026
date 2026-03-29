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

## What has been built (as of version 0.7.14)

### Infrastructure and platform
- Full multi-tenant architecture (PostgreSQL schema-per-tenant)
- Auth: JWT (access) + refresh token (httpOnly cookie), bcrypt password hashing
- Login by **username** (with email fallback for legacy users)
- Roles and Privileges: fully configurable per-u3a, seeded defaults on tenant creation
- **Site Administrator** (doc 8.1): `is_site_admin` flag on user, ALL privileges implicit,
  cannot be deleted, shown prominently in user list
- **System Users** (doc 8.2): user ↔ member link (`member_id` FK), create user from
  member dropdown, auto-generated temp password, set-temp-password per user,
  user list with Select/Full Name/Login User Name/Member/Site Admin/Date Created/
  Last Accessed/Roles columns, Send Email to selected users (doc 8.2.1)
- **Password recovery** (doc 9.6): inline recovery on login page — identify user by
  forename/surname/postcode/email matched against linked member; security Q&A
  verification (skipped if not set); sends email with username + new temp password;
  blocked for site administrators
- **Temporary passwords** (doc 9.7): `must_change_password` flag enforced on login;
  set automatically on user creation and set-temp-password
- **Force change password** (doc 4): dedicated `/change-password` route; requires
  new password (min 10 chars, no spaces, upper+lower+number) plus security Q&A;
  blocks all other navigation until completed
- System tier: separate system admin login, tenant CRUD, set-temp-password
- Auto-migrate and auto-seed on startup (`migrate.js`) — no shell access needed
- Redis session invalidation (disabled in POC; `USE_REDIS=false`)
- Deployed: backend on Render, frontend on Vercel, DB on Render PostgreSQL
- CI: GitHub Actions runs backend + frontend tests on every push to `claude/**` branches
- E2E: Playwright test suite against staging
- **Cookie consent** — GDPR-compliant dialog on first visit; optional cookies
  (`beacon_last_u3a`, localStorage preferences) gated behind user consent;
  gear icon to reopen dialog; essential cookies (refresh token, consent choice)
  always allowed

### Membership module
- **Members list** — status/class/poll/letter/search filters; row selection; bulk actions
  (add to poll, send email); download (Excel/PDF/email CSV); sortable columns
- **Member record** — full edit: personal details, address (sharing/partner linking),
  phone/email/postcode validation, status, class, dates (DateInput), Gift Aid, partner
  linking (bidirectional, auto-shares address), poll tick boxes, groups & ledger tab,
  **photo upload** (jpg/png/gif, max 2 MB, displayed on membership cards and group PDFs)
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
- **Group members** — add/remove; mark leaders; waiting list with auto-enforcement;
  bulk actions (send email, download Excel/PDF, remove members, add to another group)
- **Group schedule** — single + recurring events; inline edit; bulk delete
- **Group ledger** — independent from finance; per-group in/out; download Excel
- **Venues** — CRUD; venue dropdown on group details
- **Faculties** — inline CRUD
- **SiteWorks integration** — tenant-wide "SiteWorks Activated" toggle in System Settings;
  when enabled, hides Schedule tab and scheduling/venue fields (When, Start time, End time,
  Venue, Enquiries, Information) from Group record; data preserved in DB

### Finance module
- **Finance accounts** — CRUD, locked protection, active toggle, balance b/f,
  Group B/F tickbox (7.10.6 / 8.6); Membership Payment Method Defaults page
  (doc 8.6c) — default payment method and per-type default account; auto-populates
  MemberEditor and MembershipRenewals; auto-switches account on method change
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

### Letters module
- **Letter compose** (docs 6.2, 6.2.1, 6.2.2) — compose letters with member selection,
  token substitution, print/download PDF

### Set-up module
- **System settings** — all fields from Beacon doc 8.3
- **Roles and privileges** — full privilege matrix
- **System users** — CRUD, role assignment, username-based login
- **Polls** — CRUD; member list filter; bulk assign
- **Custom fields** — define up to 4 free-form fields on member records

### Online Joining and Portal module
- **Online joining** — public form for new members; class selection, personal details,
  address, Gift Aid consent; PayPal payment stub; creates member with Applicant status,
  promotes to Current on payment confirmation; finance transaction creation;
  confirmation email + officer notifications
- **Portal registration/login** — separate auth on members table; identity verification
  (memno + name + postcode); email verification flow; password reset flow
- **Portal home** (doc 10.2) — dashboard after login showing available features based on
  portal_config; greeting with member name and membership expiry
- **Portal groups** (doc 10.2.2) — view all active groups with membership status (MEMBER/
  WAITING badges); expand to see When/Venue/Contact/Information (controlled by
  group_info_config); Join group / Leave group with confirmation dialogs; group leader
  notification (stubbed); waiting list support when group is full
- **Portal calendar** (doc 10.2.3) — calendar view with filters: All / specific Group /
  Own groups and general meetings; date range from now to end of year; column visibility
  controlled by calendar_config; Download PDF button (when enabled)
- **Portal personal details** (doc 10.2.4) — edit personal details (title, name, known as,
  suffix, initials, mobile, email, emergency contact, hide contact from leaders) and
  address; change password; email change triggers re-verification; confirmation email
  via system_messages template; **photo upload** (jpg/png/gif, max 2 MB, base64 storage)
- **Portal replacement card** (doc 10.2.5) — request replacement membership card by email;
  validates Current status and within renewal period; uses card_replacement_confirm
  system message template; marks card as not printed
- **System messages** — admin page for editing auto-sent email templates (joining
  confirmation, officer notification, portal details updated); token substitution support
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
- **Utilities** — administrative utilities page

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
                           publicLinks  public  portal  calendar  letters
                           membershipCards  officers  customFields  audit
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
                           CookieConsent  HelpWidget  ScrollButtons  RequiredMark
    hooks/                 useSortedData  usePreferences  useUnsavedChanges
                           useCookieConsent
    pages/
      Login  Home  ChangePassword
      admin/               MemberValidator  PollList  Utilities
      finance/             FinanceAccounts  FinanceCategories  FinanceLedger
                           TransactionEditor  TransactionRefund  TransferMoney
                           CreditBatches  ReconcileAccount  ConfigureAccount
                           FinancialStatement  GroupsStatement  GiftAidDeclaration
                           PaymentMethodDefaults
      groups/              GroupList  GroupRecord  Calendar  OpenMeetings
                           VenueList  VenueEditor  FacultyList
      members/             MemberList  MemberEditor  MemberCompactView
                           AddressesExport  MemberStatistics  RecentMembers
      membership/          MemberClassList  MemberClassEditor  MemberStatusList
                           MembershipRenewals  MembershipCards  NonRenewals
      misc/                AuditLog  AuditRecord  GiftAidLog  OfficerList  DataBackup
                           PublicLinks
      letters/             LetterCompose
      roles/               RoleList  RoleEditor
      settings/            SystemSettings  PersonalPreferences  SystemMessages
                           CustomFields
      system/              SystemLogin  SystemDashboard
      users/               UserList  UserEditor
      email/               EmailCompose  EmailDelivery  EmailDeliveryDetail
                           EmailUnblocker
      public/              JoinForm  JoinComplete  JoinPending  ResumePayment
                           PortalLogin  PortalRegister  PortalVerifyEmail
                           PortalForgotPassword  PortalResetPassword  PortalHome
                           PortalGroups  PortalCalendar  PortalPersonalDetails
                           PortalRequestCard

e2e/                       Playwright E2E tests against staging
docs/
  Beacon2UG/               Beacon2 User Guide (64 sections + index, Markdown)
  BeaconUG/                Beacon User Guide pages (Markdown + images)
  FromBeacon/              Selected files from original Beacon codebase
```

---

## What still needs building

Greyed-out items in `Home.jsx` (i.e. `to: null`) are the remaining roadmap:

**Not yet built:**
- Public groups list page (public-facing, unauthenticated — URLs shown on Public Links page)
- Public calendar page (public-facing, unauthenticated — URLs shown on Public Links page)

**Partially complete:**
- Members Portal — online renewals (doc 10.2.1) still to do
- Data migration tool (standalone import from Beacon — restore already handles this)

**Previously listed, now done:**
- ~~Letters~~ (done — docs 6.2, 6.2.1, 6.2.2)
- ~~Membership cards~~ (done)
- ~~Calendar~~ (done)
- ~~Open Meetings~~ (done — accessible via Calendar page)
- ~~Portal photo upload~~ (done)

---

## Key decisions already made

- **No email login field on member record** — members log in via Members Portal
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

The **Beacon2 User Guide** lives in `docs/Beacon2UG/` — 64 sections organised
around Beacon2's actual navigation (not the original Beacon numbering). Currently
at outline level with screenshot placeholders. See `docs/Beacon2UG/index.md` for
the full table of contents.
If docs for a feature don't exist, ask the user.
