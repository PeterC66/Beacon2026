# Beacon2 — Project Definition (Updated March 2026)

> **Note:** This document describes the *current* state of the project as of March 2026,
> not the original starting-point aspirations. Read it alongside `CLAUDE.md` in the
> repository root, which contains session-by-session implementation details and coding
> conventions that are equally important.

---

## What this is

**Beacon2** is a modern full-stack web application replacing **Beacon** — the management
platform used by u3a organisations in the UK.

A **u3a** (always lowercase; it used to stand for "university of the third age" but that
phrase is no longer used) is a community organisation for retired and semi-retired people,
offering learning and social activities. Each u3a has members, groups (activity classes),
a committee, finances, and so on.

Beacon2 is a ground-up rebuild with these goals:
- Modernise the codebase (maintainable, extensible, secure)
- Improve multi-tenancy architecture
- Replicate all Beacon functionality
- Support a small development team working in Claude Code

---

## What has been built (as of version 0.3.7)

### Infrastructure and platform
- Full multi-tenant architecture (PostgreSQL schema-per-tenant)
- Auth: JWT (access) + refresh token (httpOnly cookie), bcrypt password hashing
- Login by **username** (with email fallback for legacy users)
- Roles and Privileges: fully configurable per-u3a, seeded defaults on tenant creation
- System tier: separate system admin login, tenant CRUD
- Auto-migrate and auto-seed on startup (`migrate.js`) — no shell access needed
- Redis session invalidation (disabled in POC; `USE_REDIS=false`)
- Deployed: backend on Render, frontend on Vercel, DB on Render PostgreSQL

### Membership module
- **Members list** (`/members`) — status/class/poll/letter/search filters; row
  selection checkboxes; "Add to poll" bulk action; sortable columns
- **Member record** (`/members/:id`) — full edit form with:
  - Personal details, address (with address sharing / partner linking)
  - Phone/email validation (libphonenumber-js for GB numbers, UK postcode regex)
  - Status, class, dates (DateInput component — UK dd/mm/yyyy display, ISO storage)
  - Gift Aid
  - Partner linking: bidirectional, auto-shares address
  - Poll tick boxes (instant save)
  - Groups and ledger tab (read-only view)
- **Add New Member** (`/members/new`) — same form, creates membership payment entry
- **Member classes** (`/membership/classes`) — CRUD; optional monthly fee grid when
  `fee_variation = 'varies_by_month'`; delete guard (must make non-current first)
- **Member statuses** (`/membership/statuses`) — inline rename
- **Validate member data** (`/admin/validate-members`) — checks all members for missing/
  invalid postcode, email, phone, status, class, joined date; inline fix for most fields

### Groups module
- **Groups list** (`/groups`) — sortable; create/edit/delete
- **Group record** (`/groups/:id`) — Details tab and Members tab; add/remove members;
  mark leaders; waiting list

### Finance module
- **Finance accounts** (`/finance/accounts`) — CRUD, locked accounts protected, active toggle
- **Finance categories** (`/finance/categories`) — same pattern as accounts
- **Financial ledger** (`/finance/ledger?view=account|category|group`) — year selector,
  running balance in account view; all views sortable
- **Transaction editor** (`/finance/transactions/new`, `/finance/transactions/:id`) —
  full form per doc 7.2; category splits must sum to transaction total; cleared
  transactions locked from edit/delete
- **Configure account** (`/finance/accounts/:id/configure`) — account settings

### Set-up module
- **System settings** (`/settings`) — all fields from doc 8.3: membership cards,
  contact details, membership year/fees, gift aid, defaults, PayPal, member record options
- **Roles and privileges** (`/roles`, `/roles/:id`) — full privilege matrix matching
  Beacon doc 8.4; `Administration` role always gets all privileges
- **System users** (`/users`, `/users/:id`) — CRUD, role assignment, username-based login

