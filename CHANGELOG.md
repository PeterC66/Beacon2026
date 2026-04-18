# Beacon2 Changelog

All notable changes are documented here.
Format: `## [version] — YYYY-MM-DD` with bullet points per change.

---

## [0.9.7] — 2026-04-18

### Added
- **`CLAUDE-STANDARDS.md` — "Reports, design notes, and estimates"**
  section requiring every effort estimate in a report or design note to
  be given two ways (developer-weeks by hand; calendar time with Claude
  Code in the loop), with the basis stated and the exclusions spelled
  out
- **`docs/website-post-types-from-beacon2.md`** — design note extending
  `docs/website-editing-options.md`. Sets out what would be required for Beacon2
  to create and modify the four in-scope SiteWorks custom post-types
  (`u3a_group`, `u3a_event`, `u3a_venue`, `u3a_contact`). Records the design
  decisions taken (push-only from Beacon2; per-type plus per-post exclusion;
  Application Passwords + small companion plugin; background queue with
  "publish now"; trash on WP-side for Beacon2 deletes, reconciliation view
  for WP-side deletes), covers the backend/frontend work, the companion
  plugin, field-mapping gotchas (including `u3a_contact` privacy), the
  comparison utility, a feasibility note on one-off data load from
  SiteWorks, phased rollout with effort estimates given two ways
  (developer-weeks by hand vs. calendar time with Claude Code in the
  loop), and open risks

### Fixed
- **Security C1 — hardcoded default admin credentials removed** — `SEED_ADMIN_EMAIL`
  and `SEED_ADMIN_PASSWORD` are now required by both `backend/src/seed/index.js` and
  the automatic startup seeder in `backend/src/utils/migrate.js`. The `ChangeMe123!`
  and `admin@beacon2.local` fallbacks are gone; if no sysadmin exists and either var
  is missing the process exits with a clear error. The seed password is no longer
  echoed to stdout — only the email is printed
- **Security C2 — recovery temp password no longer logged** — `sendRecoveryEmail()`
  in `backend/src/routes/auth.js` now delivers the recovery email via SendGrid when
  `SENDGRID_API_KEY` is configured. With no key set it logs a warning naming the
  recipient only — the temporary password and email body are never written to stdout
- **Security C3 — portal & system tokens moved out of sessionStorage** — added
  module-level, in-memory token storage to `frontend/src/lib/api/portal.js` and
  `frontend/src/lib/api/system.js`, each with `set…Token / clear…Token / get…Token /
  has…Token` helpers (same pattern as the tenant `accessToken` in `core.js`).
  `PortalLogin`, `PortalHome`, `PortalRenewal`, `PortalPersonalDetails`,
  `SystemLogin`, and `SystemDashboard` now use these helpers instead of
  `sessionStorage`, so XSS can no longer exfiltrate either token. Page reload now
  clears the portal/system session — users log in again
- **Security H1 — refresh token tenant slug is now validated** —
  `refreshTokens()` in `backend/src/services/authService.js` rejects any refresh
  whose embedded `payload.tenantSlug` does not match the `x-tenant-slug` header,
  before any DB lookup. Defense-in-depth alongside the existing per-tenant
  refresh_tokens table
- **Security H2 — account lockout after repeated failed logins** — added
  `failed_login_count` and `locked_until` columns to `:schema.users` (idempotent
  ALTER applied on startup). `loginUser()` increments the counter on each wrong
  password; once it reaches `MAX_FAILED_LOGINS` (default 5) the account is
  locked for `LOCKOUT_MINUTES` (default 15). Locked accounts refuse login even
  with the correct password, without revealing whether the lock or the
  credentials caused the failure. Both env vars are tunable. Successful login
  resets the counter. Every failure and lockout is written to the tenant audit
  log via `logAudit`
