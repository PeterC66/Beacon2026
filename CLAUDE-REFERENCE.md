# Beacon2 — Implementation Reference

**This file contains detailed implementation notes organised by module.**
Read `CLAUDE-STANDARDS.md` first for the cross-cutting checklist that applies to all work.

> Sections are grouped by functional area, not by date. Each section documents
> the data model, backend routes, frontend pages, and gotchas for that module.

---

## 1. Multi-tenancy and schema migrations

### Schema-per-tenant

Every u3a gets its own PostgreSQL schema `u3a_{slug}`. All tenant queries go through
`tenantQuery()` or `withTenant()` in `backend/src/utils/db.js`. The `search_path` is
set per-request from the tenant slug in the JWT.

### Auto-migration (`migrate.js`)

`migrateTenantSchemas()` re-runs `backend/prisma/tenant_schema.sql` against every
active tenant on every server startup.

**Rules:**
1. `CREATE TABLE/SEQUENCE/INDEX` must use `IF NOT EXISTS`
2. `CREATE INDEX` must have explicit names: `:schema_idx_<table>_<col>`
3. Seed `INSERT`s use `ON CONFLICT DO NOTHING` (or `WHERE NOT EXISTS`)
4. DDL loop has per-statement try/catch
5. **No semicolons in SQL comments** — migration splits on `;`

After DDL, the migration also re-seeds privilege resources and calls
`syncDefaultRolePrivileges()` to additively grant any newly-defined privileges
to the default roles (Administration, etc.). This means adding a new privilege
resource and granting it in `defaultRoles.js` is all that's needed — existing
tenants pick it up on next server restart.

### Diagnosing "unexpected error"

Check server logs for `[timestamp] METHOD /path: Error: ...`. Common causes:
- `relation "u3a_xxx.some_table" does not exist` — table missing
- `function nextval(...)` error — sequence missing
- FK violation — status_id/class_id not in referenced table

---

## 2. Authentication and users

### Username-based login

Users log in with a **username** (lowercase letters + numbers only, e.g. `jbloggs`).
`POST /auth/login` accepts `{ tenantSlug, username, password }`.

**Email fallback**: `authService.loginUser()` first looks up by `username`, then falls
back to `email` if no match. This allows transition for users without a username set.

**Validation**: Zod schema `z.string().regex(/^[a-z0-9]+$/)`. Frontend auto-lowercases
and strips invalid chars.

### Token architecture

- Access token: 15 min, stored in memory only (never localStorage/sessionStorage)
- Refresh token: 30 days, httpOnly cookie
- Privileges embedded in JWT at login
- `api.js` auto-refreshes on 401

### Session invalidation

Redis-based (optional, `USE_REDIS=false` for current POC). Role changes invalidate
affected sessions via Redis, or expire naturally after 15 min.

### Personal Preferences (doc 9.1)

- Frontend only: `PersonalPreferences.jsx` at `/preferences`
- Always visible (no privilege gate)
- Three sections: display prefs + inactivity timeout, change password, security Q&A
- Display prefs in `localStorage` via `usePreferences.js` (key `beacon2_prefs`)
  - `getPreferences()` — snapshot (not reactive)
  - `savePreferences(updates)` — merges partial updates
  - `formatMemberName(member)` — respects `displayFormat` setting
- Inactivity timeout: `AuthContext` `useRef` timer, resets on user interaction,
  dispatches `auth:expired`
- Change password: `PATCH /auth/change-password`; 5-bar strength meter
- Security Q&A: `GET /auth/qa` + `PATCH /auth/qa` (hashed answer)

### Delete-last-admin guard

`DELETE /users/:id` checks if target is last Administration role holder → 400 if so.

### New tenant: adminUsername required

`createTenantSchema()` requires `adminUsername` (lowercase alphanumeric).

---

## 3. Prisma and PostgreSQL patterns

### Type casting in `$queryRawUnsafe`

Prisma sends string params without PostgreSQL type OIDs. Add explicit casts:

| Column type | Cast | Examples |
|-------------|------|----------|
| DATE | `::date` | `joined_on`, `next_renewal`, `gift_aid_from`, `cleared_at` |
| TIME | `::time` | `start_time`, `end_time` |
| NUMERIC | `::numeric` | `fee`, `gift_aid_fee`, `amount` |

`null::date` is valid — casts are always safe.

### DATE/TIME columns return JavaScript Date objects

`$queryRawUnsafe` returns DATE columns as ISO-8601 timestamps (`2026-03-26T00:00:00.000Z`).

- **Display**: normalise with `.slice(0, 10)` before splitting on `-`
- **Form fields**: set value to `String(d).slice(0, 10)`
- **Time columns**: already plain strings; `.slice(0, 5)` for display

```js
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}
```

---

## 4. System settings (doc 8.3)

### Data model

`tenant_settings` — single-row table (`CHECK (id = 'singleton')`). Auto-inserted by
`tenant_schema.sql` via `INSERT … ON CONFLICT (id) DO NOTHING`.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| `card_colour` | TEXT | Hex colour for membership cards |
| `email_cards` | BOOLEAN | Attach cards to online join/renew emails |
| `public_phone`, `public_email` | TEXT | Public enquiry contact details |
| `home_page` | TEXT | u3a website URL |
| `online_join_email`, `online_renew_email` | TEXT | Online service enquiry emails |
| `fee_variation` | TEXT | `'same_all_year'` or `'varies_by_month'` |
| `extended_membership_month` | INTEGER (1–12) | Month new memberships include next year |
| `advance_renewals_weeks` | INTEGER | Weeks before year-start renewals open |
| `grace_lapse_weeks` | INTEGER | Weeks after year-start before members lapse |
| `deletion_years` | INTEGER (2–7) | Years before long-term lapsed can be bulk-deleted |
| `default_payment_method` | TEXT | Cash/Cheque/Standing Order/Direct Debit/Online/Other |
| `gift_aid_enabled` | BOOLEAN | Enable Gift Aid claims |
| `gift_aid_online_renewals` | BOOLEAN | Gift Aid tick boxes for online renewals |
| `default_town`, `default_county`, `default_std_code` | TEXT | Pre-filled on new member |
| `paypal_email`, `paypal_cancel_url` | TEXT | PayPal integration (future) |
| `shared_address_warning` | BOOLEAN | Warn if shared-address members differ |
| `year_start_month` | INTEGER | Membership year start month (default 1) |
| `year_start_day` | INTEGER | Membership year start day (default 1) |