### Polls module (doc 8.8)
- **Poll set-up** (`/polls`) — CRUD; member count; "clear all assignments"
- **Member list**: poll filter with "Negate poll" option; "Add to poll" bulk action
- **Member record**: poll tick boxes section; changes save instantly

---

## Architecture

### Multi-tenancy (most important principle)

Every u3a gets its own PostgreSQL schema, `u3a_{slug}` (e.g. `u3a_oxfordshire`). All
of that u3a's tables live inside their schema. A shared `public` schema holds system-
level tables (tenants, system admins).

**All tenant queries must go through `tenantQuery()` or `withTenant()` in
`backend/src/utils/db.js`.** Never use raw Prisma for tenant data. Never build SQL
with string concatenation.

The `search_path` is set to the correct tenant schema at the start of each request,
via the tenant slug embedded in the user's JWT.

### Auto-migration

`backend/src/utils/migrate.js` → `migrateTenantSchemas()` re-runs the full
`backend/prisma/tenant_schema.sql` against every active tenant on every server startup.

**Critical rules:**
- Every `CREATE TABLE`, `CREATE SEQUENCE`, `CREATE INDEX` must use `IF NOT EXISTS`
- `CREATE INDEX` must have an explicit name: `:schema_idx_<table>_<col>`
- Seed `INSERT`s use `ON CONFLICT DO NOTHING`
- No semicolons inside SQL comments (the migration splits on `;`)
- The DDL loop uses per-statement try/catch so one failure doesn't stop the rest

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
| Session invalidation | Redis (optional; currently disabled) |
| Testing | Vitest (backend + frontend), supertest, React Testing Library |
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
    middleware/
      auth.js              # requireAuth, requireSysAdmin
      requirePrivilege.js  # requirePrivilege(resource, action)
      errorHandler.js      # errorHandler + AppError(msg, status)
    routes/
      auth.js              # /auth/login, /logout, /refresh, /system/login
      users.js             # /users CRUD + role assignment
      roles.js             # /roles CRUD + PUT /roles/:id/privileges
      privileges.js        # GET /privileges/resources
      system.js            # GET/POST/PATCH /system/tenants
      memberClasses.js     # /member-classes CRUD + monthly fees
      memberStatuses.js    # /member-statuses CRUD
      members.js           # /members list + CRUD (includes poll_ids in GET /:id)
      faculties.js         # /faculties CRUD
      groups.js            # /groups CRUD + group members
      settings.js          # GET/PATCH /settings (singleton row)
      finance.js           # /finance/accounts, /categories, /transactions, /ledger
      polls.js             # /polls CRUD + /polls/:id/members + /polls/by-member/:id
    services/
      authService.js       # loginUser (username first, email fallback), refresh, logout
    utils/
      db.js                # tenantQuery(), withTenant(), Prisma singleton
      jwt.js               # signAccessToken, signRefreshToken, verify*
      password.js          # hashPassword, verifyPassword, generateToken
      redis.js             # Redis client + isSessionInvalidated
      migrate.js           # migrateTenantSchemas() + seedPrivilegeResources()
    seed/
      index.js             # First system admin on startup
      createTenant.js      # Full provisioning: schema + defaults + admin user
      privilegeResources.js # Complete privilege resource list (source of truth)
      defaultRoles.js      # 5 default roles + their default privilege sets
    __tests__/
      helpers.js           # makeAuthHeader(), ALL_PRIVS constant
      health.test.js
      auth.test.js
      users.test.js
      roles.test.js
      members.test.js
      groups.test.js
      finance.test.js
      polls.test.js