- **Security H3 — Redis is now required in production** —
  `backend/src/utils/redis.js` throws on startup when `NODE_ENV=production` and
  `REDIS_URL` is missing, unless the operator has explicitly opted out with
  `USE_REDIS=false` (in which case a loud warning is logged naming the
  consequence). Without Redis, role/privilege revocation only takes effect
  after the access token expires
- **Security H5 — CORS_ORIGIN is now required in production** —
  `backend/src/app.js` throws at startup when `NODE_ENV=production` and
  `CORS_ORIGIN` is unset. Previously the cors middleware silently sent no
  headers, breaking the frontend with no diagnostic
- **Security L1 — JWT algorithm pinned to HS256** — `backend/src/utils/jwt.js`
  now passes `{ algorithm: 'HS256' }` to `jwt.sign()` and
  `{ algorithms: ['HS256'] }` to `jwt.verify()` for both access and refresh
  tokens, blocking algorithm-confusion attacks (e.g. `alg: none` swaps)
- **Security H4 — npm audit vulnerabilities cleared** — completed the
  three-pass fix started earlier in this release: (1) `npm audit fix` in
  both `backend/` and `frontend/`; (2) `bcrypt` 5 → 6 in the backend;
  (3) `vitest` 1 → 4 in the backend, and `vite` 5 → 8, `vitest` 1 → 4, and
  `@vitejs/plugin-react` bumped to the latest in the frontend. Both
  packages now report **0 vulnerabilities**. Test suites remain green
  (backend 386 / frontend 133) and `vite build` succeeds on vite 8. No
  source changes were required — the existing `vitest.config.js`,
  `vite.config.js`, and `vi` mock usage in the test suites are compatible
  with vitest 4 and vite 8 out of the box. All upgraded packages are
  `devDependencies`; nothing ships to production
- **Security M1 — CSRF protection on `/auth/refresh`** — the refresh
  endpoint now verifies the `Origin` header against `CORS_ORIGIN` before
  doing any work, and rejects mismatches with 403 `Origin not allowed.`
  Because the refresh cookie is `SameSite=none` (required for the
  Vercel→Render deployment), a cross-origin page could previously trigger
  a refresh as a side effect — rotating the legitimate cookie and causing
  a denial of service. The new check is stateless: browsers always set
  Origin on cross-origin POSTs and it cannot be forged by attacker
  JavaScript. In dev/test, requests without an Origin header (e.g.
  supertest) are allowed
- **Security M4 — payment redirect whitelist** — added
  `frontend/src/lib/safeRedirect.js` with `isSafePaymentRedirect(url)`.
  `ResumePayment.jsx` and `PortalRenewal.jsx` now validate the
  backend-supplied `redirectUrl` before navigating, allowing only
  same-origin URLs and the `paypal.com` / `sandbox.paypal.com` families
  (including `www.` hosts). Look-alike domains (`paypal.com.evil.com`,
  `evilpaypal.com`) and non-http(s) schemes (`javascript:`, `data:`) are
  blocked. Failed checks surface a user-visible error instead of
  navigating. Defence-in-depth if the backend is ever compromised or
  mis-configured
- **Security M5 — audit logging on bulk password reset** —
  `POST /system/tenants/:id/set-temp-password`, the sys-admin-only
  endpoint that resets every user's password in a tenant, now writes an
  entry to the target tenant's audit log (`action=bulk_password_reset`,
  `entity_type=tenant`, `user_name="System Admin: <name>"`, detail
  recording the affected user count). Previously this powerful operation
  left no trail in the tenant's audit view

## [0.9.6] — 2026-04-17

### Changed
- **`docs/website-editing-options.md` — effort estimates now given two ways**
  (developer-weeks by hand; calendar time with Claude Code in the loop), with
  the basis and exclusions stated above the options table. Option D entry
  cross-refers to `docs/website-post-types-from-beacon2.md` for the worked
  SiteWorks post-type case