"Hide Address from group leaders" is **deprecated** — replaced by per-group `show_addresses`.

### API

- `GET /settings` — requires `settings:view`
- `PATCH /settings` — requires `settings:change`

### Test note

"System Settings" appears in NavBar breadcrumb AND `<h1>` → use `getAllByText`.

---

## 5. Members module

### Shared address and partner linking

Two members can share a single `addresses` row (both `address_id` → same record).
`partner_id` is a separate bi-directional link on `members`.

**`address_shared` flag**: `GET /members/:id` returns `address_shared: boolean` — true
when partner exists AND both have the same `address_id`. Computed in SQL:
```sql
(p.id IS NOT NULL AND p.address_id = m.address_id) AS address_shared
```

**Editing shared address (`addressScope`)**: Frontend asks "for both or just me?" and
sends `addressScope: 'both' | 'me-only'`:
- `'both'` — update the shared row in place
- `'me-only'` — INSERT new row, link only this member

**Changing partner (PATCH side-effects)**:
1. Validate `newPartnerId !== memberId`
2. Look up Y's `address_id` → set `data._newAddressId`
3. Set bi-directional link (X→Y, Y→X)
4. Clear old partner Z if Z ≠ Y
5. Skip applying `data.address` (linking takes precedence)
6. Clean up orphaned address row if no other member references it

Frontend: `partnerChanged` flag → fetches new partner, greys out address fields,
omits `address` from PATCH body.

### Phone and postcode validation

**Phone**: `libphonenumber-js` in frontend. `isValidPhoneNumber(value, 'GB')`.
Guard empty values: `if (!value || !value.trim()) return null`.

**Postcode**: regex `UK_POSTCODE_RE`:
```js
const UK_POSTCODE_RE = /^(GIR\s?0AA|[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2})$/i;
```

**When sharing address**: skip ALL postcode validation (not just "required" check).

### Member classes — varying fees by month

`class_monthly_fees` table: 13 rows per class (month_index 1-12 = Jan-Dec, 13 = Renewals).
- Routes: `GET` and `PUT /member-classes/:id/monthly-fees`
- Frontend: monthly fee grid in `MemberClassEditor` when `fee_variation = 'varies_by_month'`
- Auto-propagate: typing a fee copies to all subsequent months when checkbox ticked
- When `varies_by_month`, the single `fee`/`gift_aid_fee` fields are hidden
- Delete guard: 409 with "N members are assigned" if any members use the class

### Member data validator (doc admin)

- Route: `GET /members/validate` — requires `settings:view` — **must stay above `GET /:id`**
- Page: `MemberValidator.jsx` at `/admin/validate-members`
- Checks: postcode (required + format), email (format if present), mobile/telephone
  (format if present), status_id, class_id, joined_on (must not be null)
- Inline fix for postcode/email/mobile/telephone; link to edit record for status/class/joined
- "Re-check now" re-fetches; green banner when all valid

**Extending**: add check to `getIssues()` in `MemberValidator.jsx`. If field is on address
table, ensure SQL select returns it. Inline-editable fields need a `saveField()` branch.

### Recent Members and Statistics (docs 4.4, 4.9)

**Year start**: `tenant_settings.year_start_month` + `year_start_day`. Statistics backend
computes current year start — if month/day is future, use last year.

**`GET /members/statistics`** returns 6 parallel queries: settings, classStats,
statusCounts, groupStats, notInGroup, renewStats. Current = `status ILIKE '%Current%'`;
lapsed = `ILIKE '%Lapsed%'`.

**Route ordering**: `GET /members/recent` and `/statistics` must be **above** `GET /:id`.

### Membership Renewals and Non-renewals (docs 4.5, 4.6)

**Routes** (all above `GET /members/validate`):
- `GET /members/renewals` — `membership_renewals:view`
- `POST /members/renew` — `membership_renewals:renew` (bulk renew + finance transactions)
- `GET /members/non-renewals?mode=this_year|long_term` — `members_non_renewals:view`
- `POST /members/lapse` — `members_non_renewals:lapse`

**Finance transactions in `/renew`**: inserted directly via SQL (bypassing finance route
which requires categories). Users can categorize later.

**Year boundaries**: computed in JavaScript from `year_start_month`/`day` settings.
`showNextYear` = within `advance_renewals_weeks` of next year.

**Lapse**: `UPDATE ... WHERE id = ANY($2::text[])`. Finds Lapsed status via
`WHERE name ILIKE '%Lapsed%'`.

### Addresses Export and Label Printing (docs 4.8, 4.8.1)

- Backend: `addressExport.js` at `/address-export`
- Frontend: `AddressesExport.jsx` at `/addresses-export`
- Privileges: `addresses_export` (view/download) and `address_labels` (download)
- Filters: status, classId, pollId, negatePoll, groupId
- Label PDF: PDFKit, A4, mm→points (`72/25.4`), partner combining, multi-page
- Label settings saved in `localStorage` key `beacon2_label_settings`

### Member list — select, email, download

- Selection: `useState(new Set())`, select controls (All/Clear/Email only/Without email)
- Bulk actions: Send Email (stores IDs in `sessionStorage.emailComposeMemberIds`)
- Download field picker (checkboxes before download)
- `GET /members/download?format=excel|pdf|email-csv&ids=...&fields=...`

### MemberEditor — email button

- "Send email" button shown beside the Email field when the member has an email
  address and the user has `email:send` privilege
- Uses the same `sessionStorage.emailComposeMemberIds` pattern as the member list

---

## 6. Groups module

### Group record tabs

`GroupRecord.jsx` at `/groups/:id` — Details tab, Members tab, Schedule tab, Ledger tab.

### Venues (doc 5.7)

- DB: `venues` table — all optional except `name`; `private_address`, `accessible` booleans
- Backend: `venues.js` at `/venues`; privilege `group_venues`
- Frontend: `VenueList.jsx`, `VenueEditor.jsx`
- Groups have `venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL`

### Faculties (doc 5.8)

- Backend: `faculties.js` — CRUD
- Frontend: `FacultyList.jsx` at `/faculties` — inline edit (Edit → input + Save/Cancel)

### Group Schedule (doc 5.3)

