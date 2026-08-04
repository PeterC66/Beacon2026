# beacon2026 — Implementation Reference

**This file contains detailed implementation notes organised by module.**
Read `CLAUDE-STANDARDS.md` first for the cross-cutting checklist that applies to all work.

> Sections are grouped by functional area, not by date. Each section documents
> the data model, backend routes, frontend pages, and gotchas for that module.

## Contents

1. [Multi-tenancy and schema migrations](#1-multi-tenancy-and-schema-migrations)
2. [Authentication and users](#2-authentication-and-users)
3. [Prisma and PostgreSQL patterns](#3-prisma-and-postgresql-patterns)
4. [System settings (doc 8.3)](#4-system-settings-doc-83)
5. [Members module](#5-members-module)
6. [Groups module](#6-groups-module)
7. [Finance module](#7-finance-module)
8. [Email module (docs 6.1–6.1.5)](#8-email-module-docs-61615)
9. [Data Export & Backup / Restore](#9-data-export--backup--restore)
10. [Admin and Misc modules](#10-admin-and-misc-modules)
11. [Frontend UI patterns](#11-frontend-ui-patterns)
12. [Testing](#12-testing)
13. [Gift Aid module (doc 7.8)](#13-gift-aid-module-doc-78)
14. [Credit Batches module (doc 7.4)](#14-credit-batches-module-doc-74)
15. [Reference documentation](#15-reference-documentation)
16. [Online Joining and Portal Auth (docs 10.1, 10.2)](#16-online-joining-and-portal-auth-docs-101-102)
17. [Calendar module](#17-calendar-module)
18. [Membership Cards (doc 4.7)](#18-membership-cards-doc-47)
19. [Letters module (docs 6.2, 6.2.1, 6.2.2)](#19-letters-module-docs-62-621-622)
20. [Password recovery and temporary passwords](#20-password-recovery-and-temporary-passwords)
21. [Cookie Consent](#21-cookie-consent)
22. [Custom Fields](#22-custom-fields)
23. [Gift Aid Log](#23-gift-aid-log)
24. [Help Widget (Zendesk Web Widget)](#24-help-widget-zendesk-web-widget)
25. [Feature Toggles](#25-feature-toggles)
26. [Deployment and Infrastructure](#26-deployment-and-infrastructure)
27. [Public read API (`/api/v1`)](#27-public-read-api-apiv1)

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
5. `splitSQL()` in `backend/src/utils/migrate.js` ignores semicolons inside
   `-- line comments`, `/* block comments */`, `'single-quoted strings'`
   (including the `''` escape), and `$$ dollar-quoted blocks $$`, so a `;`
   in any of those is safe. (Before April 2026 only `$$` was tracked and a
   stray semicolon in a comment silently broke `saved_reports` migration —
   see `backend/src/__tests__/splitSQL.test.js` for the regression pin.)
6. `$$` dollar-quoted blocks (e.g. `DO $$ BEGIN ... EXCEPTION ... END $$`) are
   handled correctly — `splitSQL()` tracks `$$` delimiters and only splits on
   semicolons outside dollar-quoted regions

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

[↑ Back to top](#contents)

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
- API client is split into modules under `frontend/src/lib/api/`:
  - `core.js` — request infrastructure, token management, blob/multipart helpers
  - `system.js` — system-admin API (separate token per call, raw fetch)
  - `public.js` — public/unauthenticated API (raw fetch, no auth)
  - `portal.js` — members-portal API (sessionStorage JWT)
  - `api.js` — barrel re-export + tenant-scoped namespaces (use `request()` from core)
- Shared constants live in `shared/constants.js` (repo root), re-exported via
  `frontend/src/lib/constants.js` for convenient frontend imports
- Shared validation (UK postcode, phone) in `frontend/src/lib/validation.js`

### Session invalidation

Redis-based (optional, `USE_REDIS=false` for current POC). Role changes invalidate
affected sessions via Redis, or expire naturally after 15 min.

### Password-change routes must reissue the refresh cookie

`POST /auth/change-password` and `/auth/force-change-password` intentionally
revoke **all** of a user's refresh tokens (kills any other logged-in sessions)
via `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1` +
`invalidateUserSessions`. Any route that does this must then call
`issueRefreshToken(tenantSlug, userId)` (`authService.js`) and
`res.cookie(COOKIE_NAME, newRefreshToken, cookieOptions)` for the **current**
session before responding — otherwise the browser keeps its now-revoked
cookie and the next `/auth/refresh` call (triggered transparently by
`frontend/src/lib/api/core.js`) fails with "Invalid refresh token." and
force-logs the user out on their very next action. This was a real bug, fixed
2026-08-01 (see CHANGELOG). `issueRefreshToken` is the shared helper for
"sign + store + return a refresh token outside the normal login/refresh
flow" — reuse it rather than duplicating the sign/hash/insert sequence again.

Reissuing the refresh cookie isn't quite enough on its own: `invalidateUserSessions`
also marks the **access token already in the client's memory** as stale (checked
by `requireAuth` via `isSessionInvalidated`), so the very next authenticated
request 401s and only recovers once `core.js`'s transparent-refresh-on-401 path
completes. That's normally invisible, but a route that navigates straight to a
page that fires its own authenticated request on mount (e.g. `ChangePassword.jsx`
→ Home → `getHomeInfo()`) can expose it as a visible flash/failure, and it's one
more round trip than necessary either way. Both password-change routes now also
call `issueAccessToken(tenantSlug, userId)` (`authService.js` — recomputes
privileges and signs a fresh access token, same shape as login/refresh) and
return it as `accessToken` in the JSON body; the frontend calls
`setAccessToken()` (`frontend/src/lib/api/core.js`) immediately on success in
both `ChangePassword.jsx` (forced change) and `PersonalPreferences.jsx` (regular
change) so the in-memory token is replaced before anything else fires. Fixed
2026-08-02 — previously only the forced-change flow visibly hit this, since the
regular change-password screen doesn't navigate anywhere afterward.

That still wasn't the whole story: `issueAccessToken()` is called *immediately*
after `invalidateUserSessions()`, often within the same millisecond. JWT `iat`
is second-precision (`jsonwebtoken` floors `Date.now()/1000`), but the
Redis/Postgres invalidation marker is stored with millisecond precision
(`Date.now()`). `isSessionInvalidated()` (`utils/redis.js`) originally compared
`tokenIssuedAt * 1000 < invalidatedAtMs` — so a brand-new token minted a few ms
after the marker could still land in the *same second* as the marker and get
flagged as predating it, 401ing on its very first use and forcing a real
logout (the retry-once transparent-refresh in `core.js` doesn't save you: the
refreshed token faces the identical same-second race). Fixed 2026-08-02 by
flooring the marker to whole seconds before comparing
(`invalidatedSeconds()` in `utils/redis.js`) — a token issued in the same
second as the marker is no longer treated as predating it. This is the kind
of bug that's easy to miss because it's timing-dependent: it reproduces
reliably in production (same-request calls land in the same second constantly)
but any test asserting it with a realistic multi-second gap between marker and
token (as the original `redis.test.js` cases did) won't catch it — the
regression test added alongside the fix uses a token issued in the *same*
second as the marker specifically to exercise the race.

### Audit events for login/logout/timeout

`loginUser()` success path, `POST /auth/logout`, and a dedicated
`POST /auth/session-timeout` (called by `AuthContext.jsx` when the client-side
inactivity timer fires — this is the only one of the three the backend can't
detect on its own) all write to `audit_log` with actions `'login'`,
`'logout'`, `'session_timeout'` respectively. The inactivity timer dispatches
`window.dispatchEvent(new CustomEvent('auth:expired', { detail: { reason:
'timeout' } }))` so the shared `auth:expired` handler in `AuthContext.jsx` can
tell a real timeout apart from a generic refresh-token failure (the latter is
not separately audited — it's a revoked/expired session, not a user action).

`/auth/session-timeout` also revokes the refresh token and clears the
`beacon2026_refresh` cookie (calls the same `logoutUser()` as `/auth/logout`),
and the frontend's `auth:expired` handler calls `clearAuth()` in addition to
resetting React state. Before 2026-08-04 the route was audit-only, so a page
reload right after an idle timeout silently re-authenticated the user via
`/auth/refresh` with no further audit entry — the timeout looked real in the
log but didn't actually end the session. See CHANGELOG 2026-08-04.

Note the asymmetry this still leaves: `/auth/refresh` itself (used both for
the retry-once transparent refresh in `core.js` and for `restoreSession()` on
app load) writes no audit entry on success. A silent session restore from the
`beacon_last_u3a` cookie — no password, no `login` audit row — is
indistinguishable in the log from "nobody was here". Tracked as
`[DEFERRED]` in `KNOWN-ISSUES.md` → "Audit log — session-restore visibility".

### Personal Preferences (doc 9.1)

- Frontend only: `PersonalPreferences.jsx` at `/preferences`
- Always visible (no privilege gate)
- Three sections: display prefs + inactivity timeout, change password, security Q&A
- Display prefs in `localStorage` via `usePreferences.js` (key `beacon2026_prefs`)
  - `getPreferences()` — snapshot (not reactive)
  - `savePreferences(updates)` — merges partial updates
  - `formatMemberName(member)` — respects `displayFormat` setting; includes `(known_as)` when present
- Inactivity timeout: `AuthContext` `useRef` timer, resets on user interaction,
  dispatches `auth:expired`
- Change password: `PATCH /auth/change-password`; 5-bar strength meter
- Security Q&A: `GET /auth/qa` + `PATCH /auth/qa` (hashed answer)

### Site Administrator (doc 8.1)

- **`is_site_admin`** boolean column on `users` table (one per tenant)
- Site admin has ALL privileges — `computeAllPrivileges()` returns every
  `resource:action` from `privilege_resources` via `unnest(pr.actions)`
- JWT payload includes `isSiteAdmin: true` for site admin
- Frontend `AuthContext.can()` returns `true` for everything when `isSiteAdmin`
- Cannot be deleted (backend guard)
- Roles section hidden on user record (privileges are implicit)

### System Users (doc 8.2)

- **`member_id`** FK on `users` → `members(id) ON DELETE SET NULL`
- Every system user must be linked to a current member (except site admin)
- **User creation**: select member from dropdown → auto-derives name/email,
  generates random temp password, returns it in response
- **Set Temporary Password**: `POST /users/:id/set-temp-password` → generates
  random password, invalidates sessions, returns `{ tempPassword }`
- **Available members**: `GET /users/available-members` returns current members
  (status = 'Current') for the add-user dropdown
- **User list columns**: Select, Full Name, Login User Name, Member, Site Admin,
  Date Created, Last Accessed, Roles
- **Send Email to users** (doc 8.2.1): row selection + Send Email button,
  uses member_id to route through existing email compose flow

### Delete-last-admin guard

`DELETE /users/:id` checks if target is last Administration role holder → 400 if so.
Also blocks deletion of site administrator.

### New tenant: adminUsername required

`createTenantSchema()` requires `adminUsername` (lowercase alphanumeric).

[↑ Back to top](#contents)

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

[↑ Back to top](#contents)

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

### Settings wired into the system

| Setting | Where consumed |
|---------|---------------|
| `card_colour` | Membership card PDF rendering (`membershipCards.js`) |
| `fee_variation` | Fee lookup logic in member creation/gift aid |
| `extended_membership_month` | Renewal date computation (`MemberEditor.jsx`) |
| `advance_renewals_weeks` | Renewal tab visibility (`members.js`) |
| `grace_lapse_weeks` | Non-renewals/statistics display |
| `deletion_years` | Non-renewals deletion cutoff |
| `default_town/county/std_code` | Pre-fill new member and online join forms |
| `gift_aid_enabled` | Controls gift aid features system-wide |
| `paypal_email/cancel_url` | PayPal payment flow |
| `year_start_month/day` | Core membership year calculations everywhere |
| `default_payment_method` | Fallback pre-fill in TransactionEditor for new transactions |
| `shared_address_warning` | Alert in MemberEditor when saving shared address with differing partner status/class |
| `online_join_email` | Reply-to on joining confirmation emails + displayed on JoinForm |
| `online_renew_email` | Reply-to on renewal emails (when online renewals implemented) |

**Deferred**: `public_phone/email`, `home_page`, `email_cards`, `gift_aid_online_renewals` — see KNOWN-ISSUES.md.

### API

- `GET /settings` — requires `settings:view`
- `PATCH /settings` — requires `settings:change`
- `GET /settings/year-config` — no privilege (any authenticated user)
- `GET /settings/new-member-defaults` — no privilege (any authenticated user)

### Test note

"System Settings" appears in NavBar breadcrumb AND `<h1>` → use `getAllByText`.

[↑ Back to top](#contents)

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

### Column locations: members vs addresses

The `addresses` table holds **all** address-related fields including `telephone`.
The `members` table holds `mobile` and `email` directly.

| Column       | Table       |
|-------------|-------------|
| `house_no`, `street`, `add_line1`, `add_line2`, `town`, `county`, `postcode` | `addresses` |
| `telephone`  | `addresses` |
| `mobile`     | `members`   |
| `email`      | `members`   |

When writing queries that need `telephone`, always use `a.telephone` (from the
addresses JOIN), **not** `m.telephone`.

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
- Label settings saved in `localStorage` key `beacon2026_label_settings`

### Member list — select, email, download

- Selection: `useState(new Set())`, select controls (All/Clear/Email only/Without email)
- Bulk actions: Send Email (stores IDs in `sessionStorage.emailComposeMemberIds`)
- Download field picker (checkboxes before download)
- `GET /members/download?format=excel|pdf|email-csv&ids=...&fields=...`

### MemberEditor — email button

- "Send email" button shown beside the Email field when the member has an email
  address and the user has `email:send` privilege
- Uses the same `sessionStorage.emailComposeMemberIds` pattern as the member list

[↑ Back to top](#contents)

---

## 6. Groups module

### Group record tabs

`GroupRecord.jsx` at `/groups/:id` — Details, Members, Schedule, Ledger, Std Emails, Std Letters tabs.
`TeamRecord.jsx` at `/teams/:id` — same set (minus Schedule specifics that differ — see below).

Members and Schedule tabs use shared components (`EntityMembers.jsx`, `Schedule.jsx`)
parameterised by `entityType` (`'group'`/`'team'`), `api`, and `entityId`. Std Emails/Std
Letters tabs use the same pattern (`StdEmailsTab.jsx`, `StdLettersTab.jsx`, parameterised
by `entityId` + `api`) — see "Std Emails / Std Letters ownership" below.

### Shared Zod schemas (`backend/src/schemas/`)

Shared validation schemas for groups and teams are in `backend/src/schemas/`:

- **`common.js`** — 8 schemas shared by both routes: `addMemberSchema`, `bulkAddMembersSchema`,
  `bulkMemberIdsSchema`, `patchMemberSchema`, `eventSchema`, `updateEventSchema`,
  `bulkDeleteIdsSchema`, `ledgerEntrySchema`.
- **`groups.js`** — group-specific extensions: `patchGroupMemberSchema` (adds `waitingSince`),
  `bulkAddToGroupSchema` (adds `targetGroupId`). Both use `.extend()` on common base schemas.
- **`teams.js`** — team-specific extension: `bulkAddToTeamSchema` (adds `targetTeamId`).

Entity-specific schemas (e.g. `groupSchema`, `teamSchema`) remain inline in their route files.

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

### Std Emails / Std Letters ownership (beacon2026 extra, added 2026-08-04)

A Standard Email/Letter template (`standard_messages`/`standard_letters`) is either
unowned (Administration-only) or owned by a group/team (`owner_group_id`, `ON DELETE
SET NULL`). This is a **second** implementation of the `_all`/`_as_leader` pattern
first used by the Ledger tab — reuse it before inventing a third:

- `backend/src/utils/groupLeader.js` — `isGroupLeader(tenantSlug, userId, groupId)`,
  the shared version of the `users.member_id → group_members.is_leader` join that
  `hasLedgerAccess()` in `groups/ledger.js` / `teams/ledger.js` still duplicates
  privately. New leader-scoped features should import this rather than re-deriving
  the SQL a third time.
- `backend/src/utils/templateOwnership.js` — `hasTemplateManageAccess(req,
  resourcePrefix, action, ownerGroupId)`, the generalised `hasLedgerAccess`
  equivalent: checks `${resourcePrefix}_all:${action}` first, then
  `${resourcePrefix}_as_leader:${action}` + `isGroupLeader()`.
- `backend/src/routes/groupStdMessages.js` — **one shared router**, not the usual
  per-module `groups/*.js` + `teams/*.js` duplication (see `ledger.js` for that
  older pattern). Mounted identically under both `groups/index.js` and
  `teams/index.js` because a team is just a `groups` row with `type='team'` and
  `owner_group_id` doesn't care which — there was nothing group-vs-team-specific
  left to duplicate. Routes: `GET/POST /:id/std-messages`,
  `DELETE /:id/std-messages/:msgId`, and the `/std-letters` equivalents.
- The **tenant-wide** `/email/standard-messages` and `/letters/standard-letters`
  POST/DELETE (in `email.js`/`letters.js`) are Administration-only
  (`${resource}_all:${action}`, checked directly — no `isGroupLeader` branch, since
  there's no group in the URL to be leader of). They can set/clear/reassign
  `owner_group_id`; the nested group/team routes cannot — ownership there is always
  implicit from the URL.
- **Gotcha:** `standard_letters.body` is a stringified Tiptap doc
  (`{type:'doc',content:[...]}`), not plain text — see `tiptapToPdfContent()` in
  `letters.js`. `StdLettersTab.jsx` edits it as plain text (one line = one
  paragraph) via `frontend/src/lib/simpleTiptapDoc.js`, which flattens any
  bold/italic/underline formatting on save — a deliberate scope cut (see
  `KNOWN-ISSUES.md`), not a bug.

[↑ Back to top](#contents)

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

### Refunds (doc 7.10.7)

- Per-account `enable_refunds` boolean (already existed in ConfigureAccount)
- Two linking columns on `transactions`: `refund_of_id` (on refund, points to original)
  and `refunded_by_id` (on original, points to refund)
- `POST /finance/transactions/:id/refund` creates the refund:
  - Opposite type (in→out, out→in); same account/from_to/members/group
  - Per-category refund amounts (each ≤ original); refund total ≤ original amount
  - Date must be > original date AND in same financial year
  - Blocks: cleared, transfer, already-refunded, refund-of-refund, GA-claimed
- Deleting a refund clears `refunded_by_id` on the original (re-enables refunding)
- Refunded originals and refund transactions cannot be edited (PATCH blocked)
- Financial statement: refund transactions (`refund_of_id IS NOT NULL`) are excluded;
  refunded originals use net amount (`amount - refund.amount`) per category and total
- Ledger: all four query variants include `refund_of_id`, `refunded_by_id`, and
  linked transaction numbers; Refund column shows linked # as clickable link;
  refund rows have red background
- Frontend: `TransactionRefund.jsx` at `/finance/transactions/:id/refund`;
  `TransactionEditor.jsx` shows refund/refunded banners and "Refund this transaction"
  nav link on eligible transactions; read-only mode for refunded/refund transactions

### Payment Method Defaults (doc 8.6c)

- Table `payment_method_defaults` — `payment_method` TEXT PK, `account_id` TEXT, `updated_at`
- Special key `_default_method` stores the overall default payment method name in `account_id`
- All other rows map a payment method name (e.g. 'Cash') to a default `account_id`
- `GET /finance/payment-method-defaults` returns `{ defaultMethod, mappings }`
- `PUT /finance/payment-method-defaults` upserts all rows; validates account IDs exist
- Privilege: `finance_accounts:change` (no new privilege needed)
- Frontend: `PaymentMethodDefaults.jsx` at `/finance/payment-method-defaults`
- Linked from `FinanceAccounts.jsx` at top and bottom of the page
- Consumers: `MemberEditor.jsx` (new member payment) and `MembershipRenewals.jsx`
  both fetch defaults on load, pre-select default method + mapped account, and
  auto-switch account when payment method changes

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

[↑ Back to top](#contents)

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
| `standard_messages` | Named templates; UNIQUE name (upsert on save); `owner_group_id` nullable FK, `ON DELETE SET NULL` — beacon2026 extra, added 2026-08-04, see §6 |

### Token substitution

Case-insensitive. Key tokens: `#FAM`, `#FORENAME`, `#SURNAME`, `#TITLE`, `#MEMNO`,
`#U3ANAME`, `#EMAIL`, `#TELEPHONE`, `#MOBILE`, `#ADDRESSV`, `#RENEW`, `#MEMCLASS`,
`#AFFILIATION`. Partner equivalents: `#PFAM` … `#PMOBILE`.

### Routes

| Route | Privilege | Notes |
|-------|-----------|-------|
| `GET /email/from-addresses` | `email:send` | User's member email + office emails |
| `GET /email/standard-messages` | `email_standard_messages:view` | List templates (all, incl. owner) |
| `POST/DELETE /email/standard-messages` | `email_standard_messages_all:*` | Admin-only; can set/reassign `owner_group_id`. Group/team-scoped create/edit/delete goes through `groupStdMessages.js` instead — see §6 "Std Emails / Std Letters ownership" |
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

[↑ Back to top](#contents)

---

## 9. Data Export & Backup / Restore

### Export

- Backend: `backup.js` at `/backup`; privilege `data_export_backup` (view/download/restore)
- `GET /backup/export?type=<type>` streams `.xlsx`. Types: `members`, `finance`, `groups`,
  `calendar`, `system`, `officers`, `settings`, `all`
- Frontend: `DataBackup.jsx` at `/backup`
- Uses `requestBlob` helper in `api.js` (auth token in memory, can't use browser navigation)
- Filenames include tenant display name + type + timestamp

#### Sheets per export type

| Type | Sheets | Builder function |
|------|--------|-----------------|
| `members` | Members | `buildMembersSheet` |
| `finance` | Ledger, Detail, Credit Batches | `buildFinanceSheets` |
| `groups` | Groups, Group members, Group Ledgers, Group Events, Venues, Faculties | `buildGroupsSheets` |
| `calendar` | Calendar (placeholder — events are in Groups export) | `buildCalendarSheet` |
| `system` | System Users, User roles, Roles, Privileges | `buildSystemSheets` |
| `officers` | u3a Officers | `buildOfficersSheet` |
| `settings` | Site Settings 1/2, Finance Accounts, Finance Categories, Membership Classes, Membership Fees, Member Statuses, Polls, Poll assignments, System Messages, Standard Messages, Standard Letters, Payment Method Defaults | `buildSettingsSheets` |
| `all` | All of the above | Runs all builders |

#### Columns exported per table

**Members** — id, membership_number, title, forenames, surname, suffix, known_as,
initials, mobile, email, home_u3a, joined_on, next_renewal, gift_aid_from, notes,
hide_contact, emergency_contact, custom_field_1..4, status_id/name, class_id/name,
partner_id, address_id + address fields. *Not exported*: photo_data, photo_mime_type
(too large for Excel — see KNOWN-ISSUES.md).

**Transactions (Ledger)** — id, transaction_number, date, type, from_to, amount,
payment_method, payment_ref, detail, remarks, cleared_at, account_id/name,
member_id_1, member_id_2, group_id, transfer_id, pending, batch_id,
gift_aid_amount/claimed_at (x2), refund_of_id, refunded_by_id.

**Finance Accounts** — id, name, active, locked, sort_order, pending_config,
pending_types (JSON), enable_refunds, balance_brought_forward.

**Credit Batches** — id, batch_ref, account_id/name, description, batch_date.

**Groups** — id, name, short_name, type (`group`/`team`), faculty_id/name, status,
when_text, start/end_time, venue, venue_id, enquiries, max_members, boolean flags,
information, notes, show_addresses.

**Group Events** — id, group_id/name, event_date, start/end_time, venue_id/name,
contact, details, topic, is_private.

**Tenant Settings** — exported as key/value rows. Includes all 34 settings:
card_colour, email_cards, public_phone/email, home_page, online_join/renew_email,
fee_variation, extended_membership_month, advance_renewals_weeks, grace_lapse_weeks,
deletion_years, default_payment_method, gift_aid_enabled/online_renewals,
default_town/county/std_code, paypal_email/cancel_url, shared_address_warning,
year_start_month/day, online_joining_enabled, privacy_policy_url, group_bf_enabled,
siteworks_activated, custom_field_label_1..4, portal_config (JSON),
group_info_config (JSON), calendar_config (JSON).

**System Messages, Standard Messages, Standard Letters** — id, name, subject, body
(standard_letters has no subject).

**Payment Method Defaults** — payment_method, account_id, account_name.

### Restore (system admin only)

`POST /system/restore/:tenantSlug` — multipart upload, auto-detects format:
- `Members` sheet first column `mkey` → Beacon; `id` → beacon2026

**beacon2026 restore**: UUIDs preserved; FK-dependent tables inserted in order.
**Beacon restore**: Maps `mkey`/`gkey`/`tkey` to new UUIDs. Partner detection via
shared `akey`. Month `0` → month_index 13 (Renewals). Positive amounts = in,
negative = out.

**Beacon restore — Open Meetings**: `clearTenantData()` deletes the
`event_types` rows seeded by `tenant_schema.sql`, so `restoreBeacon()` re-creates
the default `Open Meetings` event type (`is_default = true`) before processing
the legacy `Calendar` sheet. Calendar rows with empty `gkey` become
`group_events` records with `group_id = NULL` and `event_type_id =`
the new Open Meetings id. The combined `date/time` cell is split via
`parseBeaconDateTime()` (handles Excel Date objects, `YYYY-MM-DD HH:MM`, and
`D/M/YYYY HH:MM`). Group-tied calendar rows (gkey set) are intentionally not
restored — see KNOWN-ISSUES.md.

Both use `prisma.$transaction` with 5-minute timeout. User accounts/roles included.

### Critical: restore helpers need transaction client

All helpers accept `tx` (Prisma transaction client), not tenant slug:
```js
await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe(`SET search_path TO ${schema}, public`);
  await clearTenantData(tx);
  if (format === 'beacon2026') await restorebeacon2026(tx, wb);
  else { await restoreBeacon(tx, wb); await resetSequences(tx); }
}, { timeout: 300_000 });
```

### Beacon restore: default password

All imported users get `beacon2026!` (`BEACON_DEFAULT_PASSWORD` exported from `backup.js`).

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

| Beacon key | beacon2026 column |
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

[↑ Back to top](#contents)

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

[↑ Back to top](#contents)

---

## 11. Frontend UI patterns

### Tailwind CSS (v3, adopted March 2026)

No custom CSS classes. Infrastructure:
- `frontend/tailwind.config.js` — content: `./index.html`, `./src/**/*.{js,jsx}`
- `frontend/postcss.config.cjs` — `.cjs` because `package.json` has `"type": "module"`
- `frontend/src/index.css` — `@tailwind` directives + background-image rule + theme CSS

Design decisions:
- Clean slate/blue palette (not old Beacon yellow/grey)
- Mobile tables: horizontal scroll (`overflow-x-auto` + `min-w-max`)
- Mobile home menu: single-column stacked; desktop `md:` 5-column grid

**Exception**: RoleEditor privilege matrix keeps Beacon colours:
`#ffffcc`/`#f0f0f0` rows, `#0000cc` resource text, `#e08000` save button.

### Shared UI primitives — `components/ui/`

**For new code, prefer these shared primitives over local class definitions:**

- `import Button from '../../components/ui/Button.jsx'` — `<Button variant="primary">` /
  `"danger"` / `"dangerOutline"` / `"secondary"` / `"success"`, sizes `"sm"` / `"default"` / `"lg"`
- `import { inputCls, inputErrCls, labelCls } from '../../components/ui/Input.jsx'` —
  use with `<input className={inputCls} />`

Existing files still use local `const inputCls` / `const btnCls` definitions — adopt
the shared versions incrementally when touching a file for other reasons.

### Shared hooks & helpers (deduplication, ImprovementPlan Chunk 8)

**Prefer these over re-implementing the same boilerplate inline:**

- `useAsyncLoad(loader, deps, { initialData, immediate })` — `hooks/useAsyncLoad.js`.
  Replaces the `data`/`loading`/`error` + `useEffect`/`load()` pattern. Returns
  `{ data, setData, loading, setLoading, error, setError, reload }`. `reload()` is
  memoised on `deps` and safe to call from handlers; it also returns the resolved
  value. Use `{ immediate: false }` for token-gated/on-demand loads. **Note:** it
  only suits *single-payload* loaders — pages that fan out several `Promise.all`
  loads into different state, or that re-fetch on a button using current filter
  values (e.g. `EmailDelivery`, `FinanceLedger`, `MemberList`), are deliberately
  left as hand-rolled effects because the memoised `reload` would capture stale
  filter state.
- `lib/dateFormatters.js` — all date/time display formatters. `fmtDate` (dd/mm/yyyy,
  optional `empty` placeholder), `fmtDateLong` ("Sun 5 Jan 2026"), `fmtDateMonth`,
  `fmtDateFullMonth`, `fmtDateUTC`, `fmtDateWeekdayNumeric`, `fmtTime` (HH:MM),
  `fmtTime12` ("2.30 pm"), `fmtTimestamp`, `fmtDateTime`, `fmtDateTimeSeconds`, plus
  `MONTHS_SHORT`/`MONTHS_FULL`/`WEEKDAYS_SHORT`. Pages alias on import where the
  local name differs (e.g. `import { fmtDateLong as fmtDate }`). `AuditRecord`'s
  short-month-with-seconds format is intentionally still local (unique, not a dup).
- `components/FormError.jsx` — `<FormError error={fieldErrors.x} />` (default) or
  `size="xs"`. Renders nothing when `error` is falsy. Errors are flat
  `{ field: 'msg' }` objects; pairs with `lib/scrollToError.js`.
- `lib/storageKeys.js` — every sessionStorage/localStorage key (`SS_*` / `LS_*`).
  Import the constant rather than the literal — several keys are written and read
  across different files. `CONSENT_GATED_LOCAL_KEYS` lists the consent-gated
  localStorage keys for cookie-withdrawal cleanup.
- `lib/routes.js` — `ROUTES` for the handful of frequently cross-referenced
  navigation targets (`EMAIL_COMPOSE`, `LETTERS_COMPOSE`, `FINANCE_ACCOUNTS`,
  `MEMBERS`, `HOME`). The full route table stays in `App.jsx`. Privilege strings
  are deliberately **not** centralised — `can('resource', 'action')` reads fine and
  hoisting ~90 call sites adds indirection for no real safety gain.
- `lib/a11y.js` — `clickableKeyProps(onActivate)` returns the
  `{ role:'button', tabIndex:0, onClick, onKeyDown }` bundle that makes a
  non-button element (a `<th>` or `<span>` used as a sort control) keyboard
  operable: it activates on Enter/Space and `preventDefault`s the Space-scroll.
  Used by `SortableHeader` (which also sets `aria-sort`) and the inline
  forename/surname split headers. Reach for this instead of a bare `onClick` on
  any clickable non-button.

### Frontend test patterns (Chunk 11)

- `__tests__/testUtils.jsx` — shared render boilerplate: `renderWithRouter(ui, { route })`,
  `renderAtRoute(ui, { path, route })` (for `useParams` editor pages), and an
  `authValue(overrides)` factory for `useAuth` mocks. **`vi.mock(...)` itself
  cannot be centralised** — Vitest hoists each `vi.mock` to the top of its own
  test file and scopes it per module path, so the per-file `vi.mock('../lib/api.js', …)`
  blocks stay in each test. To assert on a mocked API call, declare a top-level
  `const api = { create: vi.fn(), … }` and have the `vi.mock` factory delegate to
  it (`create: (...a) => api.create(...a)`) — the factory may not reference
  outer `vi.fn()`s directly, but it may call through at runtime.
- Interaction tests follow `CookieConsent.test.jsx`: render → `fireEvent.change`
  the labelled inputs (use `getByLabelText` now that the label sweep associates
  them) → click the submit button → `await waitFor(() => expect(api.x).toHaveBeenCalledWith(…))`.
- `__tests__/setup.js` stubs `window.scrollTo` and `Element.prototype.scrollIntoView`
  (unimplemented in jsdom) so form-submit handlers that scroll-to-top/error don't
  emit "Not implemented" noise.

### Common Tailwind patterns

- Input: `border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500` (or `inputCls` from `components/ui/Input.jsx`)
- Primary button: `bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded px-5 py-2 text-sm font-medium transition-colors` (or `<Button>` from `components/ui/Button.jsx`)
- Destructive button: `border border-red-300 text-red-600 hover:bg-red-50 rounded px-5 py-2 text-sm` (or `<Button variant="dangerOutline">`)
- Table rows: `i % 2 === 0 ? 'bg-yellow-50' : 'bg-white'` with `bg-slate-50` header
- Content cards: `bg-white/90 rounded-lg shadow-sm p-4 sm:p-6`
- Labels: `block text-sm font-medium text-slate-700 mb-1`
- Responsive grids: always `grid-cols-1 sm:grid-cols-2`, never bare `grid-cols-2`
- Error text: `text-sm text-red-600 mt-1 font-medium`
- Error banner: `rounded-md bg-red-50 border border-red-300 px-4 py-3 text-red-700 text-sm font-medium text-center`

### Display preferences — text size & colour theme

User-selectable via Personal Preferences page (doc 9.1). Stored in localStorage
(`beacon2026_prefs`). Architecture:

- `usePreferences.js` — `textSize` and `colorTheme` fields alongside existing prefs
- `App.jsx` — `useEffect` sets `data-theme` and `data-text-size` on `<html>`;
  listens for `beacon2026-prefs-changed` custom event for same-tab updates
- `index.css` — CSS rules scoped to `html[data-theme="..."]` / `html[data-text-size="..."]`

Text sizes: `small` (0.875rem), `normal` (1rem), `large` (1.125rem), `xlarge` (1.25rem).
Themes: `default`, `high-contrast`.

### Shared components

- `BeaconLogo` — SVG logo used on login, portal, and public pages
- `PageHeader` — logo + tenant name + version (`text-xl sm:text-4xl`)
- `NavBar` — glass-effect backdrop, blue links, `–` separator. Accepts `links` prop (not `items`)
- `SortableHeader` + `useSortedData` — sortable columns with ▲/▼/⇅ indicator
- `DateInput` — UK dd/mm/yyyy display, ISO value, calendar picker button
- `RequiredMark` — red asterisk for mandatory form fields (`<span className="text-red-500 ml-0.5">*</span>`)
- `FormError` — inline field validation message (`<FormError error={errors.x} />`, `size="sm"`/`"xs"`)
- `RecordTimestamp` — "created / last changed" line (uses `fmtTimestamp` from `lib/dateFormatters.js`)
- `NavBar` — glass-effect backdrop, blue links, `–` separator. Accepts `links` prop (not `items`).
  Each link: `{ label, to, disabled? }`. When `disabled: true`, shown as greyed-out non-clickable
  text — use for privilege-gated links (e.g. `{ label: 'Add New', to: '/members/new', disabled: !can('member_record', 'create') }`).
- `ScrollButtons` — dual fixed-position scroll-to-top/bottom buttons (doc 6 "Table Lists").
  Pass `containerRef` (a ref to the table wrapper div). Only appears when the container
  overflows the viewport. Used on 12 list pages.
- `RecordTimestamp` — standard "X record created …; last changed …" display.
  Props: `label` (e.g. "Group record"), `createdAt`, `updatedAt`, optional `className`.
  Used on MemberEditor (member + address) and GroupRecord (group details).
  Style: `text-xs text-slate-500 text-center`.
- `NoEmailIcon` — SVG envelope with red strike-through for members without email.
- `GoToMemberButton` — small "..." button that navigates to a member's record; renders
  `null` when no `memberId` provided. Used for quick navigation from contexts like partner
  linking.
- `EntityBulkActions` / `EntityAddMembers` — the "Do with selected" bulk-action bar
  (+ download field picker) and the "Add a member" panel, extracted from
  `EntityMembers.jsx` (ImprovementPlan Chunk 10). Presentation only — all state and
  handlers are passed in as props; the data and logic still live in `EntityMembers`.

### MemberEditor extracted modules (Chunk 10)

`pages/members/MemberEditor.jsx` was split (extraction only):
- `memberEditorUtils.js` — pure helpers/constants (`todayIso`, `computeNextRenewal`,
  `BLANK_FORM`, `TITLES`).
- `memberEditorStyles.js` — shared Tailwind class strings (`INPUT_CLS`, `INPUT_ERR_CLS`,
  `LABEL_CLS`, `SECTION_CLS`). The parent keeps its local `inputCls`/`labelCls`/etc.
  aliases pointing at these so existing JSX references were untouched.
- `MemberLedgerSection.jsx` — the read-only Groups/Teams/Ledger block (props:
  `ledgerLoading`, `memberGroups`, `memberTxns`, `can`).
- `MemberPhotoSection.jsx` — the photo upload/preview block; upload state and handlers
  stay in the parent and are passed as props.

### GroupRecord / TeamRecord tab components (Chunk 10)

`GroupRecord.jsx` and `TeamRecord.jsx` are now thin tab-routing shells. Their Details
and Ledger tabs live in their own files and are self-contained (own state/data
loading; props are just `groupId`/`teamId` and `onSaved`/`onDeleted` callbacks):
- `groups/GroupDetails.jsx`, `groups/GroupLedger.jsx`
- `teams/TeamDetails.jsx`, `teams/TeamLedger.jsx`

The Members tab still uses the shared `EntityMembers`, and Group events use the shared
`Schedule` component.

### Calendar extracted modules (Chunk 10)

`pages/calendar/Calendar.jsx` keeps the filter form and "other"-mode event management,
but the two big read-only event tables are now their own components, each handling its
own loading/empty/populated states:
- `calendar/CalendarMonthTable.jsx` — props `{ events, loading, showDetail }`.
- `calendar/CalendarFlatTable.jsx` — props `{ rows, loading, sortKey, sortDir, onSort }`
  (the parent still computes the sort via `useSortedData`).
- `calendar/calendarUtils.js` — pure `defaultFrom`/`defaultTo`/`googleMapsUrl`.

### Mandatory field indicator (`RequiredMark`)

Standard: `<RequiredMark />` from `frontend/src/components/RequiredMark.jsx`.
Renders `<span className="text-red-500 ml-0.5" aria-hidden="true">*</span>`.

Usage: `<label>Surname <RequiredMark /></label>`

All existing forms have been migrated to use this component:
JoinForm, PortalRegister, GroupRecord, Schedule, EventRecord, Calendar,
VenueEditor, TransactionEditor, TransferMoney, TransactionRefund, MemberEditor.

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
navigate on save/cancel. **This includes new-record creation flows** — `markClean()` must
be called before `onSaved()` / `navigate()` even for new records, not only for edits. Currently on: MemberEditor, SystemSettings, TransactionEditor,
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

[↑ Back to top](#contents)

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

Prefer the shared factory helpers in `__tests__/mocks.js` (added in Chunk 7 of
the 2026-06 improvement work, archived at `docs/history/ImprovementPlan.md`)
over re-writing the db/redis/audit mock objects by
hand. vitest hoists `vi.mock(...)` *and* the imports it references, so calling a
factory inside the mock factory is safe:

```js
import { dbMock, redisMock, auditMock } from './mocks.js';

vi.mock('../utils/redis.js', () => redisMock());
vi.mock('../utils/db.js', () => dbMock());          // add prisma models via dbMock({ prisma: {...} })
vi.mock('../utils/audit.js', () => auditMock());

tenantQuery.mockResolvedValueOnce([...]); // mock each DB call in order
```

`dbMock({ prisma: { sysTenant: { findUnique: vi.fn() } } })` merges extra prisma
models into the default stub; pass top-level extras (e.g. `$queryRawUnsafe`) the
same way. `passwordMock()` covers `hashPassword`/`verifyPassword`/`generateToken`/
`hashOpaqueToken`. The older hand-written `vi.mock('../utils/db.js', () => ({ ... }))`
form still works and remains in many files — there is no need to migrate them all.

### Gotcha: adding an export to a module a test file fully mocks

When a route imports a *new* function from a service module (e.g. `auth.js`
importing `issueRefreshToken` from `authService.js`), any test file that does
`vi.mock('../services/authService.js', () => ({ loginUser: vi.fn(), ... }))`
by hand (not via a factory) must add the new export to that literal object too
— otherwise the route calls `undefined(...)`, throws, and the request fails
with a 500 that has nothing to do with the actual change. Worse, if the test
had already queued `tenantQuery.mockResolvedValueOnce(...)` calls for that
request and the handler throws before consuming all of them, the leftover
queued value bleeds into the *next* test and produces a confusing, unrelated
failure (e.g. a "returns 400" test suddenly getting a 404 because it received
another test's queued mock). If a supertest assertion fails with a status code
that doesn't match the scenario being tested, check whether an earlier test in
the same `describe` left mock calls unconsumed before debugging the route logic
itself. (Hit in `auth.test.js` 2026-08-01 when adding `issueRefreshToken`.)

### SQL is exercised only by E2E (T4)

Because backend unit tests mock `tenantQuery`/`prisma` wholesale, **no SQL is
ever executed against a real database in CI** — the unit suite verifies routing,
auth/privilege guards, Zod validation, status codes, and response shaping, but
the SQL strings themselves are never run. Real SQL regressions (column renames,
cast errors, join mistakes) are caught only by the Playwright E2E suite running
against staging. When changing a query in a way the unit mocks can't see, lean on
E2E (or a manual check against a real backend) rather than assuming green unit
tests mean the query is correct.

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

[↑ Back to top](#contents)

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

[↑ Back to top](#contents)

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

[↑ Back to top](#contents)

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

[↑ Back to top](#contents)

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
   from year-start settings, creates member with **Applicant** status, generates a
   `payment_token` (stored on the member), calls PayPal stub, returns
   `{ paymentId, redirectUrl, memberId, paymentToken, className }`
3. Frontend navigates to **JoinPending** page (not directly to PayPal). This shows:
   - Application summary (name, membership number, class, amount)
   - **Pay Now** button → redirects to PayPal (or stub)
   - Bookmarkable **resume-payment URL** (`/public/:slug/resume-payment/:token`)
   - **Email me this link** button → calls `POST /:slug/email-payment-link`
4. `POST /:slug/payment-confirm` — verifies payment via stub, updates status to **Current**,
   clears `payment_token`, creates finance transaction (PayPal account + Membership category),
   sends confirmation email to member + notification to officers with `notify_online_join = true`

### Unpaid application (Applicant who hasn't paid)

When an applicant doesn't complete payment:
- Member record remains in DB with **Applicant** status and `payment_token` set
- The applicant can return via the resume-payment link (bookmarked or emailed)
- `GET /:slug/resume-payment/:token` — looks up Applicant by token, re-initiates PayPal,
  returns payment details for the **ResumePayment** page
- `POST /:slug/email-payment-link` — sends the resume-payment URL to the applicant's
  email using the `online_join_payment_link` system message template
  (supports `#PAYMENTLINK` token in addition to standard member tokens)

### Admin-created Applicants (Add Member without payment)

When an admin adds a new member via MemberEditor **without entering payment details**,
the backend automatically:
1. Switches the member's status from "Current" to "Applicant"
2. Generates a `payment_token` on the member record
3. Returns `paymentToken` in the API response

The frontend detects this and prompts the admin: "Would you like to email them a
payment link?" — if accepted, calls `POST /public/:slug/email-payment-link` to send
the resume-payment URL. The member can then pay online via the same resume-payment
flow used by online applicants.

**Admin cleanup:** Administrators can filter the Members List by "Applicant" status
to see unpaid applications, then open individual records and use the Delete button
(`member_record:delete` privilege required). No automatic cleanup — this is intentional
so admins retain control.

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
  `online_join_payment_link` (supports `#PAYMENTLINK` extra token),
  `gift_aid_payment`, `online_renewal_confirm`, `card_replacement_confirm`,
  `home_page_notice` (body only, no subject)

### Public Links (admin page)

- Backend: `publicLinks.js` at `/public-links`; privileges `public_links:view/change`
- Frontend: `PublicLinks.jsx` at `/public-links` — five sections per doc 9.4:
  (a) Member Services URLs (join, portal)
  (b) Public Information URLs (groups list, calendar — pages not yet built)
  (c) Configure Members Portal toggles (renewals, groups, calendar, personal details, replacement card)
  (d) Configure Group Information grid (status/venue/contact/detail/enquiries/joinGroup × members/public)
  (e) Configure Calendar grid (venue/topic/enquiries/detail/download × members/public)
- Reads from `tenant_settings`: `online_joining_enabled`, `privacy_policy_url`,
  `portal_config` (JSONB), `group_info_config` (JSONB), `calendar_config` (JSONB)

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
| `JoinPending.jsx` | `/public/:slug/join-pending` | Waiting for payment; shows Pay Now + resume link |
| `ResumePayment.jsx` | `/public/:slug/resume-payment/:token` | Resume unpaid application |
| `PortalForgotPassword.jsx` | `/public/:slug/portal/forgot-password` | Request reset link |
| `PortalResetPassword.jsx` | `/public/:slug/portal/reset-password` | Set new password |
| `PortalHome.jsx` | `/public/:slug/portal/home` | Portal dashboard with feature links |
| `PortalGroups.jsx` | `/public/:slug/portal/groups` | View/join/leave groups (doc 10.2.2) |
| `PortalCalendar.jsx` | `/public/:slug/portal/calendar` | Calendar view with filters (doc 10.2.3) |
| `PortalPersonalDetails.jsx` | `/public/:slug/portal/details` | Edit details, photo, password (doc 10.2.4) |
| `PortalRequestCard.jsx` | `/public/:slug/portal/request-card` | Request replacement card (doc 10.2.5) |

### API client (`api.js`)

- `systemMessages.list()`, `systemMessages.update(id, data)` — authenticated
- `publicLinks.get()`, `publicLinks.update(data)` — authenticated
- `publicApi.*` — direct fetch (no auth token): `getJoinConfig`, `submitJoin`,
  `confirmPayment`, `portalRegister`, `portalVerifyEmail`, `portalLogin`,
  `portalForgotPassword`, `portalResetPassword`
- `portalApi.*` — portal JWT auth: `getHome`, `getGroups`, `joinGroup`, `leaveGroup`,
  `getCalendar`, `downloadCalendarPdf`, `getPersonalDetails`, `updatePersonalDetails`,
  `changePassword`, `uploadPhoto`, `deletePhoto`, `getPhotoBlob`, `requestCard`

[↑ Back to top](#contents)

---

## 17. Calendar module

### Data model

Non-group events reuse the `group_events` table with `group_id = NULL`.
The `group_id` column was made nullable via `ALTER TABLE ... ALTER COLUMN group_id DROP NOT NULL`
in `tenant_schema.sql`. No separate table is needed.

Each non-group event has an `event_type_id` FK referencing the `event_types` table.
The `event_types` table has: `id`, `name` (unique), `description`, `is_default`,
`created_at`, `updated_at`. A default "Open Meetings" type is seeded automatically
and protected from rename/delete (`is_default = true`).

On startup, existing non-group events without an event_type_id are auto-migrated
to the default event type.

### Backend routes (`backend/src/routes/calendar.js`)

| Route | Privilege | Purpose |
|-------|-----------|---------|
| `GET /calendar/events` | `calendar:view` | List all events across groups + non-group events; filters: `from`, `to`, `memberId`, `venueId`, `groupId`, `eventTypeId` |
| `GET /calendar/events/pdf` | `calendar:download` | Same filters, returns PDF download |
| `GET /calendar/members/search` | `calendar:view` | Member name search for filter autocomplete (`?q=...`, min 2 chars, limit 20) |
| `GET /calendar/event-types` | `calendar:view` | List event types for calendar dropdown |
| `GET /calendar/open-events` | `meetings:view` | List non-group events (group_id IS NULL); filter by `eventTypeId` |
| `POST /calendar/open-events` | `meetings:create` | Create non-group event(s) with recurrence; includes `eventTypeId` |
| `PATCH /calendar/open-events/:id` | `meetings:change` | Update single non-group event; includes `eventTypeId` |
| `DELETE /calendar/open-events` | `meetings:delete` | Bulk delete by ids array |

### Backend routes (`backend/src/routes/eventTypes.js`)

| Route | Privilege | Purpose |
|-------|-----------|---------|
| `GET /event-types` | `event_types:view` | List all event types (ordered by is_default DESC, name) |
| `POST /event-types` | `event_types:create` | Create event type (name required, description optional) |
| `PATCH /event-types/:id` | `event_types:change` | Update event type (default cannot be renamed) |
| `DELETE /event-types/:id` | `event_types:delete` | Delete event type (default cannot be deleted, types with events cannot be deleted) |

### Frontend pages

| File | Route | Description |
|------|-------|-------------|
| `frontend/src/pages/groups/Calendar.jsx` | `/calendar` | Main calendar view with filters (All / Group-Team / Own / Other); "Other" mode embeds full event management for selected event type |
| `frontend/src/pages/groups/EventRecord.jsx` | `/calendar/events/:eventId` | Event Record page with Details/Members/Financials tabs |
| `frontend/src/pages/settings/EventTypeList.jsx` | `/event-types` | Event types CRUD settings page (inline edit, default type protection) |

### Components

| File | Description |
|------|-------------|
| `frontend/src/components/EventMembers.jsx` | Event Members tab — add/remove members, organiser toggle, copy-from-group, download PDF |
| `frontend/src/components/EventFinancials.jsx` | Event Financials tab — summary cards (income/costs/net/count) + transaction lists |

### Database tables

- `event_members` — junction table linking `group_events` ↔ `members` with `is_organiser` boolean and notes; CASCADE on event delete, CASCADE on member delete
- `transactions.event_id` — nullable FK to `group_events`; ON DELETE SET NULL (preserves financial records when event deleted)

### Privileges

- `calendar` resource: `[view, download]` — already seeded in `privilegeResources.js`
- `meetings` resource: `[view, create, change, delete]` — already seeded
- `event_types` resource: `[view, create, change, delete]` — seeded for settings page
- `event_attendance` resource: `[view, change, download]` — manages who's registered for events
- `event_finance` resource: `[view]` — viewing per-event financial summary
- Calendar and meetings granted to Administration, Groups Coordinator, and Group Leaders roles
- Event types granted to Administration role
- Event attendance: Administration (all), Groups Coordinator (all), Group Leaders (view+change)
- Event finance: Administration, Groups Coordinator, Treasurer (view only)

### Key decisions

- **Shared event-filter builders** — `backend/src/utils/eventFilters.js` exports
  `buildCalendarEventFilters(query)` (used by all three `calendar.js` event
  endpoints: list / pdf / excel) and `buildPortalCalendarFilters(query, memberId)`
  (used by both `portal.js` calendar endpoints: view / pdf). Each returns
  `{ where, params }` and validates the query string with Zod, so a malformed
  `from`/`to` returns 422 at the edge rather than 500-ing on the `::date` cast.
  Note the PDF/Excel handlers still read `req.query.from`/`to` separately, purely
  for the report's title label. Added in ImprovementPlan Chunk 6 (N1, N3).
- **Non-group events** share the `group_events` table (nullable `group_id`) rather than a separate table
- **Event types** are a single flexible system — no per-type privileges
- **Calendar "Other" mode** embeds event management inline rather than a separate page
- **Calendar "Group/Team" mode** combines groups and teams in a single dropdown
- **Default event type** ("Open Meetings") is protected: cannot be renamed or deleted
- **ON DELETE RESTRICT** on event_type_id FK prevents deleting types that have events
- **Member filter** uses search/autocomplete (not dropdown) for scalability with large memberships
- **Date/time click** in calendar navigates to Event Record page (`/calendar/events/:eventId`)
- **Map links** use Google Maps (`google.com/maps/search/?api=1&query=POSTCODE`)
- **Portal Calendar** also has "Other" filter with event type dropdown
- **Data export/restore** includes Event Types sheet, Event Members sheet, and event_type_id/event_id on Group Events/Ledger sheets
- **event_members is independent of group_members** — "Copy from group" is a one-time snapshot, not a live link
- **Transaction event_id** — mirrors existing `group_id` FK pattern; search-as-you-type in TransactionEditor
- **Feature toggle** — `eventAttendance` sub-feature under Events section; controls Members tab visibility
- **Event Record visual distinction** — the page carries a small uppercase
  "EVENT" eyebrow label above the title so it is not confused with a Group
  or Team record (which share the same centred-title / tab layout). NavBar
  uses the standard "Home – Events – {Group}" pattern. The
  `RecordTimestamp` footer sits under the tab panel and renders on every
  tab (must be passed `label`, `createdAt`, `updatedAt` — not `created` /
  `updated`).

### Deferred items (in KNOWN-ISSUES.md)

- Real PayPal API integration
- Shared email handling in portal registration

[↑ Back to top](#contents)

---

## 18. Membership Cards (doc 4.7)

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
- ~~Members Portal "Order a replacement card" (doc 10.2.5)~~ — **Done.** Implemented as
  `PortalRequestCard.jsx`; backend route `POST /portal/request-card` in `portal.js`

[↑ Back to top](#contents)

---

## 19. Letters module (docs 6.2, 6.2.1, 6.2.2)
### Overview

Letters are one-page personalised documents generated as a PDF (one page per member).
They use the same token system as emails (`#FORENAME`, `#SURNAME`, `#ADDRESSV`, etc.)
and support standard letter templates for reuse.

### Data model

- `standard_letters` table: `id`, `name` (UNIQUE), `body` (TipTap JSON string),
  `owner_group_id` (nullable FK to `groups.id`, `ON DELETE SET NULL` — beacon2026
  extra, added 2026-08-04, see CLAUDE-REFERENCE §6), `created_at`, `updated_at`

### Backend routes (`/letters`)

| Method | Path | Privilege | Purpose |
|--------|------|-----------|---------|
| GET | `/standard-letters` | `letters_standard_messages:view` | List templates (all, incl. owner) |
| POST | `/standard-letters` | `letters_standard_messages_all:create` | Admin-only save/upsert; can set/reassign `owner_group_id`. Group/team-scoped create/edit goes through `groupStdMessages.js` instead |
| DELETE | `/standard-letters/:id` | `letters_standard_messages_all:delete` | Admin-only delete |
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

[↑ Back to top](#contents)

---

## 20. Password recovery and temporary passwords

### Data model

- `users.must_change_password` — `BOOLEAN NOT NULL DEFAULT false`; set to `true` on
  user creation and `set-temp-password`; cleared when the user completes the
  force-change-password flow
- `users.security_question` / `users.security_answer_hash` — used for account recovery
  (doc 9.6) and set during force-change-password (doc 4)

### Backend routes (auth.js)

- `POST /auth/recover` — step 1: identify user by `tenantSlug + forename + surname +
  postcode + email` matched against linked member record; returns `securityQuestion` if
  set, or sends recovery email directly if not; blocks site admins; always returns
  generic message to avoid user enumeration
- `POST /auth/recover/verify` — step 2: verify security answer and send recovery email;
  returns 400 with helpful message if answer is incorrect
- `POST /auth/force-change-password` — requires auth; sets new password (min 10, no
  spaces, upper+lower+number) + security Q&A; clears `must_change_password`; does NOT
  require current password
- `POST /auth/change-password` — updated to min 10 characters (was 8)
- Login (`POST /auth/login`) and refresh (`POST /auth/refresh`) both return
  `mustChangePassword` flag in response

### Frontend

- **Login.jsx** — inline expandable recovery section below login form; two-step flow
  (identify → security question → success message); inherits tenant from login form
- **ChangePassword.jsx** — `/change-password` route; amber-themed form matching doc 4
  screenshots; requires password + confirm + security Q&A; "Log out instead" option;
  Submit button disabled until all fields valid
- **AuthContext.jsx** — tracks `mustChangePassword` state; provides
  `clearMustChangePassword()` callback
- **App.jsx** — `ProtectedRoute` redirects to `/change-password` when
  `mustChangePassword` is true; `AuthRequired` wrapper for change-password route
  (requires login but not subject to the redirect)
- **PersonalPreferences.jsx** — password rules updated to min 10 chars,
  upper+lower+number required, no spaces

### Recovery email

Currently uses `console.log` (same pattern as portal password reset). The log includes
username and temp password. Production deployment will send via SendGrid.

[↑ Back to top](#contents)

---

## 21. Cookie Consent

### Architecture

Cookie consent is a **frontend-only** feature. No backend changes needed.

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useCookieConsent.js` | Consent state management — read/write consent cookie, cleanup on decline |
| `frontend/src/components/CookieConsent.jsx` | Dialog UI + gear icon to reopen |

### Cookies

| Cookie | Type | Purpose |
|--------|------|---------|
| `beacon2026_cookie_consent` | Essential | Records user's choice (`accepted` / `declined`). 365-day expiry. |
| `beacon_last_u3a` | Optional | Pre-fills u3a slug on login. Only set when consent accepted. |
| `beacon2026_refresh` | Essential | httpOnly refresh token, set by backend. Not gated by consent. |

### localStorage

All optional localStorage keys are only read/written when `hasOptionalCookieConsent()` returns true.
When consent is declined, preferences still work using in-memory defaults for the session.
All keys are removed in `useCookieConsent.js → setConsent(false)`.

| Key | Purpose |
|-----|---------|
| `beacon2026_prefs` | Display preferences (sort, format, timeout, text size, theme) |
| `beacon2026_label_settings` | Label printing layout (cols, rows, dimensions, offsets, font size) |
| `beacon2026_last_export_class` | Last membership class selected on Addresses Export page |
| `beacon2026_email_compose_prefs` | Email compose From address and copy-to-self preference |
| `beacon2026_tam_submission` | TAM export: last selected Status and Class filters |

### Integration points

- **Login.jsx** — `getLastU3aCookie()` and `setLastU3aCookie()` check consent before reading/writing
- **AuthContext.jsx** — `getLastU3aCookie()` for session restoration checks consent
- **usePreferences.js** — `load()` and `save()` gated behind consent
- **App.jsx** — `<CookieConsent />` rendered alongside `<RouterProvider />`

All eight optional cookie items are now fully implemented — see `KNOWN-ISSUES.md`
Cookie Consent section for confirmation.

[↑ Back to top](#contents)

---

## 22. Custom Fields

### Data model

- `tenant_settings.custom_field_label_1` through `_4` — TEXT columns storing the admin-defined
  labels for each custom field. When blank, the field is hidden on the member record.
- `members.custom_field_1` through `_4` — TEXT columns (max 60 chars) storing per-member values.

### Backend routes (`customFields.js` at `/custom-fields`)

| Route | Privilege | Purpose |
|-------|-----------|---------|
| `GET /custom-fields` | `custom_fields:view` | Returns current labels |
| `PATCH /custom-fields` | `custom_fields:change` | Updates labels |

### Frontend

- `CustomFields.jsx` at `/custom-fields` — admin page to define up to 4 free-form field labels
- `MemberEditor.jsx` — renders custom fields dynamically when labels are set

[↑ Back to top](#contents)

---

## 23. Gift Aid Log

### Backend

- `GET /gift-aid/log?from=&to=&memberId=` in `giftAid.js` — queries audit trail for
  `gift_aid_consent` and `gift_aid_withdrawn` actions; privilege `gift_aid_declaration:view`
- Returns up to 500 entries within date range, optionally filtered by member

### Frontend

- `GiftAidLog.jsx` at `/gift-aid-log` — date-filtered table showing when Gift Aid consent
  was given or withdrawn; member dropdown filter; columns: Date, Member, Action, By

[↑ Back to top](#contents)

---

## 24. Help Widget (Zendesk Web Widget)

### Architecture

- **HelpWidget.jsx** (`frontend/src/components/HelpWidget.jsx`) — Loads the Zendesk
  Web Widget SDK script dynamically and provides context-sensitive help on every screen.
- Rendered via a `RootLayout` component in `App.jsx` that wraps all routes with
  `<Outlet />` + `<HelpWidget />`.
- The widget is positioned bottom-left, matching the original Beacon layout.

### Configuration

- Requires `VITE_ZENDESK_KEY` environment variable set to the Zendesk widget key.
- When the key is absent, the widget is silently disabled (no errors).
- Help center URL: `https://u3abeacon.zendesk.com/hc/en-gb/categories/360001240017-User-Guide`

### Context-sensitive suggestions

- A `ROUTE_HELP_TERMS` mapping in `HelpWidget.jsx` maps route path prefixes to
  Zendesk search terms (e.g. `/members` → `'members list search'`).
- On each route change, `zE('webWidget', 'helpCenter', 'setSuggestions', ...)` is
  called to update the "Top suggestions" shown in the widget.
- More specific routes must appear before general ones in the mapping array
  (first `startsWith` match wins).

### Adding help terms for new pages

When adding a new page/route, add a corresponding entry to `ROUTE_HELP_TERMS` in
`HelpWidget.jsx` with appropriate Zendesk search terms.

[↑ Back to top](#contents)

---

## 25. Feature Toggles

Per-tenant feature configuration allowing each u3a to choose which modules are active.

### Storage

Single JSONB column `feature_config` on `tenant_settings` (singleton row). Uses an
**opt-out model** where most missing keys default to `true` (on). Four features default
to `false` (off) when never set: `giftAid`, `groupLedger`, `siteworks`, `publicApi`.
See "Default-off features" below.

### Toggle inventory (26 toggles)

**Master toggles (6):** `groups`, `finance`, `email`, `portal`, `onlineJoining`, `events`

**Membership sub-features (6):** `membershipCards`, `membershipRenewals`,
`giftAid` (default off), `customFields`, `polls`, `memberPhotos`

**Groups sub-features (5):** `teams`, `venues`, `faculties`, `groupLedger` (default off),
`siteworks` (default off)

**Events sub-features (2):** `eventTypes`, `eventAttendance`

**Finance sub-features (5):** `creditBatches`, `reconciliation`, `financialStatement`,
`groupsStatement`, `transferMoney`

**Communications:** `letters` (compose/print PDF — no SendGrid dependency)

**Other (3):** `reports` (SQL Reports), `publicPages` (Public Groups/Calendar),
`publicApi` (public read API at `/api/v1` — **default off**, see §27)

All toggles are backend-enforced. Route files call `requireFeature(key)` (after
`requireAuth`) or `isFeatureEnabled(slug, key)` for pre-auth public routes. A
dedicated unit test lives at `backend/src/__tests__/requireFeature.test.js`;
individual route tests get a pass-through mock of this middleware from
`setup.js`.

### System-admin-only toggles

`finance`, `email`, `portal`, `onlineJoining` — these require external service setup
(SendGrid, PayPal, etc.). Backend enforces this: `SYS_ADMIN_ONLY_KEYS` in
`backend/src/routes/settings.js` strips these from non-sys-admin PATCH requests.

### Key files

| File | Role |
|------|------|
| `backend/prisma/tenant_schema.sql` | `feature_config JSONB` column |
| `backend/src/routes/settings.js` | `GET/PATCH /settings/feature-config` |
| `backend/src/middleware/requireFeature.js` | Route-level enforcement middleware |
| `backend/src/seed/privilegeResources.js` | `feature_config` privilege resource |
| `frontend/src/context/AuthContext.jsx` | `hasFeature()`, `refreshFeatureConfig()` |
| `frontend/src/pages/settings/FeatureConfig.jsx` | Config page with expandable sections |
| `frontend/src/pages/Home.jsx` | Menu filtering via `hasFeature()` |
| `frontend/src/App.jsx` | `FeatureRoute` / `PF` route guards |

### Default-off features

Four features default to **off** when their key is missing from `feature_config`:
`giftAid`, `groupLedger`, `siteworks`, `publicApi`. Both `hasFeature()` and
`requireFeature()` use the `FEATURE_DEFAULTS_OFF` set for these. All other features
default to on (opt-out model).

If you add a new feature that should default to off, add it to
`FEATURE_DEFAULTS_OFF` in **`shared/constants.js`** — the single source of truth.
Backend (`requireFeature.js`) and frontend (`AuthContext.jsx`, via
`frontend/src/lib/constants.js`) both import it, so one edit covers both.
(This note previously said to edit two separate copies; they were consolidated
into `shared/constants.js` and no duplicate set remains.)

### Parent dependency chain

Sub-features have a parent master toggle (defined in `FEATURE_DEPS` maps in both
`AuthContext.jsx` and `requireFeature.js`). When a master is off, all its dependents
are treated as off. If you add a new sub-feature, add it to **both** maps.

### Frontend patterns

- `hasFeature(key)` from `useAuth()` — checks the key, its default, and its parent
- `FeatureRoute` component redirects to Home if feature is off
- `PF` shorthand = `ProtectedRoute` + `FeatureRoute`
- Home.jsx items have optional `f` property for feature key filtering
- Home.jsx sections have optional `feature` property for master toggle filtering
- Home.jsx items are also filtered on privilege (`item.to` is `null` when `can()`
  is false) — `visibleSections` drops any item without a route entirely, so
  menu options the user has no privilege for are omitted, not shown greyed
  out. Fixed 2026-08-02 (see CHANGELOG); previously the item still rendered
  as a disabled `<span>`.
- Group/Team record tabs use `hasFeature()` for Schedule (`events`) and Ledger (`groupLedger`)

### Backend patterns

- `requireFeature(key)` middleware — checks key, its default, and its parent (auth routes)
- `isFeatureEnabled(slug, key)` async helper — same logic, for use in public/portal routes
  that don't have `req.user` (both exported from `requireFeature.js`)
- Feature config is fetched by frontend on login and session restore
- `refreshFeatureConfig()` re-fetches after saving changes

### Unified toggles

Several settings that previously lived as columns in `tenant_settings` have been
unified onto the Feature Configuration page. The DB columns remain for backward
compatibility (backup/restore) but are no longer read at runtime:

| Old column | Feature key | Notes |
|---|---|---|
| `siteworks_activated` | `siteworks` | Group scheduling fields |
| `gift_aid_enabled` | `giftAid` | Gift Aid across the system (`gift_aid_online_renewals` stays in System Settings as a sub-option) |
| `online_joining_enabled` | `onlineJoining` | Public join form |
| (none — new) | `portal` | Master on/off for all portal routes (portal_config sub-toggles remain) |

### System Dashboard integration

System admins can view/edit any tenant's feature config via:
- `GET /system/tenants/:slug/feature-config` — returns JSONB
- `PATCH /system/tenants/:slug/feature-config` — merges updates, no sys-admin-only restriction
- Frontend: "Features" button on each tenant row opens a modal with all toggles

### Confirmation dialogs

Turning off a master toggle shows a confirmation dialog (FeatureConfig.jsx).
The `onConfirmMasterOff` callback is passed to `FeatureSection`; the parent
component manages the `confirmOff` state and renders the modal.

### Backup / restore

`feature_config` is included in the "Site Settings 1" sheet of the backup export
and restored by the beacon2026 restore path. Legacy Beacon restores apply
`STANDARD_IMPLEMENTATIONS[0]` from `shared/constants.js` ("Beacon Migration
Default" — all features on except SiteWorks Integration and Custom Fields),
overriding whatever happened to be on the tenant before the restore.

### Standard Beacon Implementation presets

`shared/constants.js` exports `STANDARD_IMPLEMENTATIONS`, a list of named presets
(`{ name, description, features }`) for the whole `feature_config` JSON. Each
`features` object covers every key in `ALL_FEATURE_KEYS` (the canonical 25-key
inventory, single-sourced for the UI, the sys-admin PATCH, and the per-user
PATCH allowlists). Add a preset entry here rather than hardcoding defaults in
a route handler. `restoreBeacon()` applies the first entry on legacy restores.

**Source of truth is the code** (`shared/constants.js`). The table below is a
human-readable cheat sheet of current presets and only records keys that
**differ from the "all ON" baseline** — update it in the same commit that
changes the code, but treat it as a summary, not the authority.

| # | Name | Description | Keys differing from all-ON |
|---|------|-------------|-----------------------------|
| 0 | Beacon Migration Default | All features enabled except SiteWorks Integration and Custom Fields — the recommended starting point for a u3a migrating from Beacon. | `siteworks: false`, `customFields: false` |

[↑ Back to top](#contents)

---

## 26. Deployment and Infrastructure

See `DEPLOYMENT.md` for the full step-by-step guide (written for non-technical users).
Key facts for developers:

| Component | Hosted on | Config |
|-----------|-----------|--------|
| Frontend | Vercel | Static React build (Vite), `VITE_API_URL` points to backend |
| Backend | Render (web service) | Node.js, `backend/` root dir, config in `render.yaml` |
| Database | Render (PostgreSQL) | Schema-per-tenant, `beacon2026` DB |

**Environment variables** are listed in `render.yaml` (backend) and set in the
Vercel dashboard (frontend: `VITE_API_URL`, `VITE_ZENDESK_KEY`).

**Database replacement** (e.g. free tier expiry): create a new Render PostgreSQL
instance, update `DATABASE_URL` on the backend service, and save. Auto-migration
on startup (see §1) handles the rest. Full instructions in `DEPLOYMENT.md`.

[↑ Back to top](#contents)

---

## 27. Public read API (`/api/v1`)

The **published, external** interface — as opposed to the internal API the React
frontend uses. Read `docs/API-design.md` before changing anything here; the
decisions below are not local implementation choices.

### The two rules that constrain every change

1. **v1 is a contract owned by the Third Age Trust, with six months' notice.**
   Adding a field is free. Changing a field's meaning, removing one, or altering
   a status code is a months-long process. When in doubt, leave a field out —
   the asymmetry is entirely one way.
2. **The anonymous tier can never expose more than the u3a's public web pages
   already do.** Field visibility comes from the same `group_info_config` /
   `calendar_config` toggles as the public Groups and Calendar pages, and every
   toggle defaults to not-public.

### Layout

| File | Role |
|------|------|
| `routes/api/index.js` | Version router: deprecation headers, spec, tenant resolution, `publicApi` gate, resource mounts, 404 + error handler |
| `routes/api/helpers.js` | Envelope, pagination, feature gating, visibility loading, `Deprecation`/`Sunset` |
| `routes/api/{org,faculties,venues,groups,events}.js` | One module per resource |
| `routes/api/ics.js` | The `events.ics` iCalendar feed — a second serialisation of `events.js`, not a second data source |
| `routes/api/openapi.json` | Hand-written OpenAPI 3.1, loaded via `createRequire` |
| `utils/resolveTenant.js` | Slug → tenant, shared with `routes/public/` |

### Things that will bite you

- **Mount order in `app.js` is load-bearing.** `/api/v1` is mounted *before* the
  app-wide `helmet()`, `cors()` and `generalLimiter` because it needs different
  values for all three and whichever runs first wins. Moving it below them
  silently breaks cross-origin reads. The comment in `app.js` explains each.
- **`cors({ origin: CORS_ORIGIN })` does not match the request origin** — it
  echoes the configured string to everyone, so the shared config would refuse a
  u3a's own website. `/api/v1` uses `origin: '*'`.
- **Helmet's default `Cross-Origin-Resource-Policy: same-origin`** blocks
  cross-origin reads even when CORS is correct, and fails in a way that looks
  like a CORS bug. Relaxed to `cross-origin` for this router only.
- **Everything unavailable is a 404, never a 403.** A u3a that has not enabled
  `publicApi`, a disabled module, a venue collection the u3a does not publish —
  all 404. A 403 would confirm the u3a exists and merely declined.
- **Projection functions are the only place fields are chosen.** The tests in
  `apiV1.test.js` assert the *exact key set* of each anonymous response, so a
  column added to a query cannot reach a response without a deliberate test
  change. Keep it that way — that assertion is the leak guard.
- **No member data.** There is no members endpoint in v1 and none in the spec;
  `apiV1.test.js` asserts both. Adding one is a phase-4 decision (API keys plus
  an explicit scope), not a routine change.
- **The spec cannot drift from the code.** A parity test walks the Express
  router stacks, converts `/:slug/groups/:id` to `/{slug}/groups/{id}`, and
  asserts the result equals the documented path list *both ways round* — an
  undocumented route fails, and so does a documented path that does not exist.
  A hand-written OpenAPI document is only worth having with this guard in
  place. Both it and the key-set assertions were verified red against injected
  drift on 2026-08-01; re-verify the same way if you rework them.
- **Faculties sit slightly outside the public-parity rule, deliberately.**
  They have no `group_info_config` entry, so nothing in Public Links governs
  them. They are exposed (id and name only) on the narrower ground that a
  faculty is pure taxonomy carrying no personal data. If that judgement is
  revisited, `routes/api/faculties.js` and the `faculty`/`facultyId` fields in
  `routes/api/groups.js` are the only two places to change.

### The iCalendar feed (`ics.js`)

`GET /api/v1/:slug/events.ics?group=` is the same rows as `GET /events`, put
through `calendar_config` in the same way and then serialised as RFC 5545.
**If you add a field to one, decide deliberately whether it belongs in the
other** — they are two representations of one resource, and a field that is
public in JSON but missing from the feed is a bug, not a safety margin.

- **The leak guard is `veventProps()` in `apiV1.test.js`**, which asserts the
  exact set of VEVENT property names, and a list of values that must not appear
  anywhere in the body. Same idea as the key-set assertions, different
  serialisation. Verified red on an injected `visible()` bypass.
- **`DTSTAMP`/`LAST-MODIFIED` come from the row's `updated_at`, never from the
  clock.** Using `new Date()` would change every byte of the feed on every
  request, defeating the `ETag` and making every poll a full download.
- **`UID` is `<event id>@<slug>.beacon2026` and must never change.** It is how
  a subscriber's calendar recognises an event it already has; change the recipe
  and every subscriber silently accumulates a duplicate of everything.
- **Folding is by octet, not character** (RFC 5545 says 75 octets), and
  `fold()` backs off a split that would land inside a multi-byte character. Cut
  a UTF-8 sequence in half and the subscriber sees `U+FFFD` where a dash or an
  accent should be. The test asserts both the byte limit and that unfolding
  round-trips; the round-trip half was verified red with the backoff removed.
- **The feed is bounded, not paginated** — 180 days back, no forward limit,
  5000 events. `?limit=` would be meaningless to a calendar client. Both
  numbers are in the OpenAPI description, so they are part of the contract.
- **`DTEND` is omitted when it is not strictly after `DTSTART`.** Some clients
  reject an entire calendar over one invalid event rather than skipping it.
- **Times are `TZID=Europe/London` with a `VTIMEZONE` in the file.** Floating
  times would read an hour out for a member abroad; UTC would lose the
  summer-time transition.
- **The SQL casts `event_date`, `start_time` and `end_time` to `text` and
  formats `updated_at` with `to_char`.** No `pg` type parsers are configured,
  so a `DATE` arrives as a JS `Date` at *local* midnight — fine for JSON, but a
  timezone bug waiting to happen when it is reformatted into `YYYYMMDD`.

### The consumer side lives outside this repo

The phase 2b WordPress plugin ("beacon2026 Display", proof of concept) is a
**separate repo**:
[`PeterC66/beacon2026-siteworks-plugin`](https://github.com/PeterC66/beacon2026-siteworks-plugin)
(private), cloned at `C:\Claude\beacon2026-siteworks-plugin`. It is the only
thing that consumes `/api/v1` today, so it is where a
contract change gets noticed first — if you add, rename or remove a v1 field,
check its `includes/class-b2026-render.php` before assuming nothing depends on
it. Its own README carries the setup, the test commands and the limitations;
`KNOWN-ISSUES.md` items 3–5 carry its status and the open decision about
whether it should render its own output or populate the SiteWorks post types.

It also ships `tools/fake-api.php`, a stand-in that serves the documented
envelope with real `ETag` / `304` behaviour — useful for exercising a client
against v1 without a database, while no beacon2026 instance has the API
switched on.

### Configuration

| Variable | Effect |
|---|---|
| `API_RATE_LIMIT_MAX` | Requests per 15 min per IP (default 600) |
| `API_V1_SUNSET` | ISO date; when set, sends `Deprecation: true` + `Sunset`. Unset = not deprecated (the normal state) |
| `API_V1_SUNSET_LINK` | Optional URL for the `Link: …; rel="sunset"` header |

[↑ Back to top](#contents)