### Added
- **`docs/website-editing-options.md`** — management-facing options document for
  enabling Beacon2 users to edit the u3a SiteWorks WordPress site. Sets out four
  integration architectures (link-out, managed WP users, SSO, embedded editor)
  and five editing tiers, with costs and trade-offs. Recommends starting with a
  link-out + WordPress Editor/Author roles for fastest, most reversible delivery

## [0.9.5] — 2026-04-16

### Fixed
- **E2E event-members tests** — replaced `selectOption({ label: RegExp })` with
  exact-string lookup (Playwright does not accept RegExp for label); fixed calendar
  event navigation to locate the table row by topic text then click the link within
  it (the `<a>` contains date/time, not the topic)

## [0.9.4] — 2026-04-15

### Fixed
- **E2E group list tests** — replaced `Date.now()` with fixed `GROUP_NAME` to
  prevent retry failures; increased visibility timeout from 6s to 15s; made
  `GroupListPage.goto()` wait for data to load before returning
- **E2E audit log date filter test** — added auto-waiting `toBeVisible()` before
  snapshot `count()` to prevent race with React rendering

## [0.9.3] — 2026-04-14

### Added
- **Shared UI primitives** (R10) — new `frontend/src/components/ui/` with `Button.jsx`
  (6 variants: primary, danger, dangerOutline, secondary, success; 3 sizes) and
  `Input.jsx` (inputCls, inputClsCompact, inputErrCls, selectCls, labelCls constants).
  Available for incremental adoption in new and existing pages
- **Backend tests for 6 routes** (R12) — `settings.test.js` (20 tests),
  `venues.test.js` (13), `eventTypes.test.js` (14), `customFields.test.js` (7),
  `addressExport.test.js` (12), `privileges.test.js` (3). Total: 69 new tests

### Changed
- **Move calendar & team pages** (R8) — moved `Calendar.jsx`, `EventRecord.jsx`,
  and `OpenMeetings.jsx` from `pages/groups/` to new `pages/calendar/` directory;
  moved `TeamList.jsx` and `TeamRecord.jsx` to new `pages/teams/` directory, so
  each page directory mirrors a single backend domain
- **Split E2E teams tests** — extracted team tests from `04-groups.spec.js` into new
  `04b-teams.spec.js` with a dedicated `TeamsPage.js` page object, matching R8's
  `pages/teams/` directory split
- **Extract shared Zod schemas** (R9) — created `backend/src/schemas/` directory with
  `common.js`, `groups.js`, and `teams.js`. Extracted 9 duplicated Zod schemas from
  `routes/groups.js` and `routes/teams.js` into shared modules, using `.extend()` for
  near-identical schemas (patchGroupMemberSchema, bulkAddToGroupSchema, bulkAddToTeamSchema).
  Net −108 lines of duplication removed

---

## [0.9.2] — 2026-04-14

### Changed
- **Dissolve misc/ directory** (R7) — relocated 7 files from `pages/misc/` to domain
  directories: `AuditLog`/`AuditRecord` to `pages/audit/`, `auditHelpers` to `lib/`,
  `DataBackup` to `pages/admin/`, `GiftAidLog` to `pages/finance/`, `OfficerList` to
  `pages/officers/`, `PublicLinks` to `pages/settings/`; updated all imports and tests
- **Lazy loading** — all 82 page components in `App.jsx` are now loaded with
  `React.lazy()` and wrapped in a `<Suspense>` boundary, reducing the initial
  bundle size by code-splitting each page into its own chunk
- **Route guard cleanup** — renamed cryptic `PF` component to `ProtectedFeatureRoute`;
  merged single-use `AuthRequired` into `ProtectedRoute` with a `skipPasswordCheck` prop
- **Split finance.js route** (R5) — monolithic `backend/src/routes/finance.js` (1,779 lines)
  split into 7 focused sub-route files under `backend/src/routes/finance/`: `accounts.js`,
  `categories.js`, `transactions.js`, `transfers.js`, `reconciliation.js`, `statements.js`,
  and `batches.js`, plus a shared `helpers.js` and `index.js` parent router