- DB: `group_events` — FK to groups, optional FK to venues, `is_private` boolean
- Backend: sub-resource `/groups/:id/events` in `groups.js`
  - `POST` — single or recurring (repeatEvery + repeatUnit + repeatUntil)
  - `DELETE` — bulk delete with body `{ ids }`
- Table columns: Select | Date & Time | Until | Venue | Topic | Enquiries
- `topic` is short subject; `details` shown as sub-row (controlled by "Show Detail" checkbox)
- Time inputs: `step="900"` (15-minute intervals)

### Waiting List (doc 5.10)

- `PATCH /groups/:id/members/:memberId` accepts `{ waitingSince: null }` to promote
- Frontend: filter checkboxes (Joined/Waiting) when any waiting members exist
- **Max-members enforcement**: `POST /groups/:id/members` auto-adds to waiting list
  when `enable_waiting_list && max_members !== null && joined_count >= max_members`

### Group Ledger (doc 5.5)

Entirely independent from the Finance Ledger.

- DB: `group_ledger_entries` — `entry_date`, `payee`, `detail`, `money_in`, `money_out`
- Routes in `groups.js`: `GET/POST/PATCH/DELETE /:id/ledger` + `GET /:id/ledger/download`
- Access: `hasLedgerAccess(req, groupId, action)` — checks `group_ledger_all:action` OR
  (`group_ledger_as_leader:action` AND user is leader of that group)
- `GET /ledger` returns `{ broughtForward, entries }` — b/f is net balance before `from` date
- Frontend: `GroupLedger` defined as **top-level function** in `GroupRecord.jsx` (not nested)
- Download: ExcelJS with running balance column
- Privileges: `group_ledger_all` (Admin + Groups Co-ordinator), `group_ledger_as_leader` (Group Leader)

### Group Members — download and email

- `GET /groups/:id/members/download?format=excel|pdf&ids=...&fields=...`
- Download field picker, same pattern as MemberList
- Checkboxes + Send Email button (stores member IDs in sessionStorage)

---

## 7. Finance module

### DB tables

All in `tenant_schema.sql` (idempotent):

| Table | Notes |
|-------|-------|
| `finance_accounts` | `active`, `locked`, `sort_order`, `balance_brought_forward` |
| `finance_categories` | same pattern as accounts |
| `transaction_number_seq` | sequential integer |
| `transactions` | `type IN ('in','out')`, `amount >= 0`, `cleared_at DATE`, `transfer_id TEXT`, `pending BOOLEAN` |
| `transaction_categories` | splits; `SUM(amount)` must equal `transactions.amount` |

### Backend routes (`finance.js`)

| Route | Privilege |
|-------|-----------|
| `GET/POST/PATCH/DELETE /finance/accounts` | `finance_accounts:*` |
| `GET/POST/PATCH/DELETE /finance/categories` | `finance_categories:*` |
| `GET /finance/transactions` (ledger query) | `finance_ledger:view` |
| `PATCH /finance/transactions/bulk-pending` | `finance_transactions:change` |
| `GET/POST/PATCH/DELETE /finance/transactions/:id` | `finance_transactions:*` |

**Rules enforced server-side:**
- Locked accounts/categories: cannot change name or delete
- Cleared transactions (`cleared_at IS NOT NULL`): cannot PATCH or DELETE
- Category sum mismatch: 400 if `|SUM - total| > 0.001`
- Transactions with `transfer_id`: cannot PATCH/DELETE via `/transactions` routes

### Frontend pages

- `FinanceAccounts.jsx` — inline rename, active toggle, balance b/f editable inline
- `FinanceCategories.jsx` — same pattern
- `FinanceLedger.jsx` — year selector, running balance (account view only)
- `TransactionEditor.jsx` — full form; member search (client-side, first 50, `<select size={4}>`)

### Finance ledger design decisions

- Calendar year (Jan 1–Dec 31) for year filtering
- Running balance: client-side `useMemo`, meaningful only in account view sorted by date asc
- **Opening balance (BF)**: when viewing by account, backend returns
  `{ transactions, openingBalance }` instead of a plain array.
  `openingBalance = balance_brought_forward + net of all prior-year transactions`.
  Frontend shows a "Balance brought forward" row at the top of the table.
- **Locked accounts** can still have `balance_brought_forward` edited; only
  name/active/sort_order are blocked by the lock check
- **Group B/F (doc 7.10.6 / 8.6)**: a global `group_bf_enabled` boolean in
  `tenant_settings` controls whether per-group opening balances appear in the
  group view. When enabled, the backend dynamically calculates each group's B/F
  as the net of all prior-year non-pending main-ledger transactions for that
  group (across all accounts). No stored B/F transactions — purely computed.
  - Setting toggled via `GET/PATCH /finance/group-bf-setting`
  - Tickbox on Finance Accounts page (`FinanceAccounts.jsx`)
  - Group view returns `{ transactions, groupBf }` instead of plain array
  - `FinanceLedger.jsx` shows B/F rows + Total Brought Forward at table top

### Transfer Money (doc 7.3)

- Routes: `GET/POST/PATCH/DELETE /finance/transfers` — privilege `finance_transfer_money`
- Creates two `transactions` rows with shared `transfer_id`: out from source, in to target
- Deleting via `/transfers/:transferId` deletes both legs
- `listTransfers` query filters `WHERE t_out.type = 'out'` to avoid duplicates
- Frontend: `TransferMoney.jsx` at `/finance/transfers`

### Reconcile Account (doc 7.5)

- `GET /finance/reconcile?accountId=` returns `{ account, clearedBalance, uncleared }`
- `clearedBalance = balance_brought_forward + SUM(cleared in - cleared out)`
- `POST /finance/reconcile` sets `cleared_at = statementDate` for selected transactions
- Frontend: `ReconcileAccount.jsx` at `/finance/reconcile`

### Pending Transactions (docs 7.10.5, 8.6d)

- `transactions.pending BOOLEAN NOT NULL DEFAULT false` — added via `ALTER TABLE`
- Account-level config in `finance_accounts`: `pending_config` (`disabled`/`optional`/`by_type`),
  `pending_types TEXT[]` (e.g. `['BACS', 'Standing Order']`)
- **Auto-pending on creation**: backend reads account config. `disabled` → always false,
  `by_type` → set true if payment_method is in `pending_types`, `optional` → use client value
