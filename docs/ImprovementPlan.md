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

### Chunk 3 — Linting & formatting baseline (T1, T2 part)
- Add ESLint (flat config) + Prettier to backend and frontend with
  `react`/`react-hooks` plugins; add `lint` scripts and run them in `ci.yml`.
- Fix or explicitly disable the violations the first run surfaces (expect a
  large but mechanical diff — keep it a separate commit from any logic change).
- Add `.editorconfig`; align Node 20 vs 22 across workflows.
- This chunk before the refactor chunks, so later diffs stay clean.

### Chunk 4 — Security: auth & enumeration (S2–S8, S11, S12)
- Centralise password policy into one shared Zod schema; apply to
  `PATCH /users`, `/system/tenants`, and all reset flows.
- Replace biased temp-password generation with `crypto.randomInt`.
- Add session-invalidation checks to portal auth and `requireSysAdmin`.
- Normalise enumeration responses (portal login 401 for unverified; async or
  constant-time recover/forgot-password).
- Stop logging verification tokens; unify the slug regexes; add a portal auth
  rate limiter; base the refresh-origin check on `CORS_ORIGIN` presence rather
  than `NODE_ENV`.

### Chunk 5 — Security: email & uploads (S9, S10, S13)
- Sanitise attachment filenames; constrain `replyTo` to the sender's own
  addresses; wire or remove `fromEmail`; make `FROM_ADDRESS` env-configurable;
  cap per-click SendGrid status refresh.
- Magic-byte validation (`file-type`) on photo uploads; MIME whitelist on
  `/system/restore` and `/email/send` multer configs.
- Purge tenant Redis invalidation keys in `clearTenantData()`.

### Chunk 6 — Backend consistency (N1–N3, N6, C5, C6)
- Extract the shared WHERE-builder helper used by calendar/members/
  addressExport/membershipCards/portal.
- Adopt and document one response-shape convention; fix the stray bare `Error`;
  add Zod validation for query params on the routes that use them raw;
  hoist pagination limits to constants; add `logAudit()` to groups/teams
  mutations; resolve the `eventAttendance` FEATURE_DEPS question.

### Chunk 7 — Backend tests for untested routes (C1, M4 backend half, T4)
- Shared mock-setup helper to replace the per-file boilerplate.
- New test files: `portal.test.js`, `public.test.js`, `teams.test.js`,
  `system.test.js`, and per-file tests for `finance/` sub-routes.
- Document (CLAUDE-REFERENCE §12) that Prisma mocks mean SQL is exercised only
  by E2E. Likely 2 sessions — split portal/public vs teams/system/finance.

### Chunk 8 — Frontend deduplication (M3, M5, M6, N4, N5)
- `useAsyncLoad()` hook; `lib/dateFormatters.js`; constants modules for
  sessionStorage keys, routes, and privilege strings; shared `FormError`.
- Move the three nested component definitions out of their parents
  (LetterCompose, EventFinancials, GroupRecord).
- Convert derived-state `useState` to `useMemo` where found.
- Adopt incrementally — start with the worst 10 pages, don't churn all 85.

### Chunk 9 — Split oversized backend routes (M1)
One file per session if needed, starting with `backup.js` (export vs restore)
and `members.js` (CRUD vs exports vs bulk ops), following the `finance/`
sub-router precedent. Pure moves — no behaviour change, tests green before/after.

### Chunk 10 — Split oversized frontend pages (M2)
Start with `MemberEditor.jsx` (form / groups / financials / photo sections) and
`EntityMembers.jsx` (list / bulk actions / downloads). Same rule: extraction
only, no behaviour change.

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