---

## [0.9.1] — 2026-04-14

### Changed
- **Shared constants** — `FEATURE_DEPS`, `FEATURE_DEFAULTS_OFF`, `isOn()`, payment method
  lists, and `UK_POSTCODE_RE` now live in `shared/constants.js` (repo root) and are
  imported by both backend and frontend, eliminating 7 duplicate definitions
- **Shared validation** — `isValidUKPostcode()` and `validatePhone()` extracted to
  `frontend/src/lib/validation.js`, removing duplication from MemberEditor, MemberValidator,
  and JoinForm
- **API client split** — `api.js` (1,044 → 626 lines) now imports infrastructure from
  `api/core.js` and delegates system-admin, public, and portal APIs to their own modules
  (`api/system.js`, `api/public.js`, `api/portal.js`), cleanly separating 3 different
  auth patterns
- **Shared EntityMembers** — extracted `components/EntityMembers.jsx` from the nearly
  identical Members sub-components in GroupRecord and TeamRecord; parameterised by
  `entityType` (`'group'`/`'team'`), `api`, and `entityId`. GroupRecord: 1,291 → 770 lines;
  TeamRecord: 1,045 → 630 lines (net −936 lines of duplication removed)

---

## [0.9.0] — 2026-04-14

### Added
- **Event Members** — events (both group schedule entries and standalone) now track
  registered members with organiser/member roles, add-by-name/number, and
  "Copy from group" for one-time snapshot of group membership
- **Event Financials** — per-event financial summary showing income, costs, net balance,
  and attendee count, with links to individual transactions
- **Event Record page** — `/calendar/events/:eventId` with Details, Members, and
  Financials tabs (matching GroupRecord tabbed pattern)
- **Transaction ↔ Event linkage** — transactions can now be linked to an event via a
  search-as-you-type selector in TransactionEditor; event column shown in Finance Ledger
- **Event search API** — `GET /calendar/events/search?q=...` for topic/group/date search
- **Event attendance feature toggle** — `eventAttendance` sub-feature under Events
- **New privileges** — `event_attendance` (view/change/download) and `event_finance` (view)
  with appropriate default role grants
- **Backup/Restore** — Event Members sheet added to data export; `event_id` column added
  to Ledger sheet; restore handles both gracefully for backward compatibility
- **Calendar click-through** — all calendar entries now link to Event Record page
- **Schedule "View" link** — group schedule rows include link to Event Record
- **E2E tests** — Playwright spec `19-event-members.spec.js` covering EventRecord
  navigation, member add/remove/copy-from-group/organiser toggle, event financials
  with transaction linking, and Schedule "View" link

---

## [0.8.7] — 2026-04-14

### Changed
- **Public Links page** — sections are now greyed out with an explanatory banner
  when their corresponding feature (Members Portal or Online Joining) is disabled
  in Feature Configuration. Controls remain visible but disabled so admins can see
  what options are available.
- **Groups/Teams navigation** — replaced "Switch to Teams/Groups" links below the
  page heading with NavBar links for consistency (Home -- Add New Group -- Teams).
- **KNOWN-ISSUES.md** — removed 14 resolved items; only current open issues remain
- **E2E tests** — added coverage for recent features:
  - Feature Configuration page (sections, toggles, Update button)
  - Event Types CRUD (add/delete)
  - Teams list, Groups/Teams switching links, team CRUD + schedule events
  - Calendar: Show Detail checkbox, "Other" filter with event type dropdown,
    Group/Team filter dropdown
- **CLAUDE-E2E.md** — updated spec inventory; removed resolved "Credit batch"
  from deferred table

---

## [0.8.6] — 2026-04-14