frontend/
  src/
    App.jsx                # Router + ProtectedRoute
    index.css              # @tailwind directives + background-image rule
    lib/
      api.js               # All API calls; auto token refresh; named exports per module
    context/
      AuthContext.jsx      # isLoggedIn, user, tenant, can(resource, action), logout
    components/
      PageHeader.jsx       # Logo + tenant name; imported by every page
      NavBar.jsx           # Glass nav bar with links
      SortableHeader.jsx   # <th> with sort indicator; use with useSortedData hook
      DateInput.jsx        # UK date input (dd/mm/yyyy display, ISO value)
    hooks/
      useSortedData.js     # useSortedData(data, defaultKey?, defaultDir?)
    pages/
      Login.jsx            # Tenant login (username or email)
      Home.jsx             # Main menu — 5 sections
      admin/
        MemberValidator.jsx  # /admin/validate-members
        PollList.jsx         # /polls (poll set-up)
      finance/
        FinanceAccounts.jsx   ConfigureAccount.jsx
        FinanceCategories.jsx
        FinanceLedger.jsx
        TransactionEditor.jsx
      groups/
        GroupList.jsx  GroupRecord.jsx
      members/
        MemberList.jsx  MemberEditor.jsx
      membership/
        MemberClassList.jsx  MemberClassEditor.jsx  MemberStatusList.jsx
      roles/
        RoleList.jsx  RoleEditor.jsx
      settings/
        SystemSettings.jsx
      system/
        SystemLogin.jsx  SystemDashboard.jsx
      users/
        UserList.jsx  UserEditor.jsx
  tailwind.config.js
  postcss.config.cjs       # .cjs because package.json has "type": "module"
  vite.config.js           # defines __APP_VERSION__ from package.json

docs/
  BeaconUG/                # User guide docs (PDF → Markdown per section)
  FromBeacon/              # Selected files from original Beacon codebase
```

---

## Roles and privileges

### Privilege model
- Users hold one or more **Roles**; effective privileges = union of all roles
- Privileges are `resource:action` strings (e.g. `poll_set_up:view`)
- Full privilege set is embedded in the JWT at login
- `requirePrivilege('resource', 'action')` on backend routes
- `can('resource', 'action')` in frontend (from AuthContext)

### Default roles (seeded per tenant)
| Role | Committee |
|------|-----------|
| Administration | No |
| Group Leaders | No |
| Groups Coordinator | No |
| Membership Secretary | Yes |
| Treasurer | Yes |

### Rule for new features
1. Add resource to `backend/src/seed/privilegeResources.js`
2. Grant to relevant roles in `backend/src/seed/defaultRoles.js`
3. Add to `ALL_PRIVS` in `backend/src/__tests__/helpers.js`
4. Use `requirePrivilege` on route, `can` in frontend

The migration system re-seeds privileges on every startup — existing tenants pick up
changes automatically.

### Currently implemented privilege resources (all from Beacon spec)
See `backend/src/seed/privilegeResources.js` for the full list. Beacon2-specific
additions beyond the original Beacon spec:

| Resource | Actions | Notes |
|----------|---------|-------|
| `member_data_validation` | `view`, `change` | Validate member data tool |

---

## Data model highlights

### Tenant schema key tables
(full DDL in `backend/prisma/tenant_schema.sql`)

| Table | Key columns |
|-------|-------------|
| `members` | id, membership_number (seq), forenames, surname, title, email, mobile, status_id, class_id, address_id, partner_id, joined_on, next_renewal, gift_aid_from, username |
| `addresses` | id, house_no, street, add_line1, add_line2, town, county, postcode, telephone |
| `member_statuses` | id, name |
| `member_classes` | id, name, fee, gift_aid_fee, is_current, is_associate, sort_order |
| `class_monthly_fees` | class_id, month_index (1-13), fee, gift_aid_fee |
| `groups` | id, name, status, faculty_id, show_addresses, day_of_week, start_time, end_time, venue, description |
| `group_members` | group_id, member_id, is_leader, waiting_since |
| `faculties` | id, name |
| `tenant_settings` | singleton row; all settings from doc 8.3 |
| `finance_accounts` | id, name, active, locked, sort_order |
| `finance_categories` | id, name, active, locked, sort_order |
| `transaction_number_seq` | sequential counter |
| `transactions` | id, transaction_number, account_id, date, type (in/out), amount, from_to, payment_method, cleared_at |
| `transaction_categories` | transaction_id, category_id, amount |
| `polls` | id, name, description, member_can_set |
| `poll_members` | poll_id, member_id |
| `users` | id, username, email, name, password_hash, is_active |
| `roles` | id, name, is_committee, notes |
| `user_roles` | user_id, role_id |
| `role_privileges` | role_id, resource_id, action |
| `privilege_resources` | id, code, label, actions (jsonb) |

### SQL and type casting
Prisma sends string parameters without PostgreSQL type OIDs. Add explicit casts for
non-text columns in `$queryRawUnsafe`:

```sql
$1::date   -- DATE columns (joined_on, next_renewal, gift_aid_from, cleared_at)
$2::time   -- TIME columns (start_time, end_time)
$3::numeric -- NUMERIC columns (fee, gift_aid_fee, amount)
```

`null::date` is valid, so casts are always safe.

---

## Frontend conventions

### Styling (Tailwind CSS v3 only)
No custom CSS classes. Key patterns:
- Input: `border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`
- Primary button: `bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors`
- Destructive button: `border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm`
- Table rows: `i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'` with `bg-slate-50` header
- Content cards: `bg-white/90 rounded-lg shadow-sm p-4 sm:p-6`