- **Transfers cannot be pending** — blocked in both PATCH and bulk-pending endpoints
- **Ledger display**: Cleared column shows "Pending" (amber text) for pending rows;
  Balance column is blank for pending rows; running balance skips pending transactions
- **Bulk actions**: checkbox column in account view, "Confirm / Make pending" dropdown,
  `PATCH /finance/transactions/bulk-pending` endpoint. Eligibility: not cleared, not batched,
  not a transfer. Route defined **before** `/transactions/:id` to avoid Express param match.
- **Financial Statement**: all queries add `AND pending = false`; returns `pendingCount`;
  frontend shows amber warning banner when `pendingCount > 0`
- **Opening balance** (both ledger and statement): excludes pending transactions
- **Payment methods aligned**: `TransactionEditor` uses same list as `ConfigureAccount`
  (`Cheque, Cash, PayPal, Standing Order, Direct Debit, BACS, Debit card, Account transfer, Credit card`)

### Financial Statement (doc 7.6)

- `GET /finance/statement?accountId=&year=` (accountId=`'all'` for all active accounts)
- Financial year bounds from `year_start_month`/`day`; year named by start calendar year
- Opening balance = `balance_brought_forward` + net before year start
- Download: ExcelJS — Receipts, Payments, Balance Sheet sections
- Frontend: `FinancialStatement.jsx` at `/finance/statement`

### Groups Statement (doc 7.7)

- `GET /finance/groups-statement?from=&to=&showTransactions=`
- Queries `group_ledger_entries` (not main transactions)
- Download: ExcelJS — group rows with optional indented transactions, totals row
- Frontend: `GroupsStatement.jsx` at `/finance/groups-statement`

### API namespace

```js
import { finance as financeApi } from '../../lib/api.js';
financeApi.listAccounts() / .createAccount(data) / .updateAccount(id, data) / .deleteAccount(id)
// same for categories, transactions, transfers
```

---

## 8. Email module (docs 6.1–6.1.5)

### Architecture

- Backend: `email.js` at `/email`; uses `requireAuth` middleware (router-level)
  plus per-route `requirePrivilege`; token utility: `emailTokens.js`
- SendGrid: `@sendgrid/mail`; env var `SENDGRID_API_KEY`
- From: always `noreply@u3abeacon.org.uk`; Reply-To = sender's chosen address

### DB tables

| Table | Notes |
|-------|-------|
| `email_batches` | Per Send click: user_id, subject, body, from_email, reply_to, recipient_count |
| `email_recipients` | Per recipient: status, sendgrid_message_id |
| `standard_messages` | Named templates; UNIQUE name (upsert on save) |

### Token substitution

Case-insensitive. Key tokens: `#FAM`, `#FORENAME`, `#SURNAME`, `#TITLE`, `#MEMNO`,
`#U3ANAME`, `#EMAIL`, `#TELEPHONE`, `#MOBILE`, `#ADDRESSV`, `#RENEW`, `#MEMCLASS`,
`#AFFILIATION`. Partner equivalents: `#PFAM` … `#PMOBILE`.

### Routes

| Route | Privilege | Notes |
|-------|-----------|-------|
| `GET /email/from-addresses` | `email:send` | User's member email + office emails |
| `GET/POST/DELETE /email/standard-messages` | `email_standard_messages:*` | Templates |
| `POST /email/send` | `email:send` | Multipart (attachments) or JSON |
| `GET /email/delivery` | `email_delivery:view` | Own batches; all if `email_delivery:all` |
| `GET /email/delivery/:batchId` | `email_delivery:view` | Batch + recipients |
| `POST /email/delivery/:batchId/refresh` | `email_delivery:view` | Re-query SendGrid Activity |
| `POST /email/unblocker` | `email_delivery:all` | Remove from bounce/spam lists |

### Send flow

1. Fetch member rows with address + partner data
2. Fetch tenant display name
3. For each recipient with email: resolve tokens, send via SendGrid
4. Store batch + recipients (start as 'Despatched'; failures as 'Invalid')

### Attachments

`multer.memoryStorage()` — in RAM, base64 to SendGrid, discarded. 20 MB limit.
Multer passes non-multipart requests unchanged.

### Frontend pages

- `EmailCompose.jsx` at `/email/compose` — reads IDs from `sessionStorage.emailComposeMemberIds`
- `EmailDelivery.jsx` at `/email/delivery` — date-filtered batch list
- `EmailDeliveryDetail.jsx` at `/email/delivery/:id` — per-recipient status + Refresh
- `EmailUnblocker.jsx` at `/email/unblocker` — admin only

### Integration

`MemberList.jsx` bulk "Send email" → stores IDs in sessionStorage → navigates to compose.

---

## 9. Data Export & Backup / Restore

### Export

- Backend: `backup.js` at `/backup`; privilege `data_export_backup` (view/download/restore)
- `GET /backup/export?type=<type>` streams `.xlsx`. Types: `members`, `finance`, `groups`,
  `calendar`, `system`, `officers`, `settings`, `all`