### Changed
- **Feature toggles unified with system settings** — four feature toggles that
  existed as both a Feature Configuration toggle and a separate system settings
  checkbox have been unified onto the Feature Configuration page:
  - **SiteWorks** — removed `SiteWorks Activated` from System Settings; the Feature
    Config toggle now controls group scheduling fields.
  - **Gift Aid** — removed `Gift Aid declaration enabled` from System Settings; the
    Feature Config toggle now controls Gift Aid across the system. The "Show Gift
    Aid tick boxes for online renewals" sub-setting remains on System Settings.
  - **Online Joining** — removed `Enable online membership applications` from
    Public Links; the Feature Config toggle now gates the public join form.
  - **Portal** — the portal master toggle now gates all backend portal routes
    (previously only hid the admin link).

### Fixed
- **Feature toggles** — disabling a master module (e.g. Events & Calendar) now
  correctly hides its sub-features (Calendar, Event Types) from the menu and
  blocks route access. Previously sub-features remained visible because
  `hasFeature()` didn't check the parent dependency chain.
- **Group Ledger tab** — the Ledger tab on group and team records now respects the
  `groupLedger` feature toggle and is hidden when the feature is configured off.
- **Default-off features** — features that default to off (Gift Aid, Group Ledger,
  SiteWorks) were treated as on when never explicitly toggled, because missing keys
  in `feature_config` defaulted to true. Now `hasFeature()` and `requireFeature()`
  consult a defaults list so these features are correctly off until enabled.
- **Schedule tab** — the Schedule tab on group and team records is now hidden when
  the Events & Calendar module is turned off.

### Added
- **Feature config — System Dashboard** — system admins can now view and edit feature
  configuration for any tenant via a "Features" button on each tenant row in the
  System Dashboard. All toggles are available (including system-admin-only ones like
  Finance, Email, Portal, Online Joining).
- **Feature config — confirmation dialogs** — turning off a master module toggle now
  shows a confirmation dialog warning that the module will be hidden from users and
  that existing data is preserved.
- **Feature config — backup/restore** — `feature_config` is now included in the data
  export (Settings sheet) and restored in the Beacon2 restore path. Legacy Beacon
  restores leave feature config as the default (all on).
- **Feature configuration** — new per-u3a feature toggles system. Each u3a can
  choose which modules and sub-features are active via a new "Feature Configuration"
  page under Set up. 25 toggles across 6 master modules (Groups, Finance, Email &
  Letters, Members Portal, Online Joining, Events & Calendar) plus sub-features
  within Membership, Groups, Events, and Finance. Turning off a feature hides it
  from all users; existing data is preserved. System-admin-only toggles for features
  requiring external service setup (Finance, Email, Portal, Online Joining).
  - Backend: `feature_config` JSONB column, `GET/PATCH /settings/feature-config`,
    `requireFeature` middleware, `feature_config` privilege resource
  - Frontend: `hasFeature()` in AuthContext, FeatureConfig page with expandable
    toggle sections, Home page menu filtering, FeatureRoute guards on all routes

---

## [0.8.5] — 2026-04-13

### Added
- **Team events / schedule** — teams now support the same event scheduling as groups.
  Schedule tab added to TeamRecord with full CRUD (add single/recurring, inline edit,
  bulk delete). Shared `Schedule` component extracted from GroupRecord for reuse.
  Backend: `/teams/:id/events` CRUD routes (GET/POST/PATCH/DELETE).
  Team events also appear in the Calendar view (group/team filter).
- **Groups / Teams switching links** — "Switch to Teams" link on Groups list page
  and "Switch to Groups" link on Teams list page for quick navigation.
- **Event types** — flexible system replacing the single "Open Meetings" concept.
  Non-group events now belong to a configurable event type (e.g. Open Meetings,
  Social Events, Guest Lectures). Default "Open Meetings" type seeded automatically
  and protected from rename/delete.
  - Backend: `event_types` table, `/event-types` CRUD routes, `event_type_id` FK
    on `group_events`, migration of existing open meetings to default type
  - Frontend: Event Types settings page (System Settings → Event Types), Calendar
    "Other" filter mode with embedded event management, Portal Calendar "Other"
    filter with event type dropdown
  - Calendar "Group" filter renamed to "Group/Team" and now includes teams
  - Data export/restore includes event types sheet and event_type_id on events
  - Existing open meetings (group_id IS NULL) auto-migrated to "Open Meetings" type