**Exception:** `RoleEditor.jsx` privilege matrix keeps Beacon-spec inline colours
(`#ffffcc`/`#f0f0f0` row backgrounds, `#0000cc` resource text, `#e08000` save button).

### Shared components
Always import these instead of duplicating:
- `PageHeader` — logo + tenant name; required on every page
- `NavBar` — navigation breadcrumb
- `SortableHeader` + `useSortedData` — sortable table columns
- `DateInput` — UK-format date picker (ISO internal value)

### API client (`frontend/src/lib/api.js`)
Named exports per module:
```js
import { members, memberStatuses, memberClasses, polls, finance, settings, ... } from '../../lib/api.js';
```
Access token is stored in memory (never localStorage). The client auto-refreshes tokens
on 401.

### Component definitions inside components
**Never define a component function inside another component.** This causes React to
treat it as a new type on every render, unmounting/remounting the subtree and losing
focus. If you need an inline row/form inside a list, either:
- Return JSX from a plain function (not called with `<Fn />`): `renderFormRow(key)`
- Extract to a top-level component (outside the parent function)

### Auth guard pattern
```jsx
{can('resource', 'action') && <button>...</button>}
// or in route definitions:
<Route path="/foo" element={<ProtectedRoute><FooPage /></ProtectedRoute>} />
```

---

## Testing

### Running tests
```bash
cd backend && npm test   # vitest --run
cd frontend && npm test  # vitest --run
```

Run after every code change. Fix failures before moving on.

### Backend test pattern
```js
vi.mock('../utils/db.js', () => ({ prisma: { $disconnect: vi.fn() }, tenantQuery: vi.fn(), withTenant: vi.fn() }));
vi.mock('../utils/redis.js', () => ({ isSessionInvalidated: vi.fn().mockResolvedValue(false), ... }));
tenantQuery.mockResolvedValueOnce([...]);  // mock each DB call in order
```
Use `makeAuthHeader()` from `helpers.js`. Use `makeAuthHeader({ privileges: [] })` for 403 tests.

`GET /members/:id` requires **two** `tenantQuery` mocks: the main member query, then the
`poll_ids` query.

### Frontend test pattern
```jsx
vi.mock('../lib/api.js', () => ({ members: { list: vi.fn().mockResolvedValue([]) }, ... }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ tenant: 'test', can: vi.fn().mockReturnValue(true) }) }));
render(<MemoryRouter><MyPage /></MemoryRouter>);
expect(getByText('Page Title')).toBeInTheDocument();
```

---

