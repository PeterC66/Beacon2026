# Beacon2 — Independent Codebase & Documentation Review (2026-06-14)

> **Status:** active working plan. This is a *second, independent* review,
> separate from the June-2026 effort archived in
> [`history/`](history/ImprovementPlan.md). Outstanding items are tracked in
> [`../KNOWN-ISSUES.md`](../KNOWN-ISSUES.md); this document is the prioritised
> work plan. Each chunk is sized for one session.

## Context

Beacon2 is a multi-tenant Node/Express + React/Vite reproduction of the live
u3a *Beacon* system (demo: https://demo.u3abeacon.org.uk/). It is **not yet in
production**. The goal for this review is **demo/portfolio quality**:
"experienced developers should see nothing they object to" when reading the
code or docs. A thorough 12-chunk review was already done in June 2026 (archived
in `docs/history/`); nearly all of its security findings are `[FIXED]`. This
review is deliberately **independent** — analysed with fresh eyes, then
reconciled against `KNOWN-ISSUES.md` / `CHANGELOG.md` so it surfaces net-new and
still-open items rather than re-flagging completed work.

## Methodology & a caveat on rigour

Findings below were produced by exploring the codebase directly and were
**spot-verified by hand** — not taken on faith. This matters: during the review,
two of the most alarming automated (subagent) findings turned out to be **false
positives**:

- A claimed "undefined function `assertActorHoldsRolePrivileges` → runtime
  crash / no privilege-escalation guard." **False** — it is a hoisted function
  declaration at `backend/src/routes/users.js:345`, used in three places. The
  guard exists and works.
- A claimed "most routes lack Zod validation (roles, venues, offices, …)."
  **False** — every one of those routes imports Zod and validates with
  `z.object`/`.parse`; the schemas are simply defined *inline* rather than
  extracted to `schemas/`.

The lesson carried into the plan: **each chunk re-verifies its own findings
before changing anything.** The codebase is more mature than a surface scan
suggests, so the genuine opportunities are mostly polish, consistency,
standards, and "tell the production story" — not firefighting.

---

# PART A — Analysis by dimension

Severity legend: 🔴 should fix before calling it production-ready · 🟡 worth
doing for polish/standards · 🟢 minor / optional. Items marked *(KI #n)* already
exist in `KNOWN-ISSUES.md`; *(new)* are net-new from this review.

## 1) Security — *in good shape; few net-new items*

The June sweep closed the real holes (account enumeration, password policy,
portal rate-limiting, magic-byte upload checks, email from/replyTo constraints).
JWT handling (pinned HS256, separate secrets, SHA-256-hashed refresh tokens,
reuse detection), parameterised SQL, tenant-slug regex validation, helmet, CORS
origin checks and CSV-formula escaping are all sound.

- 🟡 **Refresh-token reuse detection silently no-ops without Redis** *(KI #3)* —
  fine for a demo, but an experienced reviewer will ask. Either add a Postgres
  fallback for the invalidation marker or document the limitation prominently.
- 🟢 **Privilege-string `:` delimiter collision risk** *(KI #7)* — works today;
  fragile if a resource code ever contains `:`. Cheap to harden the encoding.
- 🟢 **Frontend CSP shipped report-only** *(KI #25)* — documented; flip to
  enforcing after a clean-report window post-deploy.
- 🟡 **33 `console.log` calls in backend non-test code** *(new)* — token logging
  was already removed (KI #10), but an explicit audit pass should confirm none
  leak PII/secrets, and these should move to a real logger (see Maintainability).
- ✅ **Cross-tenant access is *not* a vuln** *(reviewer note)* — a subagent
  flagged it, but `tenantQuery` keys off `req.user.tenantSlug` from the JWT, so a
  user cannot address another tenant. No action; called out to close the thread.
- 🟢 **`uuid` moderate advisory** *(KI #24, ACCEPTED)* — v4-only usage, no `buf`
  arg; unaffected. Leave as-is until exceljs allows the major bump.

## 2) Completeness — *several deliberate feature gaps vs live Beacon*

For a "faithful reproduction," the deferred features are the main completeness
story. They are tracked but scattered across `KNOWN-ISSUES.md`.

- 🟡 **Consolidate the parity gap list** *(new)* and reconcile with
  `docs/Beacon2UG-Comparison.md` so there is one authoritative "what's missing
  vs Beacon" view.
- 🟡 Feature gaps worth a decision before claiming parity *(KI, DEFERRED)*:
  PayPal is a stub; shared-email portal login has no UI disambiguation;
  per-group `show_addresses` / per-member `hide_contact` not wired into
  visibility; system-wide "hide address from group leaders" missing;
  `public_phone`/`public_email`/`home_page` stored but never displayed;
  member-to-member nav in compact view; Calendar export is a no-op; member
  photos excluded from export.
- 🟢 **Doc 7.10.5 eligibility typo** *(KI)* and the "Central/Finance Ledger"
  wording mismatch *(KI)* — small correctness items.

## 3) Consistency — *strong, with a few conventions to pin down*

- 🟡 **Zod schema location is inconsistent** *(new)* — `groups`/`teams`/`common`
  are extracted to `schemas/`; ~25 other routes define schemas inline. Pick one
  convention and document it (extraction is not required, but the split should be
  intentional, not accidental).
- 🟢 **Frontend `inputCls` adoption** *(KI)* — ~75 pages still use inline Tailwind
  strings instead of the shared constants. Incremental migration.
- 🟢 **Error-response message style** *(new)* — mix of generic ("Invalid
  credentials") and specific ("User not found"); align on a house rule.

## 4) Maintainability — *thin service layer is the main theme*

- 🟡 **Business logic lives in large route files** *(new)* — only
  `services/authService.js` exists; route files carry the logic. Biggest:
  `routes/backup/restore.js` (1512), `routes/members/crud.js` (1037),
  `routes/backup/export.js` (840), `routes/public/join.js` (768),
  `routes/finance/transactions.js` (747). Extracting service modules for the top
  offenders is the single highest-value maintainability move, and the thing an
  experienced reviewer is most likely to comment on.
- 🟡 **No structured logger** *(new)* — `console.*` throughout; no levels, no
  request correlation. A small `logger` wrapper (or pino) is low effort and reads
  as "production-minded."
- 🟢 **Largest frontend pages** (`MemberEditor` ~1994) already partly decomposed
  *(KI)*; acceptable, optional further extraction.

## 5) Human readability — *code is clean; some docs are oversized*

- 🟢 Code is genuinely tidy: no TODO/FIXME in the frontend, no `eval`/
  `dangerouslySetInnerHTML`, consistent patterns. Few concerns here.
- 🟡 **`CLAUDE-REFERENCE.md` (~94 KB) and `CHANGELOG.md` (~99 KB)** *(new)* — large
  enough to be hard to navigate. Add a table of contents / split the reference by
  module; consider archiving old changelog entries.
- 🟢 **Stale comment `App.jsx:132`** *(KI #26)* — auth-model comment is outdated.

## 6) Standards — *the cheapest high-visibility wins live here*

- 🔴 **No `LICENSE` file** *(KI, DEFERRED)* — the first thing many experienced
  developers check. Pick a licence (proprietary or OSS) and add it. Highest
  visibility-to-effort ratio in the whole review.
- 🟡 **`docs/FromBeacon/` provenance** *(KI, DEFERRED)* — redistributes original
  Beacon source carrying a "© John Franklin 2017, notice must be retained"
  copyright. Add a provenance README confirming permission/reference-only status,
  or remove. A legal-hygiene item reviewers notice.
- 🟡 **No `SECURITY.md`** *(new)* — for a project handling member PII, a
  vulnerability-disclosure policy is expected. Cheap to add.
- 🟢 **`console.*` instead of a logger** *(new, see Maintainability)*.
- 🟢 **`shared/constants.js` not linted/formatted by either package** *(KI)*;
  ~30 `react-hooks/exhaustive-deps` warnings *(KI)*; no `.nvmrc`/`engines` pin
  *(new)* — small standards nits.

## 7) Production readiness — *calibrated to demo; document the real-launch gaps*

Health check, graceful shutdown, startup secret enforcement, idempotent
migrations and rate-limiting are present. For demo quality the gap is mostly
"tell the story," not build the ops stack:

- 🟡 **Observability** *(new)* — no structured logs, error tracking (e.g.
  Sentry) or metrics. For demo, add the logger and a short "what real production
  would add" note in `DEPLOYMENT.md`.
- 🟢 **Redis optional** — without it, privilege changes lag up to 15 min
  (token TTL). Already warned; keep documented.
- 🟢 **CSP flip, free-tier DB/backups, HTTPS-at-platform** — acceptable for demo;
  list explicitly as known pre-launch steps.

## 8) Other — *tests, deps, a11y*

- 🟡 **Targeted test gaps** *(new)* — account lockout, multi-tenant isolation, and
  privilege-escalation guard (`assertActorHoldsRolePrivileges`) lack explicit
  tests despite being security-critical. Add focused unit tests.
- 🟢 **Deferred E2E flows** *(KI)* — portal register/login, online joining,
  renewals bulk action.
- 🟢 **Dependency hygiene** *(KI)* — `pdfmake` pinned at 0.2 (0.3 is a breaking
  API change for `letters.js`); plan the migration. `uuid` advisory accepted.
- 🟢 **A11y `htmlFor`/`id`** *(KI)* — high-traffic pages fixed; finish remaining
  lower-traffic pages incrementally.

---

# PART B — Chunked execution plan

Each chunk is sized for a single session and is independent — do them in any
order, though the priority ordering below front-loads the cheapest
high-visibility wins. Every chunk **re-verifies its findings before editing**
and ends with the standard wrap-up (tests, lint, CHANGELOG, KNOWN-ISSUES).

### Chunk 1 — Licensing & legal hygiene *(small; highest visibility)*
- Add a root `LICENSE` (owner chooses proprietary vs OSS — needs a decision).
- Add `SECURITY.md` (disclosure contact + supported scope).
- Resolve `docs/FromBeacon/` provenance: add a provenance README (permission +
  reference-only) or remove the copyrighted originals.
- Files: `LICENSE` (new), `SECURITY.md` (new), `docs/FromBeacon/README.md` (new).
- *Blocker:* needs the owner's licence choice — surface as a question first.

### Chunk 2 — Logging baseline *(small/medium; standards + security)*
- Introduce a minimal `backend/src/utils/logger.js` (levels, no PII) or adopt
  pino; replace the 33 `console.*` call sites in non-test code.
- Audit each replaced call to confirm no token/PII leakage.
- Reuse: existing `utils/audit.js` for audit events (distinct from app logs).
- Files: `backend/src/utils/logger.js` (new) + the 9 files identified in the review.

### Chunk 3 — Service-layer extraction for the biggest routes *(medium/large)*
- Extract business logic into `services/` for the top offenders, starting with
  `routes/backup/restore.js`, `routes/members/crud.js`,
  `routes/finance/transactions.js`. Routes become thin controllers.
- Pattern: mirror `services/authService.js`; keep `tenantQuery`/`withTenant` in
  the service, validation (Zod) at the route boundary.
- This is the marquee maintainability change — do one route end-to-end first to
  agree the pattern, then repeat.

### Chunk 4 — Validation & error-message consistency *(small/medium)*
- Decide and document the Zod convention (inline vs `schemas/`); make the
  codebase consistent with the decision.
- Establish a house rule for error-response wording (generic vs specific) and
  align the auth/login messages.
- Files: `CLAUDE-STANDARDS.md` (rule), affected route schemas.

### Chunk 5 — Security OPEN-item reconciliation *(small/medium)*
- Refresh-token reuse without Redis (KI #3): add a Postgres fallback for the
  invalidation marker, or document the limitation in `DEPLOYMENT.md`.
- Harden privilege-string encoding to remove `:` collision risk (KI #7).
- Write the CSP enforce-flip runbook in `DEPLOYMENT.md` (KI #25).
- Files: `backend/src/utils/redis.js`, `middleware/requirePrivilege.js`,
  `frontend/vercel.json`, `DEPLOYMENT.md`.

### Chunk 6 — Test coverage for security-critical paths *(medium)*
- Add unit tests: account lockout (`registerFailedLogin`), multi-tenant
  isolation (slug validation / cross-tenant rejection), and the
  `assertActorHoldsRolePrivileges` escalation guard.
- Reuse: `backend/src/__tests__/mocks.js`, existing setup patterns.

### Chunk 7 — Completeness reconciliation *(medium; partly a decision task)*
- Build one authoritative parity-gap list; sync `docs/Beacon2UG-Comparison.md`.
- Then pick the low-cost gaps to close now: wire `show_addresses`/`hide_contact`
  visibility, display `public_phone`/`public_email`, resolve the Calendar-export
  no-op, fix the doc 7.10.5 typo and the Ledger wording.
- Larger gaps (PayPal, shared-email portal UX) stay deferred with explicit notes.

### Chunk 8 — Documentation readability *(small)*
- Add a TOC and/or split `CLAUDE-REFERENCE.md` by module; trim/archive old
  `CHANGELOG.md` entries; ensure the human-docs (`README`/`CONTRIBUTING`) vs
  Claude-tooling-docs separation is obvious from the top of each file.
- Fix the stale `App.jsx:132` comment (KI #26).

### Chunk 9 — Frontend polish *(small; incremental)*
- Migrate a batch of pages from inline Tailwind to `inputCls`/`labelCls`
  constants; audit `react-hooks/exhaustive-deps` warnings (fix or annotate);
  add `htmlFor`/`id` to a batch of remaining lower-traffic pages.

### Chunk 10 — Tooling & dependency hygiene *(small/medium)*
- Add `.nvmrc` / `engines` Node pin; bring `shared/` under lint/format.
- Plan (and, if feasible, execute) the `pdfmake` 0.2->0.3 migration for
  `routes/letters.js` so Dependabot can resume bumps (KI).

**Suggested ordering for "experienced devs see nothing objectionable":**
1 -> 2 -> 8 -> 4 -> 5 -> 3 -> 6 -> 7 -> 9 -> 10. (Cheap, visible standards/docs
wins first; the larger service-layer refactor mid-way; feature completeness later.)

---

# Verification approach

Because this is a plan, the verification below applies to **each chunk when it
is executed**:

- **Re-verify first.** Before editing, confirm the finding still holds (grep the
  symbol, read the file) — two headline findings in this review were false
  positives, so trust nothing unread.
- **Tests + lint, per CLAUDE.md.** `cd backend && npm test`, `cd frontend &&
  npm test`, then `npm run lint && npm run format:check` in both. Must be green
  before commit (docs-only chunks skip tests).
- **Targeted checks per chunk:** Chunk 2 — grep for remaining `console.` in
  `backend/src` (excluding tests) should return only intentional cases; Chunk 3 —
  the refactored route's existing tests pass unchanged (behaviour-preserving);
  Chunk 6 — new tests fail against a deliberately broken guard to prove they
  bite; Chunk 5 — exercise refresh-token reuse with Redis off to confirm the
  fallback path.
- **Wrap-up each session:** update `CHANGELOG.md`, move resolved items in
  `KNOWN-ISSUES.md` to `[FIXED]`, and update `docs/Beacon2UG-Comparison.md` if a
  feature changed.

## Open decisions to confirm before executing
- **Chunk 1 licence choice** — proprietary vs a specific OSS licence. Blocks the
  `LICENSE` file; everything else can proceed without it.
- **Chunk 7 parity scope** — which deferred features (if any) to close now vs
  keep deferred for the demo.