- **Event Types settings page** — CRUD page for managing event types under Set up,
  with inline editing, default type protection, and privilege-gated access

### Fixed
- **Calendar group/team filter** — Open Meetings (non-group events) no longer appear
  when the Calendar is filtered by group/team
- **Calendar "Other" mode** — removed duplicate "Show Detail" checkbox
- **Calendar "all" mode** — Open Meeting dates are now clickable; clicking switches
  to "Other" mode with the correct event type for editing
- **Calendar group/team dropdown** — groups listed first, then teams (no longer
  interleaved alphabetically)

### Changed
- **Calendar member filter** — replaced autocomplete search with filter+select dropdown
  matching the TransactionEditor member picker pattern
- **Calendar page** — removed standalone Open Meetings menu item; non-group event
  management is now embedded in the Calendar page under the "Other" radio option
- **Portal Calendar** — added "Other" radio option with event type dropdown filter

---

## [0.8.4] — 2026-04-12

### Added
- **Teams** — new concept alongside groups. Teams have members (with leader
  designation) and a group ledger, but no scheduling, venues, faculties, max
  members, waiting list, or online join. Implemented via a `type` column on
  the existing `groups` table (`'group'` vs `'team'`).
  - Backend: `/teams` CRUD routes, member management, ledger operations,
    download (Excel/PDF)
  - Frontend: TeamList page, TeamRecord page with Details/Members/Ledger tabs
  - Home page: Teams link in Groups section
  - Member record: "Groups, Teams and Ledger" tab shows both groups and teams
  - Member list: "Add to team" bulk action
  - Default role: "Team Leaders" with scoped group-leader privileges
  - All existing group routes filtered to `type = 'group'` to ensure separation
- **Abbreviated name** — optional short name (max 10 chars) on groups and teams.
  Displayed everywhere the full name was shown, with full name as tooltip on hover.
- **Transaction group/team association** — financial transactions can now be
  associated with a team as well as a group. The picker is a searchable type-ahead
  with Groups and Teams in separate sections.
- **Finance ledger** — group view now includes teams; group column links to the
  correct /groups/ or /teams/ route; view-by button labelled "Group/Team".

### Fixed
- **Finance ledger GROUP BY error** — adding short_name and type to the SELECT
  without adding them to GROUP BY caused all transaction queries to fail with a
  PostgreSQL error. Fixed by including `g.short_name, g.type` in commonGroupBy.
- **Transaction redisplay after save** — the GET /transactions/:id endpoint had
  the same GROUP BY omission (`g.short_name, g.type`), causing "Transaction #null"
  and an error message after saving a new transaction despite the save succeeding.
- **Data export missing teams** — the Groups export sheet now includes `short_name`
  and `type` columns so teams are preserved on export/restore instead of being
  silently converted to groups.
- **Data export/restore coverage audit** — comprehensive fix for columns and tables
  missing from export and restore:
  - **Members**: added `custom_field_1..4`, `emergency_contact`
  - **Transactions**: added `transfer_id`, `pending`, `gift_aid_amount/claimed_at` (x2),
    `batch_id`, `refund_of_id`, `refunded_by_id`
  - **Finance accounts**: added `balance_brought_forward`
  - **Tenant settings**: added `year_start_month/day`, `online_joining_enabled`,
    `privacy_policy_url`, `group_bf_enabled`, `siteworks_activated`,
    `custom_field_label_1..4`, `portal_config`, `group_info_config`, `calendar_config`
  - **New tables exported**: credit_batches, group_events, system_messages,
    standard_messages, standard_letters, payment_method_defaults
  - `clearTenantData` updated for all new tables
  - DataBackup UI text updated to reflect new sheets and teams
  - Added CLAUDE-STANDARDS checklist item for export/restore on schema changes