- Frontend: `DataBackup.jsx` at `/backup`
- Uses `requestBlob` helper in `api.js` (auth token in memory, can't use browser navigation)
- Filenames include tenant display name + type + timestamp

### Restore (system admin only)

`POST /system/restore/:tenantSlug` — multipart upload, auto-detects format:
- `Members` sheet first column `mkey` → Beacon; `id` → Beacon2

**Beacon2 restore**: UUIDs preserved; FK-dependent tables inserted in order.
**Beacon restore**: Maps `mkey`/`gkey`/`tkey` to new UUIDs. Partner detection via
shared `akey`. Month `0` → month_index 13 (Renewals). Positive amounts = in,
negative = out.

Both use `prisma.$transaction` with 5-minute timeout. User accounts/roles included.

### Critical: restore helpers need transaction client

All helpers accept `tx` (Prisma transaction client), not tenant slug:
```js
await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe(`SET search_path TO ${schema}, public`);
  await clearTenantData(tx);
  if (format === 'beacon2') await restoreBeacon2(tx, wb);
  else { await restoreBeacon(tx, wb); await resetSequences(tx); }
}, { timeout: 300_000 });
```

### Beacon restore: default password

All imported users get `Beacon2!` (`BEACON_DEFAULT_PASSWORD` exported from `backup.js`).

### System admin "Set password"

`POST /system/tenants/:id/set-temp-password` — sets password for ALL users in tenant.
Explicit, auditable, scoped.

### Sequences reset after restore

`membership_number_seq` and `transaction_number_seq` reset to `MAX + 1`.

### Zero-amount transactions

`CHECK (amount >= 0)` (not `> 0`) for Beacon exports with free/honorary memberships.

### Content-Disposition CORS

`app.js` CORS must include `exposedHeaders: ['Content-Disposition']` — without it
the browser sees `null` and downloads as `download.xlsx`.

### Beacon Site Settings mapping

| Beacon key | Beacon2 column |
|-----------|----------------|
| `AdvRenewals` | `advance_renewals_weeks` |
| `GraceLapse` | `grace_lapse_weeks` |
| `GiftAidEnable` | `gift_aid_enabled` |
| `GiftAidOnlineRenew` | `gift_aid_online_renewals` |
| `DefaultTown/County/STD` | `default_town/county/std_code` |
| `defaultPaymentMethod` (1–6) | `default_payment_method` (Cash/Cheque/SO/DD/Online/Other) |
| `EnqTelephone/Email/NewMem/Renew` | `public_phone/email/online_join_email/online_renew_email` |
| Site Settings 2 `paypal_account` | `paypal_email` |

### Beacon privkey mappings (group ledger)

- `$pGROUPLEDGER = 1510` → `group_ledger_all`
- `$pGROUPLEDGERASLEADER = 1520` → `group_ledger_as_leader`

---

## 10. Admin and Misc modules

### Audit log (doc 9.2a)

- `GET /audit?from=&to=` (3-month cap, 500-row limit) + `GET /audit/:id` + `DELETE /audit {before}`
- Privileges: `audit_trail:view` and `audit_trail:delete`
- Frontend: `AuditLog.jsx` at `/audit` — table columns match Beacon: When, By, Action, Target, Key, Record, Entity
- `AuditRecord.jsx` at `/audit/:id` — detail view showing full audit entry
- `auditHelpers.js` — `ENTITY_ROUTES` map (entity_type → frontend route prefix) used for "view" links
- Clickable When → navigates to Audit Record detail; clickable Record "view" → navigates to entity page
- `logAudit()` in `backend/src/utils/audit.js` — best-effort (try/catch), call without `await`

### u3a Officers (doc 9.3)

- Backend: full CRUD + `GET /offices/members` (member list with status for colouring)
- Privilege: `offices` (view/create/change/delete)
- Frontend: `OfficerList.jsx` at `/officers`
- Styling: red if status contains "Lapsed"; red + strikethrough if "Deceased" or "Resigned"
- Checkboxes + Send Email (stores officer's **member_id** in sessionStorage)

### Polls (doc 8.8)

- Backend: `polls.js` — CRUD + `/polls/:id/members` + `/polls/by-member/:id`
- Frontend: `PollList.jsx` at `/polls`
- Member list: poll filter with "Negate poll"; "Add to poll" bulk action
- Member record: poll tick boxes, instant save

---

## 11. Frontend UI patterns

### Tailwind CSS (v3, adopted March 2026)

No custom CSS classes. Infrastructure:
- `frontend/tailwind.config.js` — content: `./index.html`, `./src/**/*.{js,jsx}`
- `frontend/postcss.config.cjs` — `.cjs` because `package.json` has `"type": "module"`
- `frontend/src/index.css` — `@tailwind` directives + background-image rule

Design decisions:
- Clean slate/blue palette (not old Beacon yellow/grey)
- Mobile tables: horizontal scroll (`overflow-x-auto` + `min-w-max`)
- Mobile home menu: single-column stacked; desktop `md:` 5-column grid

**Exception**: RoleEditor privilege matrix keeps Beacon colours:
`#ffffcc`/`#f0f0f0` rows, `#0000cc` resource text, `#e08000` save button.

### Common Tailwind patterns

- Input: `border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`
- Primary button: `bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors`
- Destructive button: `border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm`
- Table rows: `i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'` with `bg-slate-50` header
- Content cards: `bg-white/90 rounded-lg shadow-sm p-4 sm:p-6`
- Labels: `block text-sm font-medium text-slate-700 mb-1`
- Responsive grids: always `grid-cols-1 sm:grid-cols-2`, never bare `grid-cols-2`
- Error text: `text-sm text-red-600 mt-1 font-medium`
- Error banner: `rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center`

### Shared components

- `PageHeader` — logo + tenant name + version (`text-xl sm:text-4xl`)
- `NavBar` — glass-effect backdrop, blue links, `–` separator. Accepts `links` prop (not `items`)
- `SortableHeader` + `useSortedData` — sortable columns with ▲/▼/⇅ indicator
- `DateInput` — UK dd/mm/yyyy display, ISO value, calendar picker button

### Save success feedback

Transient green banner, auto-dismiss 3 seconds:
```jsx
const [saved, setSaved] = useState(false);
const savedTimer = useRef(null);
// After save:
setSaved(true);
clearTimeout(savedTimer.current);
savedTimer.current = setTimeout(() => setSaved(false), 3000);
```

### Unsaved changes (`useUnsavedChanges`)

Every full-page edit form must use it. Call `markDirty()` on change, `markClean()` before
navigate on save/cancel. Currently on: MemberEditor, SystemSettings, TransactionEditor,
RoleEditor, VenueEditor, UserEditor, MemberClassEditor, GroupRecord, PersonalPreferences,
TransferMoney, PublicLinks.

**Router requirement:** The hook uses React Router's `useBlocker` for in-app navigation
blocking, which requires a **data router** (`createBrowserRouter` in `App.jsx`). The app
was converted from `<BrowserRouter>` to `createBrowserRouter` to enable this. In tests
using `MemoryRouter` (non-data router), the hook gracefully falls back to
`beforeunload`-only protection. The conditional `useBlocker` call is safe because the
router context is stable for the lifetime of a component instance.

### Sortable columns

Non-sortable by design: action columns, `leaders` in GroupList, Email/tel in GroupMembers,
RoleEditor matrix, UserEditor role checkboxes, MemberStatusList.

### App version display

`frontend/package.json` → `"version"` injected via Vite `define: { __APP_VERSION__ }`.
Shown in PageHeader top-right. Bump before committing releases.

---

## 12. Testing

### How to run

```bash
cd backend && npm test    # vitest --run
cd frontend && npm test   # vitest --run
```

CI: `.github/workflows/ci.yml` on every push to `claude/**` branches.

### Backend tests

- Framework: vitest + supertest
- Config: `backend/vitest.config.js` (JWT secrets in `env` block)
- DB fully mocked: `vi.mock('../utils/db.js', ...)`
- Redis mocked: `isSessionInvalidated → false`
- Token helpers: `makeAuthHeader()`, `makeSysAdminHeader()` from `helpers.js`
- `app.js` for tests (not `server.js`)
- `ALL_PRIVS` in helpers must include all privilege strings

### Backend test pattern

```js
vi.mock('../utils/db.js', () => ({ prisma: { $disconnect: vi.fn() }, tenantQuery: vi.fn(), withTenant: vi.fn() }));
vi.mock('../utils/redis.js', () => ({ isSessionInvalidated: vi.fn().mockResolvedValue(false) }));
tenantQuery.mockResolvedValueOnce([...]); // mock each DB call in order
```

### Frontend tests

- Framework: vitest + React Testing Library + jsdom
- API calls mocked: `vi.mock('../lib/api.js', ...)`
- Auth context mocked: `useAuth` with `can: vi.fn().mockReturnValue(true)`
- Router mocked: `useParams`, `useNavigate` overridden; wrap in `<MemoryRouter>`

### Frontend test pattern

```jsx
vi.mock('../lib/api.js', () => ({ members: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ tenant: 'test', can: vi.fn().mockReturnValue(true) }) }));
render(<MemoryRouter><MyPage /></MemoryRouter>);
expect(getByText('Page Title')).toBeInTheDocument();
```

### Multiple text instances

When heading appears in NavBar AND `<h1>`, use `getAllByText` not `getByText`.

### End-to-end tests (Playwright)

Location: `e2e/`. Runs against live staging. `global-setup.js` creates test tenant.
`fixtures/admin.js` logs in per test. Page Object Models in `pages/`.
Tests numbered to match Beacon UG sections.

---

## 13. Gift Aid module (doc 7.8)

### Data model

- `transactions.gift_aid_amount NUMERIC(10,2)` — GA-eligible portion, stored at transaction time
- `transactions.gift_aid_claimed_at DATE` — set when user marks transactions as claimed
- `members.gift_aid_from DATE` — member's GA declaration date
- `member_classes.gift_aid_fee NUMERIC(8,2)` — GA-eligible portion of fee
- `class_monthly_fees.gift_aid_fee` — month-specific GA fee (when `fee_variation = 'varies_by_month'`)
- `tenant_settings.gift_aid_enabled` — master switch

### Gift Aid amount population

`resolveGiftAidAmount()` in `members.js` computes the GA amount at transaction time:
1. Checks `gift_aid_enabled` in settings
2. Checks member has `gift_aid_from <= transaction_date`
3. Looks up `gift_aid_fee` from class (or `class_monthly_fees` by month when varies_by_month)
4. Returns the amount (or `null` if not eligible)

Called from `createMemberPayment()` (add new member) and `POST /members/renew` (bulk renewal).

### Backend routes (`giftAid.js` at `/gift-aid`)

| Route | Privilege | Notes |
|-------|-----------|-------|
| `GET /gift-aid` | `gift_aid_declaration:view` | Lists GA-eligible transactions; filters: `year`, `excludeClaimed` |
| `POST /gift-aid/download` | `gift_aid_declaration:download_and_mark` | Excel with HMRC columns (Title, First Name, Last Name, House Name/No, Postcode, Date, Amount) |
| `POST /gift-aid/mark` | `gift_aid_declaration:download_and_mark` | Sets `gift_aid_claimed_at = today` |

### Financial year bounds

Uses `year_start_month`/`year_start_day` from `tenant_settings` via `computeYearBounds()`.
`currentFinancialYear()` determines the current year based on today vs year start.

### Email tokens

When sending from the GA declaration page, `giftAidDates` is passed in the send request.
The email route fetches GA transactions per member and builds:
- `#GIFTAID` — formatted GA declaration date (e.g. `03/03/2025`)
- `#GIFTAIDLIST` — comma-separated list of date+amount pairs (e.g. `11/03/2023 £20.00, 20/09/2023 £25.00`)

These tokens only appear in the token panel when navigating from the GA page.

### Frontend

- Page: `GiftAidDeclaration.jsx` at `/finance/gift-aid`
- Home link gated by `gift_aid_declaration:view`
- Selection → Download Excel / Mark as Claimed / Send Email
- Uses `requestBlob()` with POST (extended to support method/body/headers)

### Known issues

- Joint/family membership GA logic is deferred (see `KNOWN-ISSUES.md`)

---

## 14. Credit Batches module (doc 7.4)

### Data model

- `credit_batches` table: `id`, `batch_ref`, `account_id` (FK), `created_at`
- `batch_ref` is UNIQUE per account (compound unique on `account_id` + `batch_ref`)
- `transactions.batch_id` FK to `credit_batches.id` ON DELETE SET NULL
- Only "in" type, uncleared, unbatched transactions can be added to a batch

### Backend routes (all in `finance.js` at `/finance/batches`)

| Method | Path | Privilege | Purpose |
|--------|------|-----------|---------|
| GET | `/batches?accountId=&mode=&date=` | `finance_batches:view` | List batches (uncleared or since date) |
| GET | `/batches/unbatched?accountId=` | `finance_batches:view` | Uncleared 'in' txns not in any batch |
| GET | `/batches/:id` | `finance_batches:view` | Batch detail with member transactions |
| POST | `/batches` | `finance_batches:create` | Create batch with selected transactions |
| POST | `/batches/:id/transactions` | `finance_batches:create` | Add transactions to existing batch |
| DELETE | `/batches/:id/transactions` | `finance_batches:create` | Remove transactions from batch |
| DELETE | `/batches/:id` | `finance_batches:delete` | Delete empty uncleared batch |

**Route ordering**: `/batches/unbatched` must be defined before `/batches/:id` to
avoid Express matching "unbatched" as an `:id` parameter.

### Reconciliation integration

- `GET /finance/reconcile` returns unbatched uncleared transactions plus batch
  summary rows (with `is_batch: true`, `txn_count`, summed `amount`)
- `POST /finance/reconcile` accepts `batchIds` array; clearing a batch sets
  `cleared_at` on all member transactions

### Frontend

- **CreditBatches page** (`/finance/batches`): list, detail, create modes;
  account selector; batch table with status badges
- **FinanceLedger**: "Add batch" button (account view only, requires `finance_batches:create`)
- **TransactionEditor**: shows batch info panel; "Remove from batch on save" checkbox
- **ReconcileAccount**: batch rows appear as single indigo-highlighted entries

### Deletion rules

Only empty batches (zero transactions) can be deleted. Remove all transactions first.

---

## 15. Reference documentation

### User Guide — `docs/BeaconUG/`

Each subfolder = one Beacon UG webpage (PDF → Markdown + images).
**Before using**: check for unconverted PDFs — warn user if found.
If docs for a feature don't exist, ask the user.

**Naming note**: Section 8 index = "Set-Up Operations" (folder `8. System settings`).
Not the same as the System Settings screen (doc `8.3`).

### Legacy Beacon source — `docs/FromBeacon/`

Selected files from original Beacon codebase. Ask user to add missing files.

---

## 16. Online Joining and Portal Auth (docs 10.1, 10.2)

### Overview

Public-facing pages for new members to join online and existing members to register
for portal access. All public routes are unauthenticated and resolve tenants from
a URL slug (`/public/:slug/...`).

### Public route architecture

- Backend: `public.js` at `/public` — **no auth middleware**
- `resolveTenant` middleware on all routes: looks up tenant by slug via `prisma.sysTenant.findUnique`,
  attaches `req.tenantSlug` and `req.tenantSchema`
- All DB queries use `tenantQuery()` with the resolved schema

### Online Joining flow (doc 10.1)

1. `GET /:slug/join-config` — returns u3a name, membership classes, Gift Aid flag,
   privacy policy URL, default town/county
2. `POST /:slug/join` — validates form (Zod), creates address row, computes `next_renewal`
   from year-start settings, creates member with **Applicant** status, calls PayPal stub,
   returns `{ paymentId, redirectUrl, memberId }`
3. `POST /:slug/payment-confirm` — verifies payment via stub, updates status to **Current**,
   creates finance transaction (PayPal account + Membership category), sends confirmation
   email to member + notification to officers with `notify_online_join = true`

### Portal authentication (doc 10.2 — registration/login only)

Separate auth system on the `members` table (not `system_users`):

| Column | Purpose |
|--------|---------|
| `portal_email` | Login email |
| `portal_password_hash` | bcrypt hash |
| `portal_email_verified` | Must be true to log in |
| `portal_verification_token/expires` | Email verification |
| `portal_reset_token/expires` | Password reset |

**Routes:**
- `POST /:slug/portal/register` — identity verification (memno + name + postcode + email),
  sets portal credentials, sends verification email
- `POST /:slug/portal/verify-email` — confirms token
- `POST /:slug/portal/login` — email + password → JWT with `isPortal: true`
- `POST /:slug/portal/forgot-password` — anti-enumeration (always "if account exists…")
- `POST /:slug/portal/reset-password` — validates token, hashes new password

**Password requirements**: 10–72 chars, upper + lower + numeric.

### PayPal stub (`utils/paypal.js`)

Two functions with clear interfaces for future real implementation:
- `initiatePayment({ amount, description, memberRef, returnUrl, cancelUrl, paypalEmail })`
  → `{ paymentId, redirectUrl }`
- `verifyPaymentNotification({ paymentId, rawBody })`
  → `{ verified, grossAmount, fee, payerEmail, status }`

Currently generates fake paymentId and redirects to own confirmation endpoint.

### System Messages (admin page)

- DB: `system_messages` table — pre-defined templates with well-known IDs, seeded on migration
- Backend: `systemMessages.js` at `/system-messages`; privileges `system_messages:view/change`
- Frontend: `SystemMessages.jsx` at `/system-messages` — inline editing of subject/body
- Token reference panel shows available substitutions (#FORENAME, #SURNAME, #MEMNO, etc.)
- Current messages: `online_join_confirm`, `online_join_officer_notify`,
  `gift_aid_payment`, `online_renewal_confirm`, `card_replacement_confirm`,
  `home_page_notice` (body only, no subject)

### Public Links (admin page)

- Backend: `publicLinks.js` at `/public-links`; privileges `public_links:view/change`
- Frontend: `PublicLinks.jsx` at `/public-links` — toggle online joining, privacy policy URL,
  copyable public URLs, PayPal status indicator
- Reads `online_joining_enabled` and `privacy_policy_url` from `tenant_settings`

### Database additions (`tenant_schema.sql`)

- `system_messages` table with seeded rows
- `tenant_settings` columns: `online_joining_enabled`, `privacy_policy_url`
- `members` columns: `portal_email`, `portal_password_hash`, `portal_email_verified`,
  `portal_verification_token/expires`, `portal_reset_token/expires`
- Index: `idx_members_portal_email` (partial, WHERE portal_email IS NOT NULL)
- Seeded member status: **Applicant**

### Frontend public pages

| Page | Route | Purpose |
|------|-------|---------|
| `JoinForm.jsx` | `/public/:slug/join` | Public joining form |
| `JoinComplete.jsx` | `/public/:slug/join-complete` | Payment confirmation |
| `PortalLogin.jsx` | `/public/:slug/portal` | Portal login |
| `PortalRegister.jsx` | `/public/:slug/portal/register` | Identity verification + password |
| `PortalVerifyEmail.jsx` | `/public/:slug/portal/verify` | Email token verification |
| `PortalForgotPassword.jsx` | `/public/:slug/portal/forgot-password` | Request reset link |
| `PortalResetPassword.jsx` | `/public/:slug/portal/reset-password` | Set new password |

### API client (`api.js`)

- `systemMessages.list()`, `systemMessages.update(id, data)` — authenticated
- `publicLinks.get()`, `publicLinks.update(data)` — authenticated
- `publicApi.*` — direct fetch (no auth token): `getJoinConfig`, `submitJoin`,
  `confirmPayment`, `portalRegister`, `portalVerifyEmail`, `portalLogin`,
  `portalForgotPassword`, `portalResetPassword`

---

## 16. Calendar module

### Data model

Open meetings reuse the `group_events` table with `group_id = NULL`.
The `group_id` column was made nullable via `ALTER TABLE ... ALTER COLUMN group_id DROP NOT NULL`
in `tenant_schema.sql`. No separate table is needed.

### Backend routes (`backend/src/routes/calendar.js`)

| Route | Privilege | Purpose |
|-------|-----------|---------|
| `GET /calendar/events` | `calendar:view` | List all events across groups + open meetings; filters: `from`, `to`, `memberId`, `venueId`, `groupId` |
| `GET /calendar/events/pdf` | `calendar:download` | Same filters, returns PDF download |
| `GET /calendar/members/search` | `calendar:view` | Member name search for filter autocomplete (`?q=...`, min 2 chars, limit 20) |
| `GET /calendar/open-events` | `meetings:view` | List open meetings (group_id IS NULL) |
| `POST /calendar/open-events` | `meetings:create` | Create open meeting(s) with recurrence |
| `PATCH /calendar/open-events/:id` | `meetings:change` | Update single open meeting |
| `DELETE /calendar/open-events` | `meetings:delete` | Bulk delete by ids array |

### Frontend pages

| File | Route | Description |
|------|-------|-------------|
| `frontend/src/pages/groups/Calendar.jsx` | `/calendar` | Main calendar view with filters, date range, PDF download |
| `frontend/src/pages/groups/OpenMeetings.jsx` | `/calendar/open-meetings` | Open meetings CRUD (same pattern as GroupSchedule) |

### Privileges

- `calendar` resource: `[view, download]` — already seeded in `privilegeResources.js`
- `meetings` resource: `[view, create, change, delete]` — already seeded
- Both are granted to Administration, Groups Coordinator, and Group Leaders roles in `defaultRoles.js`

### Key decisions

- **Open meetings** share the `group_events` table (nullable `group_id`) rather than a separate table
- **Member filter** uses search/autocomplete (not dropdown) for scalability with large memberships
- **Date/time click** in calendar navigates to Group Record Schedule tab (`/groups/:id?tab=schedule`), not inline edit
- **Map links** use Google Maps (`google.com/maps/search/?api=1&query=POSTCODE`)

### Deferred items (in KNOWN-ISSUES.md)

- Joint membership online joining
- Full Members Portal features (view/update own details, renewal, group browsing)
- Full Public Links configuration (renewing, portal toggle)
- Real PayPal API integration
- Shared email handling in portal registration

---

## 14. Membership Cards (doc 4.7)

### Data model

- `members.card_printed` BOOLEAN — tracks whether a card has been issued. Reset to
  `false` on: member creation, renewal, status change, online payment confirmation.
- `tenant_settings.card_colour` — hex colour for the card band (already existed).
- `tenant_settings.email_cards` — flag for auto-attaching cards to confirmation emails (deferred).

### Backend routes (`/membership-cards`)

| Method | Path | Privilege | Purpose |
|--------|------|-----------|---------|
| GET | `/` | `membership_cards:view` | List members with card filters |
| GET | `/download` | `membership_cards:download_and_mark` | PDF of cards (10 per page) |
| GET | `/blank` | `membership_cards:download_and_mark` | PDF of 10 blank cards |
| GET | `/excel` | `membership_cards:download_and_mark` | Excel card data export |
| POST | `/mark-printed` | `membership_cards:download_and_mark` | Mark cards as printed |
| GET | `/single-pdf` | `membership_cards:download_and_mark` | Single card PDF (for email) |

### Card layout

- 85×54mm business cards, 2 columns × 5 rows per A4 page
- Content: u3a branding, u3a name, "Membership valid to [date]", class name,
  member name, membership number, Code 128 barcode, coloured band
- Barcode generated by `bwip-js` library
- Text colour on band auto-adjusts (white/black) based on band luminance

### Filter modes

- **outstanding**: `card_printed = false` AND status is Current
- **poll**: status is Current AND member in selected poll
- **outstanding_and_poll**: both conditions combined
- **all**: all Current members regardless of card_printed

### Card expiry date

Uses `member.next_renewal` if set; otherwise falls back to the day before the
next `year_start_month/year_start_day`. "Advance expiry" adds one year.

### Deferred

- Auto-attaching cards to online joining/renewal confirmation emails (`email_cards` setting)
- Members Portal "Order a replacement card" (doc 10.2.5)

---

## 19. Letters module (docs 6.2, 6.2.1, 6.2.2)

### Overview

Letters are one-page personalised documents generated as a PDF (one page per member).
They use the same token system as emails (`#FORENAME`, `#SURNAME`, `#ADDRESSV`, etc.)
and support standard letter templates for reuse.

### Data model

- `standard_letters` table: `id`, `name` (UNIQUE), `body` (TipTap JSON string),
  `created_at`, `updated_at`

### Backend routes (`/letters`)

| Method | Path | Privilege | Purpose |
|--------|------|-----------|---------|
| GET | `/standard-letters` | `letters_standard_messages:view` | List templates |
| POST | `/standard-letters` | `letters_standard_messages:create` | Save/upsert template |
| DELETE | `/standard-letters/:id` | `letters_standard_messages:delete` | Delete template |
| POST | `/download` | `letters:download` | Generate PDF |

### PDF generation

- Uses **pdfmake v0.2** (not v0.3 which has broken Node.js server-side support)
- Import pattern: `const PdfPrinter = require('pdfmake/src/printer')` via `createRequire`
- Fonts loaded from `pdfmake/build/vfs_fonts` as base64 Buffers
- Converts TipTap JSON → pdfmake content array via `tiptapToPdfContent()`
- Token resolution via `buildTokenMap()` + `applyTokens()` from `emailTokens.js`
- Page breaks inserted between members

### Frontend

- **LetterCompose.jsx**: TipTap rich text editor with toolbar (bold, italic, underline,
  alignment, font size), token sidebar, recipients list, standard letter CRUD
- Entry point: "Send Letter" bulk action on MemberList → `sessionStorage.letterComposeMemberIds`
- Font sizes: Small (10pt), Normal (12pt), Large (14pt), Huge (18pt)
- Standard letter body stored as stringified TipTap JSON

### Dependencies

- **Backend**: `pdfmake@0.2.18`
- **Frontend**: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-text-align`,
  `@tiptap/extension-underline`, `@tiptap/extension-text-style`, `@tiptap/pm`