## Deployment

### Environment variables
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Render PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | 64-char random hex |
| `JWT_REFRESH_SECRET` | Different 64-char random hex |
| `SEED_ADMIN_EMAIL` | First system admin email |
| `SEED_ADMIN_PASSWORD` | First system admin password |
| `CORS_ORIGIN` | Vercel frontend URL (no trailing slash) |
| `USE_REDIS` | `"false"` for current POC |
| `NODE_ENV` | `"production"` on Render |
| `PORT` | `"3001"` |
| `BCRYPT_ROUNDS` | `"12"` |

### Versioning
Frontend version is in `frontend/package.json` → `"version"`. Bump before each
release commit. It is displayed in `PageHeader` top-right corner via `__APP_VERSION__`
Vite define.

---

## What still needs building

Greyed-out items in `Home.jsx` (i.e. `to: null`) are the remaining roadmap:

**Membership:**
- Membership renewals
- Recent members
- Non-renewals
- Membership cards
- Addresses export
- Statistics

**Groups:**
- Venues
- Faculties page (backend exists, no frontend page)
- Calendar

**Finance:**
- Transfer money
- Credit batches
- Reconcile account
- Financial statement
- Gift Aid declaration

**Misc:**
- Audit log
- Gift Aid log
- u3a Officers (doc 9.3)
- Public links
- Data export & backup
- Email delivery
- Personal preferences

**Set-up:**
- System messages

**Not yet started:**
- Email sending (compose, standard messages, delivery tracking)
- Letters & documents
- Meetings
- Data migration tool (import from Beacon)
- Members Portal (self-service for members)

---

## User guide documentation

The Beacon User Guide has been transcribed into `docs/BeaconUG/`. Each subfolder
is one webpage, converted from PDF to Markdown with images preserved.

**Available sections:**

| Folder | Contents |
|--------|---------|
| `2. Logging in as a System User` | System user login |
| `4. Membership` | Overview |
| `4.1 The Membership List` | Member list, filters, bulk actions |
| `4.2 Member Record` | Full member edit form |
| `4.3 Add New Member` | Add member form |
| `4.3.1 Addresses & Phone Numbers` | Address data |
| `4.3.2 Shared Addresses & Joint Members` | Partner linking |
| `5. Groups` | Overview |
| `5.1 Groups List` | Groups list |
| `5.2 Group Records: Details` | Group detail tab |
| `5.4 Group Record: Members` | Group members tab |
| `5.6 Adding & Removing Groups` | Create/delete groups |
| `7. Finance` | Overview |
| `7.1 Financial Ledger` | Ledger views |
| `7.2 Transaction Record` | Transaction form |
| `8. Set-Up Operations` | Section index |
| `8.2 System Users` | User management |
| `8.3 System Settings` | Settings form |
| `8.4 Roles and Privileges` | Role editor |
| `8.4.1 Privileges Map and default Privileges` | Privilege table |
| `8.6 Finance Set-up` | Accounts and categories |
| `8.7 Membership Set-up` | Classes and statuses |
| `8.8 Polls` | Poll set-up |
| `User Guide` | Top-level index |

**Before using a folder**, check it still contains PDF files (not yet transcribed).
If it does, ask the user to convert them first — do not attempt to interpret PDFs.

If you need docs for a feature not listed above, ask the user to supply them.

---

## Key decisions already made

- **No email login field on member record** — members log in via the Members Portal
  (not yet built), which is separate from the admin system
- **"Hide address from group leaders"** Beacon setting is deprecated and not included —
  replaced by per-group `show_addresses` column
- **Calendar year** (not financial year) for finance ledger year filtering
- **Member search in TransactionEditor** — loads all members, client-side filter,
  `<select size={4}>` list, not a combobox
- **Postcode required** on member record (unless sharing a partner's address)
- **Username-based login** — usernames are lowercase alphanumeric; email fallback for
  legacy users without a username set