## [0.8.3] — 2026-04-02

### Changed
- **Accessibility: htmlFor/id associations** — added `htmlFor` on labels and `id` on
  inputs across 10 high-traffic pages: MemberEditor, TransactionEditor, GroupRecord,
  SystemSettings, JoinForm, PortalPersonalDetails, UserEditor, TransferMoney,
  TransactionRefund, PersonalPreferences. Improves screen-reader accessibility and
  enables Playwright `getByLabel()` selectors.
- **KNOWN-ISSUES.md audit** — marked public groups/calendar as done; updated
  show_addresses, shared email, and htmlFor descriptions for accuracy

### Fixed
- **E2E: MemberEditorPage** — skip filling joinedOn date on new-member form where the
  field is hidden (auto-set by useEffect)
- **E2E: MemberListPage** — fix editLinkForMember; member list has no "Edit" link per
  row — members are edited by clicking their name/number
- **E2E: Applicant status race** — wait for member data to load before asserting status
  on the edit form (was reading default "Current" before API response arrived)
- **E2E: Stable test suffixes** — replace `process.pid`-based suffixes with fixed strings;
  PID changes when Playwright restarts workers on retry, breaking dependent tests
- **E2E: Gift Aid test** — accept "Gift Aid is not enabled" as valid state in fresh tenant

### Added
- **E2E: Configure Account** — page-load test navigating from finance accounts list
- **E2E: Payment Method Defaults** — page-load test for membership payment method defaults
- **E2E: Audit Record detail** — click-through test from audit log to record detail
- **E2E: Member Compact View** — navigation from member editor to compact view
- **E2E: Credit batch full workflow** — create batch → select transactions → verify
  in list → remove transactions → delete batch
- **Email cards auto-attach** — when `email_cards` is enabled in tenant settings,
  online joining, online renewal, and portal card replacement confirmation emails
  now generate and attach a membership card PDF (via `generateSingleCardPdf`).
  Joint renewals attach each partner's own card. Emails remain stubbed pending
  SendGrid integration.
- **Backend tests** — added tests for `generateSingleCardPdf` export (valid member,
  not-found error, advanceYear parameter)
- **Online membership renewal** (doc 10.2.1) — portal members can now renew their
  membership online. Shows renewal fee, Gift Aid opt-in/out (when enabled via
  `gift_aid_online_renewals`), and initiates PayPal payment. Advances `next_renewal`
  by one year on confirmation. Joint members renew together with combined fee. Creates
  finance transaction and sends confirmation emails. Eligibility enforced: must be
  Current status, within `advance_renewals_weeks` window. "Renew your membership"
  option appears on PortalHome when `portal_config.renewals` is enabled.
- **Joint membership online joining** — when a member selects a joint membership class
  (`is_joint`), the joining form now shows fields for the second person (title, forenames,
  surname, email, mobile) and a separate Gift Aid consent checkbox. Both member records are
  created linked at the same address with bidirectional `partner_id`. Payment amount is
  doubled (2× class fee). Payment confirmation promotes both members to Current status and
  creates a single finance transaction with both member IDs. Resume-payment and JoinPending
  pages show both members' details.

---

## [0.8.2] — 2026-04-01

### Added
- **Portal version number** — all 10 portal screens now show the app version discreetly
  in the top-right corner, matching the main Beacon2 screens
- **Public groups list** — unauthenticated page at `/public/{slug}/groups` showing all
  active groups; fields controlled by `group_info_config` public flags; supports `?hdr=0`
  to hide header for iframe embedding
- **Public calendar** — unauthenticated page at `/public/{slug}/calendar` showing all
  non-private events from today to end of year; fields controlled by `calendar_config`
  public flags; supports `?hdr=0` to hide header

---

## [0.8.1] — 2026-04-01

