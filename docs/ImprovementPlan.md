# Beacon2 Improvement Plan

Produced 2026-06-12 from a full review of the codebase and documentation covering
security, completeness, consistency, maintainability, readability, standards, and
production readiness. The review was a fresh pass over the current code, then
consolidated with the still-open items in `SECURITY-REVIEW.md`, `KNOWN-ISSUES.md`,
and `CODEBASE-RECOMMENDATIONS.md`.

**Goal:** experienced developers reviewing the code or documentation should find
nothing to object to. Beacon2 is not heading to production, so production-only
concerns (ops tooling, backup strategy, paid hosting tiers) are noted but ranked
below code quality.

## How to use this document

Part 1 lists findings by category. Part 2 groups them into **numbered chunks,
each sized for one working session** — in a future session, say "do Chunk N of
docs/ImprovementPlan.md". Chunks are ordered by recommended sequence; dependencies
are noted. When a chunk is completed, mark it ✅ here and update `KNOWN-ISSUES.md` /
`CHANGELOG.md` as usual.

---

## Executive summary

The codebase is in good shape overall: tenant isolation is sound, auth follows
modern patterns (in-memory access tokens, rotating refresh tokens, lockout), Zod
validation and parameterised SQL are used consistently, and the documentation
culture (CHANGELOG, KNOWN-ISSUES, standards docs) is well above average. The
April–June 2026 security review fixed 23 of 28 findings, and this review
re-verified those fixes as genuinely present in the code.

What an experienced developer would object to first, in order:

1. **A real bug**: `routes/email.js` and `routes/letters.js` read `req.tenantSlug`,
   which is only set by the public-routes middleware — on these authenticated
   routes it is `undefined`. `tenantQuery()`'s slug regex coerces `undefined` to
   the string `"undefined"` and **passes** it, so queries target a non-existent
   `u3a_undefined` schema and fail at runtime. Mocked unit tests can't see this.
2. **No linting or formatting tooling at all** — no ESLint, no Prettier, nothing
   in CI. This is the loudest "red flag" signal to an outside developer.
3. **Test-coverage gaps where they matter most** — the four largest, riskiest
   route files (`portal.js`, `public.js`, `teams.js`, `system.js`) have no unit
   tests, and the 52 frontend tests are almost all render-only smoke tests.
4. **Missing standard repo artifacts** — no LICENSE, no CONTRIBUTING, no
   `.env.example` for backend/frontend (the README tells you to copy one), and
   legacy Beacon PHP source redistributed in `docs/FromBeacon/` with a third-party
   copyright header and no licensing note.
5. **Oversized files** — five backend routes over 1,000 lines and six frontend
   pages over 700 lines (MemberEditor.jsx is 1,657).
6. The ~18 still-open security items already catalogued in `KNOWN-ISSUES.md`
   (all re-verified as still present; none critical for a non-production system,
   but several are cheap to fix and would be noticed in review).

---

## Part 1 — Findings by category

### 1. Security

The fresh pass confirmed all 13 majors from `SECURITY-REVIEW.md` are fixed
(seed credentials, token storage, lockout, JWT pinning, LIKE escaping, CSRF
origin check, CORS validation, etc.). It re-confirmed KNOWN-ISSUES #1–#26 as
still open where marked open, and added one new finding:

| # | Severity | Finding | Where |
|---|----------|---------|-------|
| S1 | **High (bug)** | `req.tenantSlug` undefined on authenticated routes; `tenantQuery` accepts non-string slug (`"undefined"` passes the regex) | `routes/email.js` (19×), `routes/letters.js` (5×), `utils/db.js:27,48` |
| S2 | High | Temp-password generator modulo bias | `routes/auth.js:376`, `routes/users.js:342` (KI #5) |
| S3 | High | Portal auth skips Redis session-invalidation check | `routes/portal.js:22` (KI #9) |
| S4 | High | Password policy inconsistent: `min(8)` no complexity on `PATCH /users` and `/system/tenants` vs `min(10)`+complexity elsewhere | `routes/users.js:167`, `routes/system.js:42` (KI #2) |
| S5 | Med | Account/email enumeration: portal login 401-vs-403, recover/forgot-password timing | `routes/public.js:962,1003`, `routes/auth.js:234` (KI #1, #13, #14) |
| S6 | Med | Verification tokens still `console.log`'d when SendGrid unset | `routes/public.js:851`, `routes/portal.js:700` (KI #10) |
| S7 | Med | `requireSysAdmin` never checks invalidation or `active` flag | `middleware/auth.js:47` (KI #4) |
| S8 | Med | Slug regex inconsistency: public allows `-`, db.js rejects → 500 not 400 | `routes/public.js:64` vs `utils/db.js:27` (KI #11) |
| S9 | Med | Email hardening set: attachment `originalname` unsanitised, `replyTo` unconstrained, `fromEmail` ignored, hard-coded `FROM_ADDRESS`, per-recipient SendGrid refresh amplification | `routes/email.js` (KI #16, #19–22) |
| S10 | Med | Upload hardening: no magic-byte validation on photos; multer accepts any MIME on `/system/restore` and `/email/send` | `routes/members.js`, `routes/portal.js`, `routes/system.js:201` (KI #12, #15, #18) |
| S11 | Low | No targeted rate limit on portal auth endpoints | `app.js:69` (KI #8) |
| S12 | Low | CSRF origin check skipped whenever `NODE_ENV !== 'production'` | `routes/auth.js:46` (KI #6) |
| S13 | Low | `clearTenantData()` doesn't purge Redis invalidation marks after restore | `routes/backup.js:629` (KI #17) |
| S14 | Low | Privilege string `resource:action` format fragile if a resource ever contains `:` | `middleware/requirePrivilege.js` (KI #7) |
| S15 | Low | Frontend CSP still report-only; `uuid` moderate advisory (not exploitable here) | `frontend/vercel.json` (KI #24, #25) |

### 2. Completeness

| # | Severity | Finding |
|---|----------|---------|
| C1 | High | No unit tests for `portal.js` (1,540 LOC), `public.js` (1,281), `teams.js` (984), `system.js` (~300), or the seven `finance/` sub-routes (only the umbrella `finance.test.js`). Carried over from CODEBASE-RECOMMENDATIONS R12. |
| C2 | High | Frontend tests are render-only smoke tests (51 of 52 files); only `CookieConsent.test.jsx` tests behaviour. No tests for shared components (`Button`, `Input`, `EntityMembers`, `DateInput`). |
| C3 | Med | PayPal integration is a stub (intentional, gated by `PAYPAL_STUB_ALLOW`); SendGrid wiring incomplete for portal-register/email-change verification emails (ties to S6). |
| C4 | Med | Feature gaps already tracked in KNOWN-ISSUES (group `show_addresses` not wired into visibility, system-wide hide-address setting, shared-email portal disambiguation, member prev/next navigation, public_phone/email display). Keep tracking there. |
| C5 | Low | `eventAttendance` missing from shared `FEATURE_DEPS` map though FeatureConfig.jsx implies a dependency on `events` — verify intentional or fix. |
| C6 | Low | groups.js/teams.js don't call `logAudit()` on create/update/delete while members/finance do. |

### 3. Consistency

| # | Severity | Finding |
|---|----------|---------|
| N1 | High | Identical WHERE-clause filter-building blocks duplicated across `calendar.js`, `addressExport.js`, `members.js`, `membershipCards.js`, `portal.js` — extract a shared helper. |
| N2 | Med | Response shapes vary (`{message}` vs `{error}` vs domain keys); 200 vs 201 semantics vary on upsert endpoints. Adopt one convention and document it in CLAUDE-STANDARDS. |
| N3 | Med | Zod validates bodies everywhere but query params are often used raw (e.g. `req.query.from/to` in calendar.js). Validate query strings with Zod too. |
| N4 | Med | ~20 inline date/time formatters duplicated across frontend pages (`fmtDate`, `fmtTime`, month-name arrays in Calendar.jsx, AuditLog.jsx, CreditBatches.jsx, …) — consolidate into `lib/dateFormatters.js`. |
| N5 | Med | Magic strings throughout frontend: sessionStorage keys (`'emailComposeMemberIds'`), privilege strings, route paths — central constants modules. |
| N6 | Low | `membershipCards.js` throws one bare `Error` where 147 other sites use `AppError`; `settings.js` uses Prisma directly while siblings use `tenantQuery`; pagination limits are scattered magic numbers (50/500/20). |
| N7 | Low | "Central Ledger" vs "Finance Ledger" wording (KNOWN-ISSUES UI Terminology #1). |

### 4. Maintainability

| # | Severity | Finding |
|---|----------|---------|
| M1 | High | Oversized backend files: `backup.js` 1,738, `members.js` 1,618, `portal.js` 1,540, `public.js` 1,281, `groups.js` 1,214 lines. Split into domain sub-routers as was done for `finance/`. |
| M2 | High | Oversized frontend pages: `MemberEditor.jsx` 1,657, `TransactionEditor.jsx` 935, `CreditBatches.jsx` 818, `Calendar.jsx` 798, `GroupRecord.jsx` 785, `SystemDashboard.jsx` 721; `EntityMembers.jsx` (539, ~15 state vars) doing too much. |
| M3 | High | ~35+ frontend pages repeat the same fetch/loading/error boilerplate — extract a `useAsyncLoad()` hook; same for repeated field-error rendering (`FormError` component). |
| M4 | Med | Mock boilerplate duplicated in all 31 backend test files and all 52 frontend test files — move shared mocks into setup/helpers. |
| M5 | Med | Nested component definitions violate the project's own rule: `LetterCompose.jsx:77` (`ToolbarButton`, `EditorToolbar`), `EventFinancials.jsx:115` (`TransactionSection`), `GroupRecord.jsx:20` (`GroupDetails`). |
| M6 | Low | Derived state stored in `useState` instead of `useMemo` (MemberList.jsx:271, others); dead one-time migration kept in `utils/migrate.js:58`; many single-line `export`s in backup.js that may be internal-only. |

### 5. Human readability

| # | Severity | Finding |
|---|----------|---------|
| R1 | Med | No structured logger — `console.log`/`console.error` throughout backend, including `[Portal]`/`[Online Join]` email-simulation logs. Acceptable for a demo, but a thin logger wrapper (or pino) would read better and make S6 easier to fix. |
| R2 | Low | Stale comment `App.jsx:132` ("auth handled via sessionStorage" — now in-memory; KI #26); bare `catch {}` in `requireSysAdmin` loses error detail; sparse comments on the trickier flows (refresh rotation, restore parsing) vs noisy ones elsewhere. |
| R3 | Low | Frontend is clean on the usual sins: no stray `console.log`, no unused imports found, no `dangerouslySetInnerHTML`. Worth saying — reviewers will notice this positively. |

### 6. Standards & tooling

| # | Severity | Finding |
|---|----------|---------|
| T1 | **High** | No ESLint or Prettier in either package; nothing in CI. The single most visible gap to an outside developer. |
| T2 | Med | CI: Node 20 in `ci.yml` vs Node 22 in `e2e.yml`; no coverage reporting; E2E never gates merges (manual dispatch only); no `.editorconfig` or pre-commit hooks. |
| T3 | Med | No PropTypes/TypeScript anywhere — component and API contracts are implicit. Full TS migration is out of scope; at minimum document the decision (and consider JSDoc types on `lib/api/*`). |
| T4 | Low | Prisma-mocked backend tests mean SQL is never executed in CI — intentional, but undocumented; state it in the testing docs and rely explicitly on E2E for SQL regressions. |

### 7. Production readiness (lower priority by decision)

| # | Severity | Finding |
|---|----------|---------|
| P1 | Med | E2E suite can only run against a deployed staging instance — no local mode (docker-compose with Postgres would fix this and also help new developers). |
| P2 | Low | No Dockerfile; no documented backup/restore or rollback procedure; Render free-tier caveats (Redis off → 15-min invalidation lag) documented but worth a single "deployment limitations" section. |
| P3 | Low | `render.yaml` ships a default `SEED_ADMIN_EMAIL=admin@beacon2.local` while the password is `sync: false`; e2e `.env.example` uses well-known credentials (`ChangeMe123!`). Make both placeholders obviously non-real. |

### 8. Other (repo hygiene, licensing, accessibility)

| # | Severity | Finding |
|---|----------|---------|
| O1 | **High** | No LICENSE file; no CONTRIBUTING.md. |
| O2 | **High** | `docs/FromBeacon/` redistributes original Beacon PHP source carrying "Copyright John Franklin" headers with no note on permission/scope. Needs a README clarifying provenance and reference-only status — or removal if permission is unclear. |
| O3 | High | README points at `cp .env.example .env` but no `.env.example` exists in backend/ or frontend/; required env vars aren't enumerated anywhere outside DEPLOYMENT.md/render.yaml. |
| O4 | Med | Root-level doc sprawl: four CLAUDE-*.md files read as project docs to an outsider; `Beacon2 Project Definition.md` says "as of version 0.9.9" while package.json is 0.11.0; KNOWN-ISSUES items lack status tags; CODEBASE-RECOMMENDATIONS doesn't cross-reference KNOWN-ISSUES. |
| O5 | Med | Accessibility: sortable column headers are `<span onClick>` without keyboard support in MemberList.jsx:489 and similar list pages; remaining lower-traffic pages still missing `htmlFor`/`id` label association (tracked in KNOWN-ISSUES). |
| O6 | Low | No API reference or architecture diagram; docs/BeaconUG/ lacks a "legacy reference only" README. |

---

## Part 2 — Implementation chunks

Each chunk is sized for one session. Recommended order below; chunks 4+ are
largely independent of each other unless noted.

### Chunk 1 — Fix the tenant-context bug (S1) ✅ Done (2026-06-12)
- Replace `req.tenantSlug` with `req.user.tenantSlug` throughout
  `routes/email.js` and `routes/letters.js`.
- Harden `withTenant()`/`tenantQuery()` in `utils/db.js` to reject non-string
  slugs (`typeof tenantSlug !== 'string'` → throw) so a missing slug fails
  loudly instead of coercing to `"undefined"`.
- Add regression tests that assert the slug passed to `tenantQuery` equals the
  authenticated user's tenant (the existing mocks make this easy to assert).
- Manually verify the Email compose and Letters pages against a real backend.

### Chunk 2 — Repo hygiene & onboarding docs (O1–O4, P3) ✅ Done (2026-06-12)
**Deferred by owner decision:** the `LICENSE` file (owner to choose a licence)
and the `docs/FromBeacon/` provenance README (owner to confirm permission) —
both logged in `KNOWN-ISSUES.md` under "Repo hygiene & licensing". Everything
else in this chunk is done.

Docs-only. Add LICENSE (owner to choose; decide before the session) and
CONTRIBUTING.md; create `backend/.env.example` and `frontend/.env.example`
listing every env var with required/optional status; fix README quickstart to
match reality; add provenance README in `docs/FromBeacon/` (and confirm
permission to keep the files) and a "legacy reference" README in `docs/BeaconUG/`;
update Project Definition version line; add status tags (`[OPEN]`/`[ACCEPTED]`/
`[DEFERRED]`) to KNOWN-ISSUES items; cross-link CODEBASE-RECOMMENDATIONS ↔
KNOWN-ISSUES; neutralise placeholder credentials in `render.yaml` and
`e2e/.env.example`; add a short note at the top of CLAUDE.md that it is
AI-session tooling, with README as the human entry point.

### Chunk 3 — Linting & formatting baseline (T1, T2 part) ✅ Done (2026-06-12)
- Add ESLint (flat config) + Prettier to backend and frontend with
  `react`/`react-hooks` plugins; add `lint` scripts and run them in `ci.yml`.
- Fix or explicitly disable the violations the first run surfaces (expect a
  large but mechanical diff — keep it a separate commit from any logic change).
- Add `.editorconfig`; align Node 20 vs 22 across workflows.
- This chunk before the refactor chunks, so later diffs stay clean.

**Notes:** `eslint-plugin-react-hooks` pinned to v5 (the stable
`rules-of-hooks` + `exhaustive-deps` pair). The v7 experimental rules
(`set-state-in-effect`, `immutability`) flagged 50+ sites that would need
real refactors — deferred, logged in `KNOWN-ISSUES.md`. `react/no-unescaped-entities`
disabled (noise). `exhaustive-deps` left as a warning (30 sites). Backend
27 errors and frontend 32 errors all fixed; Prettier reformat committed
separately. Node bumped 20 → 22 in `ci.yml`; `lint` + `format:check` now
gate CI.

### Chunk 4 — Security: auth & enumeration (S2–S8, S11, S12) ✅ Done (2026-06-12)
- Centralise password policy into one shared Zod schema; apply to
  `PATCH /users`, `/system/tenants`, and all reset flows.
- Replace biased temp-password generation with `crypto.randomInt`.
- Add session-invalidation checks to portal auth and `requireSysAdmin`.
- Normalise enumeration responses (portal login 401 for unverified; async or
  constant-time recover/forgot-password).
- Stop logging verification tokens; unify the slug regexes; add a portal auth
  rate limiter; base the refresh-origin check on `CORS_ORIGIN` presence rather
  than `NODE_ENV`.

### Chunk 5 — Security: email & uploads (S9, S10, S13) ✅ Done (2026-06-12)
- Sanitise attachment filenames; constrain `replyTo` to the sender's own
  addresses; wire or remove `fromEmail`; make `FROM_ADDRESS` env-configurable;
  cap per-click SendGrid status refresh.
- Magic-byte validation (`file-type`) on photo uploads; MIME whitelist on
  `/system/restore` and `/email/send` multer configs.
- Purge tenant Redis invalidation keys in `clearTenantData()`.

**Notes:** new shared helper `backend/src/utils/uploads.js` holds the image
magic-byte sniffer (`decodeAndValidateImage` — hand-rolled jpeg/png/gif check,
no `file-type` dependency added), `sanitizeAttachmentFilename`, and a reusable
`mimeFileFilter` plus the spreadsheet/attachment MIME whitelists. Both photo
routes (`members.js`, `portal.js`) validate magic bytes; `/system/restore` and
`/email/send` multer configs whitelist MIME and cap file counts. In `email.js`,
`fromEmail` **and** `replyTo` are validated against the user's own permitted
addresses via the extracted `getUserFromAddresses()` helper (shared with
`/from-addresses`), `FROM_ADDRESS` reads `EMAIL_FROM_ADDRESS` →
`RECOVERY_FROM_ADDRESS` → default, and the delivery refresh is capped at 100
lookups per click. The restore route purges tenant Redis invalidation marks
via the new `purgeTenantInvalidations()`. KI #23 (bodyHtml on portal/public
templated emails) remains `[OPEN]` — it is latent until SendGrid is wired for
those flows, so there is nothing to change yet. New unit tests:
`__tests__/uploads.test.js`; magic-byte mismatch case added to
`members.test.js`.

### Chunk 6 — Backend consistency (N1–N3, N6, C5, C6) ✅ Done (2026-06-12)
- Extract the shared WHERE-builder helper used by calendar/members/
  addressExport/membershipCards/portal.
- Adopt and document one response-shape convention; fix the stray bare `Error`;
  add Zod validation for query params on the routes that use them raw;
  hoist pagination limits to constants; add `logAudit()` to groups/teams
  mutations; resolve the `eventAttendance` FEATURE_DEPS question.

**Notes:** N1 was scoped to the **event** filters only (owner decision) — the
genuinely byte-identical duplication. New `backend/src/utils/eventFilters.js`
holds `buildCalendarEventFilters()` (replacing 3 inline blocks in `calendar.js`)
and `buildPortalCalendarFilters()` (replacing 2 in `portal.js`); both validate
the query string with Zod, so a malformed `from`/`to` now 422s at the edge
instead of 500-ing on the `::date` cast (N3). The member-filter helpers in
`members.js` / `addressExport.js` / `membershipCards.js` were left as-is — they
are already locally factored and not actually identical (membershipCards hard-codes
`Current`; members.js adds search/custom-field/payment-method conditions).
N2: response-shape + status-code convention documented in CLAUDE-STANDARDS
(`{ error }` for all errors via `AppError`; `{ message }` only for action-only
successes; 201 create / 200 fetch+update). N6: the bare `throw new Error` in
`membershipCards.js` → `AppError(…, 404)`; pagination magic numbers hoisted to
named constants (`EVENT_SEARCH_*` in calendar.js, `CONSENT_HISTORY_MAX_ROWS` in
giftAid.js). The `settings.js` "Prisma vs tenantQuery" item was a **false
positive** — its Prisma calls read the **public** schema (`sys_tenants`,
`sys_settings`), which `tenantQuery()` cannot reach; left unchanged. C5: already
resolved — `eventAttendance: 'events'` is present in `shared/constants.js`
`FEATURE_DEPS` (fixed earlier; see CHANGELOG). C6: `logAudit()` added to the
group and team create/update/delete handlers (entity-level CRUD).
New unit tests: `__tests__/eventFilters.test.js`.

### Chunk 7 — Backend tests for untested routes (C1, M4 backend half, T4) ✅ Done (2026-06-13)
- Shared mock-setup helper to replace the per-file boilerplate.
- New test files: `portal.test.js`, `public.test.js`, `teams.test.js`,
  `system.test.js`, and per-file tests for `finance/` sub-routes.
- Document (CLAUDE-REFERENCE §12) that Prisma mocks mean SQL is exercised only
  by E2E. Likely 2 sessions — split portal/public vs teams/system/finance.

**Notes:** done in one session. New shared `backend/src/__tests__/mocks.js`
exports `dbMock`/`redisMock`/`auditMock`/`passwordMock` factories (vitest hoists
the import above the `vi.mock` factory that calls them, so this is safe); they
replace the copy-pasted db/redis mock blocks for new files and are available for
incremental adoption by existing ones. New suites: `system.test.js` (19 tests),
`teams.test.js` (21), `public.test.js` (13), `portal.test.js` (10),
`financeTransfers.test.js` (12), `financeReconciliation.test.js` (8),
`financeStatements.test.js` (8). Scoping decisions: portal *auth* (login/lockout/
forgot/reset) was already covered by `portalAuth.test.js`, so `public.test.js`/
`portal.test.js` cover the *other* public + authenticated-portal endpoints
(joining, register/verify, public pages, home/groups/personal-details) rather
than re-testing auth. For `finance/`, accounts/categories/transactions are
covered by the existing umbrella `finance.test.js` and batches by
`creditBatches.test.js`, so the new per-file suites fill the genuine gaps:
transfers, reconciliation, statements. The `system/restore` route and
feature-config PATCH remain covered by `restoreBeacon.test.js`. T4 (SQL only
exercised by E2E) is now stated explicitly in CLAUDE-REFERENCE §12. Backend suite:
45 → 52 files, 593 tests green; lint + format clean. This completes the R12
remainder, so CODEBASE-RECOMMENDATIONS can be marked fully done.

### Chunk 8 — Frontend deduplication (M3, M5, M6, N4, N5) ✅ Done (2026-06-13)
- `useAsyncLoad()` hook; `lib/dateFormatters.js`; constants modules for
  sessionStorage keys, routes, and privilege strings; shared `FormError`.
- Move the three nested component definitions out of their parents
  (LetterCompose, EventFinancials, GroupRecord).
- Convert derived-state `useState` to `useMemo` where found.
- Adopt incrementally — start with the worst 10 pages, don't churn all 85.

**Notes:** New shared modules: `hooks/useAsyncLoad.js`, `lib/dateFormatters.js`,
`lib/storageKeys.js`, `lib/routes.js`, `components/FormError.jsx` (all documented
in CLAUDE-REFERENCE §11).
- **N4 (date formatters):** ~25 inline `fmtDate`/`fmtTime`/`fmtTimestamp`/
  `formatDate` helpers across pages and components replaced with faithfully-matched
  shared formatters (call sites unchanged via aliased imports). `AuditRecord`'s
  unique short-month-with-seconds format left local (not a duplicate).
- **N5 (magic strings):** all sessionStorage/localStorage keys hoisted to
  `lib/storageKeys.js`; the frequently cross-referenced route targets to
  `lib/routes.js` (`ROUTES`). **Privilege strings deliberately not centralised**
  (owner decision via AskUserQuestion): `can('resource','action')` reads fine and
  hoisting ~90 sites adds indirection for no safety gain.
- **M3 (`useAsyncLoad` + `FormError`):** `FormError` adopted across all 8 form
  pages with the inline field-error pattern (~50 sites). `useAsyncLoad` adopted in
  the 8 clean single-payload pages (RoleList, FinanceCategories, EventTypeList,
  MemberClassList, MemberStatusList, FacultyList, VenueList, EventFinancials);
  multi-load and filter-on-button pages left as hand-rolled effects because the
  memoised `reload` would capture stale state (see CLAUDE-REFERENCE §11).
- **M5 (nested components):** already resolved in an earlier session —
  `GroupDetails`, `ToolbarButton`/`EditorToolbar` and `TransactionSection` are all
  already module-top-level, not nested. No change needed.
- **M6 (derived `useState` → `useMemo`):** also already resolved — `MemberList`'s
  derived values (`hasCfLabels`, `cfLabelNames`) are computed inline as plain
  `const`s and the sorted list goes through `useSortedData`'s internal `useMemo`.
  No remaining derived-state-set-in-`useEffect` anti-pattern was found.
- Frontend suite green throughout (53 files, 140 tests); lint 0 errors, Prettier clean.

### Chunk 9 — Split oversized backend routes (M1) ✅ Done (2026-06-13)
One file per session if needed, starting with `backup.js` (export vs restore)
and `members.js` (CRUD vs exports vs bulk ops), following the `finance/`
sub-router precedent. Pure moves — no behaviour change, tests green before/after.

**Done so far (2026-06-13):**
- `backup.js` (2,353 lines) → `routes/backup/` (`export.js`, `restore.js`,
  shared `helpers.js`, `index.js`). `system.js` and `restoreBeacon.test.js`
  updated to import restore helpers from `backup/restore.js`.
- `members.js` (1,970 lines) → `routes/members/` (`list.js`, `lifecycle.js`,
  `crud.js`, shared `helpers.js`, `index.js`). `index.js` mounts literal-path
  routers before the `/:id` CRUD router to preserve Express match order.
- `portal.js` (1,798 lines) → `routes/portal/` (`profile.js`, `groups.js`,
  `calendar.js`, `renewals.js`, shared `helpers.js`, `index.js`). `index.js`
  owns the portal-auth middleware + feature gate, then mounts the four
  concern-specific sub-routers. `public.js` import updated to `portal/index.js`.
- `groups.js` (1,464 lines) → `routes/groups/` (`list.js`, `crud.js`,
  `members.js`, `events.js`, `ledger.js`, `index.js`). `index.js` owns the
  shared `requireAuth` + `requireFeature('groups')` middleware, then mounts the
  sub-routers with the list router (literal `/download`) before the CRUD router
  (`/:id`) to preserve Express match order. No shared `helpers.js` was needed —
  each field-def/schema/access helper is local to a single concern. `app.js`
  import updated to `groups/index.js`.
- `public.js` (1,455 lines) → `routes/public/` (`join.js`, `portalAuth.js`,
  `read.js`, `index.js`). `index.js` owns the `resolveTenant` tenant-resolution
  middleware (mounted on `/:slug` first so every sub-route inherits it), then
  mounts the join/payment router, portal-auth router, public-info router, and
  finally the authenticated portal app router at `/:slug/portal/app`. Each
  concern keeps its own helpers local (join email stubs in `join.js`; the
  `portalAuthLimiter`, lockout helper, and reset/verification email senders in
  `portalAuth.js`), so no shared `helpers.js` was needed. `app.js` import
  updated to `public/index.js`.
- `teams.js` (1,267 lines) → `routes/teams/` (`list.js`, `crud.js`,
  `members.js`, `events.js`, `ledger.js`, `index.js`). `index.js` owns the
  shared `requireAuth` + `requireFeature('teams')` middleware, then mounts the
  sub-routers with the list router (literal `/download`) before the CRUD router
  (`/:id`) to preserve Express match order. The `hasLedgerAccess` helper lives
  in `ledger.js` (its only consumer); no shared `helpers.js` was needed.
  `app.js` import updated to `teams/index.js`.
- `calendar.js` (945 lines) → `routes/calendar/` (`events.js`, `openEvents.js`,
  `eventMembers.js`, shared `helpers.js`, `index.js`). `index.js` owns the
  shared `requireAuth` + `requireFeature('events')` middleware. `events.js`
  holds the read side (aggregate view, PDF/Excel exports, member/event-type
  lookups, event search, single-event lookup, financials) and defines its
  literal `/events/pdf`, `/events/excel`, and `/events/search` routes before
  `/events/:eventId` so the param does not capture them. `openEvents.js` owns
  the non-group `/open-events` CRUD; `eventMembers.js` owns the attendance
  sub-resource. `helpers.js` holds the `fmtDateUK`/`fmtTime` formatters shared
  by `events.js` and `eventMembers.js`. `app.js` import updated to
  `calendar/index.js`.
- Route registrations verified identical before/after; backend suite green
  (593 tests), lint + Prettier clean. This completes Chunk 9 — all five
  oversized backend route files (`backup.js`, `members.js`, `portal.js`,
  `groups.js`, `public.js`) plus `teams.js` and `calendar.js` are now split.

### Chunk 10 — Split oversized frontend pages (M2) ✅ Done (2026-06-13)
Start with `MemberEditor.jsx` (form / groups / financials / photo sections) and
`EntityMembers.jsx` (list / bulk actions / downloads). Same rule: extraction
only, no behaviour change.

**Notes:** the two named files were split this session.
- `MemberEditor.jsx` (2,317 → 1,994 lines). Extracted the pure helpers/constants
  (`todayIso`, `computeNextRenewal`, `BLANK_FORM`, `TITLES`) to
  `members/memberEditorUtils.js`; the shared Tailwind class strings to
  `members/memberEditorStyles.js` (the parent keeps its `inputCls`/`labelCls`/etc.
  local aliases pointing at the exported constants, so the ~100 JSX references were
  untouched); the read-only Groups/Teams/Ledger block to
  `members/MemberLedgerSection.jsx`; and the photo upload/preview block to
  `members/MemberPhotoSection.jsx` (upload state + handlers stay in the parent and
  are passed as props).
- `EntityMembers.jsx` (722 → 583 lines). Extracted the "Do with selected"
  bulk-action bar + download field-picker to `components/EntityBulkActions.jsx` and
  the "Add a member" panel to `components/EntityAddMembers.jsx`; both are
  presentation-only, with all state/handlers passed in from the parent.
- `GroupRecord.jsx` (1,128 → 152 lines) and `TeamRecord.jsx` (889 → 125 lines).
  Each had two top-level sub-components already defined in-file; moved them to
  their own files: `groups/GroupDetails.jsx` + `groups/GroupLedger.jsx` and
  `teams/TeamDetails.jsx` + `teams/TeamLedger.jsx`. The page files now own only
  tab routing and render the sub-components.
- `Calendar.jsx` (1,125 → 861 lines). The two read-only event tables moved to
  `calendar/CalendarMonthTable.jsx` and `calendar/CalendarFlatTable.jsx`; the
  pure helpers to `calendar/calendarUtils.js`. The page keeps the filter form,
  the "other" event-management section, and the add-event form.
- Pure extraction, no behaviour change. Frontend suite green (53 files, 140 tests);
  lint 0 errors, Prettier clean.
- **Remaining M2 pages deferred:** `TransactionEditor.jsx` (1,097),
  `CreditBatches.jsx` (1,028), `MemberList.jsx` (921), `FinanceLedger.jsx`
  (892), `SystemDashboard.jsx` (832) are still oversized. Logged in
  `KNOWN-ISSUES.md` for a follow-up session (same extraction-only approach).

### Chunk 11 — Frontend test quality & accessibility (C2, O5, M4 frontend half)
- Shared mock factories; interaction tests (form submit, validation error,
  API call assertions) for ~10 critical pages using CookieConsent.test.jsx as
  the model; unit tests for shared components.
- Keyboard accessibility for sortable headers (`<button>` or role/tabIndex/
  onKeyDown); continue the `htmlFor`/`id` label sweep.

### Chunk 12 — CI & E2E improvements (T2 rest, P1, P2)
- Coverage reporting (`@vitest/coverage-v8`) surfaced in CI.
- docker-compose for local backend+Postgres so E2E can run locally; decide
  whether E2E should gate merges; consider Dependabot.
- Optional: single "deployment limitations" section in DEPLOYMENT.md; flip CSP
  to enforce mode after a clean report window (S15).

---

## Part 3 — Relationship to existing documents

- **SECURITY-REVIEW.md** — all items marked fixed were re-verified as fixed
  (2026-06-12). No regressions found. This document supersedes nothing there;
  it adds finding S1.
- **KNOWN-ISSUES.md** — all 26 security items re-verified as still open where
  marked open. Chunks 4 and 5 cover KI #1–#22 and #25–#26; KI #23 (bodyHtml)
  folds into Chunk 5; KI #24 (uuid advisory) stays accepted/deferred. The
  feature-level deferred items (portal, joining, exports) remain tracked in
  KNOWN-ISSUES and are not duplicated here.
- **CODEBASE-RECOMMENDATIONS.md** — R1–R12 confirmed done except the R12
  remainder (untested routes), which is Chunk 7 here. The four "informational
  observations" at the end are covered by Chunks 6 and 2. Once Chunk 7 is done,
  that document can be marked fully completed.

## Review provenance

Fresh review passes run 2026-06-12 over: backend security/auth (with
verification of every prior finding), backend consistency/maintainability,
frontend quality, tests/CI, and documentation. Headline finding S1 was
independently verified by tracing `requireAuth` (`middleware/auth.js` sets only
`req.user`), the single `req.tenantSlug =` assignment (`routes/public.js:73`),
and the slug regex coercion in `utils/db.js:48`.