### Fixed
- **Restore (Beacon legacy)** — now imports venues (as proper venue records linked to
  groups) and group ledger entries
- **Restore (Beacon2)** — now imports venues, venue_id on groups, and group ledger entries
- **Restore (both formats)** — restored users are now forced to change password on first
  login (`must_change_password = true`)
- **System set-temp-password** — now also sets `must_change_password = true` for all
  affected users

### Changed
- **Beacon2 export** — Groups sheet now includes `venue_id`; Venues sheet exports full
  venue records; new "Group Ledgers" sheet exports group ledger entries

---

## [0.7.20] — 2026-04-01

### Changed
- **Financial Ledger** — moved "Do with selected" bulk action bar from above the table
  to below it, matching the standard layout used by all other list pages
- **Credit Batches** — auto-select first locked account on page load; auto-display
  batch list when account/mode/date changes (removed Show button); moved "Add credit
  batch" button to NavBar
- **Credit Batches (batch detail)** — show batch number; editable batch reference,
  batch date (new field), and description; new table columns (#, Date, Payment Ref,
  Payment Method, From/To, Detail, Amount, Cleared, Remove?); "Remove?" checkboxes
  with Current/New Batch Total in footer; Update Transaction + Cancel buttons;
  "Add transactions" button to add unbatched transactions to the current batch

### Added
- **NavBar** — support for `onClick` handler links (button-styled, no navigation)
- **credit_batches.batch_date** — new editable date column (defaults to creation date);
  used for "since date" filtering instead of created_at

---

## [0.7.19] — 2026-04-01

### Changed
- **Transaction form** — From/To field is now required (hard validation)
- **Transaction form** — Member 2 is disabled until Member 1 is selected; clearing
  Member 1 also clears Member 2. Members 1 and 2 cannot be the same.
- **Transaction form** — Total gift aid eligible cannot exceed the transaction amount
- **Transaction form** — Category allocation mismatch now shows the difference amount
  (e.g. "difference £1.00")

---

## [0.7.18] — 2026-03-31

### Added
- **Transaction form** — Gift Aid eligible amount fields for Member 1 and Member 2; shown
  only for incoming transactions linked to a member. Read-only claimed date displayed when
  gift aid has been claimed.
- **Gift Aid declaration** — Member 2 support: declaration list, Excel download, and
  mark-as-claimed now handle both member slots via UNION query

### Changed
- **Venue form** — replaced multi-field address (address1, address2, town, county) with a
  single Address field; postcode remains separate
- **Venue form** — added Contact field (near telephone/email)
- **Venue form** — added "Send email" button next to email field (opens mailto: link)
- **Venue form** — added open-website button next to website field (opens in new tab)
- **Venue list** — simplified columns to Name (sortable), Contact, Telephone, Accessible (♿)
- **Financial Ledger** — expanded to 18 columns: Account, #, Date, Batch No, Batch Ref,
  From/To, Group, Mem#, Mem2#, Detail, Category, Payment Ref, Method, In, Out, Refund,
  Balance, Cleared
- **Financial Ledger** — clickable links on #, Batch No, Group, Mem#, Mem2#, and Refund columns
- **Financial Ledger** — running balance now shown in all views (account, category, group)
- **Financial Ledger** — Category column shows comma-separated list of category names

### Added
- **Credit Batches** — description field on batch records (editable in detail view and
  on creation); shown as "Batch Ref" column in the ledger
- **Credit Batches** — PATCH endpoint to update batch description
- **Credit Batches** — `batchId` query param to auto-open a specific batch

---

## [0.7.17] — 2026-03-30

### Changed
- **Group members list** — aligned with main members list: uses `formatMemberName`, clickable
  No/Name links to member record, dual sort (by forenames / by surname), NoEmailIcon in
  checkbox column, overdue subscription red styling, Address column (short format) replacing
  Town, separate Telephone and Mobile columns replacing single Tel, Email column removed
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
