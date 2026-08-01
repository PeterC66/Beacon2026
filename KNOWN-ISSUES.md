# beacon2026 — Known Issues and Deferred Items

Items noted during development that need addressing in future sessions.

**Status tags** — each item carries one of:

- `[OPEN]` — a genuine issue to fix when convenient.
- `[ACCEPTED]` — understood and deliberately not changing (rationale given).
- `[DEFERRED]` — worth doing but parked for a later phase / dependency.
- `[FIXED]` — resolved; kept here (not deleted) so the numbered cross-references
  from the historical work plan stay stable. See CHANGELOG for the date.

**This is the single living backlog.** Anything still to do lives here. The
full-codebase review and chunked work plan that drove the 2026-06 improvement
work is now **complete** and archived for reference under
[`docs/history/`](docs/history/) — see
[`docs/history/ImprovementPlan.md`](docs/history/ImprovementPlan.md) (the work
plan), [`docs/history/CODEBASE-RECOMMENDATIONS.md`](docs/history/CODEBASE-RECOMMENDATIONS.md)
(code-rationalisation findings), and
[`docs/history/SECURITY-REVIEW.md`](docs/history/SECURITY-REVIEW.md) (fixed
security findings). Those are point-in-time snapshots and are no longer updated.

---

## Security — open findings from 2026-06-10 review

Items identified during the chunk 1 + chunk 2 security sweep that were not
fixed in the same session. See CHANGELOG 2026-06-10 for what was fixed.
These are catalogued and re-verified in `docs/history/ImprovementPlan.md` (Chunks 4–5).

1. `[FIXED]` **Account-enumeration via response timing on `/auth/recover`**
   (`routes/auth.js:248`). `sendRecoveryEmail` (and the verify variant) are now
   fire-and-forget, so the bcrypt hash + DB write no longer add latency to the
   matched-account response. (Chunk 4, 2026-06-12.)
2. `[FIXED]` **Inconsistent password policy** — centralised into
   `utils/passwordPolicy.js` (`passwordSchema`: 10–72 chars, upper+lower+digit)
   and applied to `PATCH /users`, `POST /system/tenants`, `/auth/change-password`,
   `/auth/force-change-password`, and all portal register/reset/change flows.
   (Chunk 4, 2026-06-12.)
3. `[FIXED]` **Refresh-token reuse detection silently no-ops without Redis** —
   the session-invalidation marker now has a **Postgres fallback**. When Redis
   is disabled (`USE_REDIS=false`), `invalidateUserSessions` /
   `isSessionInvalidated` / `purgeTenantInvalidations` read and write the new
   per-tenant `session_invalidations` table instead of no-opping, so a revoked
   role/password is enforced on the next request rather than only after the
   access token expires. (Refresh-token *reuse* itself was always DB-backed via
   `refresh_tokens.revoked`.) New `redis.test.js` covers the fallback. Resolved
   in the 2026-06-14 review (ImprovementPlan Chunk 5).
4. `[FIXED]` **`requireSysAdmin` skips invalidation / `active` check**
   (`middleware/auth.js:47`). The middleware now re-loads the sys-admin via
   Prisma on every request and rejects (401) if the account is missing or
   `active = false`. Sys-admin tokens carry no Redis invalidation marker, so the
   active flag is the meaningful state check. (Chunk 4, 2026-06-12.)
5. `[FIXED]` **Temp-password generator has modulo bias**. Replaced with
   `crypto.randomInt`-based `generateTempPassword()` in `utils/passwordPolicy.js`,
   shared by `routes/users.js` and `routes/auth.js`. (Chunk 4, 2026-06-12.)
6. `[FIXED]` **Origin check bypass when `NODE_ENV !== 'production'`**
   (`routes/auth.js`). `isAllowedOrigin()` now gates enforcement solely on
   `CORS_ORIGIN` being set; a missing `Origin` header (non-browser caller) is
   always allowed and `NODE_ENV` no longer influences the decision.
   (Chunk 4, 2026-06-12.)
7. `[FIXED]` **Privilege-string format collisions** — privilege-string
   construction is now centralised in `encodePrivilege(resource, action)` in
   `shared/constants.js`, used by the backend (`requirePrivilege`,
   `hasPrivilege`, `computePrivileges`) and the frontend (`can`). The helper
   guards the invariant — actions must not contain `:`, so the action is always
   the unambiguous final segment and two distinct (resource, action) pairs can
   no longer alias to the same string. Format is unchanged, so no token
   re-issue is needed. Resolved in the 2026-06-14 review (ImprovementPlan
   Chunk 5).
8. `[FIXED]` **No targeted rate limit on portal endpoints**. A dedicated
   `portalAuthLimiter` (20/15 min/IP, env `PORTAL_AUTH_RATE_LIMIT_MAX`) now
   guards `register`, `login`, `forgot-password`, `reset-password`, and
   `verify-email` in `routes/public.js`. (Chunk 4, 2026-06-12.)
9. `[FIXED]` **Portal JWT skips Redis session-invalidation check**
   (`routes/portal.js`). `requirePortalAuth` now checks the
   `invalidated:<slug>:<memberId>` marker on every request, and portal
   password change/reset set it. (Chunk 4, 2026-06-12.)
10. `[FIXED]` **Verification tokens still logged via `console.log`**. Portal
    register and email-change now send the link via SendGrid
    (`sendPortalVerificationEmail`), or log a token-free warning when SendGrid
    is unset — the token is never written to stdout. (Chunk 4, 2026-06-12.)
11. `[FIXED]` **Slug regex inconsistency**. `routes/public.js` `resolveTenant`
    now uses `[a-z0-9_]+`, identical to `utils/db.js`, so a `-`-containing slug
    400s at the edge instead of 500-ing in `tenantQuery`. (Chunk 4, 2026-06-12.)
12. `[FIXED]` **Photo upload doesn't validate magic bytes** —
    `routes/portal.js`. Fixed in ImprovementPlan Chunk 5: both photo routes now
    call `decodeAndValidateImage()` (`utils/uploads.js`), which sniffs the
    leading bytes and rejects a payload whose content doesn't match its
    declared jpeg/png/gif type. (See also #15.)
13. `[ACCEPTED]` **Portal login "verify your email" differentiated response** —
    `routes/public.js`. The 403 "Please verify your email" branch is only
    reachable *after* a correct password match, so it does not enable
    email-enumeration by an attacker who lacks the password (they would already
    be that account). It is retained for usability — collapsing it to a generic
    401 would leave verified-but-unable-to-sign-in users with no guidance. The
    real vector (response timing) is closed: a no-account login now runs a
    throwaway bcrypt comparison so a miss costs the same as a wrong-password hit.
    (Reviewed Chunk 4, 2026-06-12.)
14. `[FIXED]` **`/portal/forgot-password` timing enumeration** —
    `routes/public.js`. The reset email is now fire-and-forget, so the
    matched-account response no longer waits on email delivery. (Chunk 4,
    2026-06-12.)
15. `[FIXED]` **No magic-byte validation on photo uploads**
    (`routes/members.js`, `routes/portal.js`). Fixed in ImprovementPlan
    Chunk 5 — see #12.
16. `[FIXED]` **Email-attachment `originalname` passed through
    unsanitised** (`routes/email.js`). Fixed in Chunk 5: attachments are run
    through `sanitizeAttachmentFilename()` (basename only, control/illegal
    chars stripped, whitespace padding collapsed, length capped).
17. `[FIXED]` **`clearTenantData()` doesn't purge Redis
    invalidation marks** (`routes/backup.js`). Fixed in Chunk 5: the restore
    route calls `purgeTenantInvalidations(tenantSlug)` (`utils/redis.js`, SCAN
    + DEL) after a successful restore, clearing stale
    `invalidated:slug:userId` keys.
18. `[FIXED]` **Multer accepts any MIME type on `/system/restore`
    and `/email/send`** (`routes/system.js`, `routes/email.js`). Fixed in
    Chunk 5: both multer configs now use `mimeFileFilter()` (spreadsheet
    whitelist for restore, safe-attachment whitelist for email) plus explicit
    `files` count limits.
19. `[FIXED]` **`/email/send` `fromEmail` field is declared but
    ignored** (`routes/email.js`). Fixed in Chunk 5: `fromEmail` and `replyTo`
    are now validated against the user's own permitted addresses
    (`getUserFromAddresses()`, the same source as `/email/from-addresses`);
    a value outside that set is rejected with 403.
20. `[FIXED]` **`/email/send` `replyTo` is unconstrained**
    (`routes/email.js`). Fixed in Chunk 5 — see #19.
21. `[FIXED]` **`/email/delivery/:batchId/refresh` issues one
    SendGrid API call per recipient** (`routes/email.js`). Fixed in Chunk 5:
    the per-click lookup count is capped at `MAX_REFRESH_LOOKUPS` (100).
22. `[FIXED]` **Hard-coded `FROM_ADDRESS`** (`routes/email.js`).
    Fixed in Chunk 5: the broadcast sender now reads `EMAIL_FROM_ADDRESS`
    (falling back to `RECOVERY_FROM_ADDRESS`, then the original default).
23. `[OPEN]` **`routes/public.js` and `routes/portal.js` `resolveTokens` callers
    still use `body` for templated emails** — currently only `console.log`'d
    so latent, but when SendGrid is wired they should also use the new
    `bodyHtml` for the html field.
24. `[ACCEPTED]` **`uuid<11.1.1` buffer-bounds advisory remains** — backend `npm audit`
    shows 2 moderate findings against the `uuid` package (direct +
    transitive via `exceljs`). The advisory only affects v3/v5/v6 when a
    `buf` argument is passed. beacon2026 imports only `v4` and never passes
    a buffer, so the runtime is unaffected. Major bump (`uuid@14`) is a
    breaking change for `exceljs` and should wait for an upstream release.
25. `[OPEN]` **Frontend CSP shipped in report-only mode** — after a deploy window
    of clean reports, change `Content-Security-Policy-Report-Only` to
    `Content-Security-Policy` in `frontend/vercel.json` to enforce.
    Consider tightening `connect-src 'self' https:` to the concrete
    backend host once known. (ImprovementPlan Chunk 12 reviewed this and
    **deliberately left it report-only**: the "clean report window" cannot be
    verified from a dev environment, and enforcing an untested policy risks
    breaking the live frontend. A full step-by-step enforce-flip runbook
    (collect reports → resolve → tighten `connect-src` → rename the header →
    verify → rollback) is now in DEPLOYMENT.md under "Enforcing the
    Content-Security-Policy" (ImprovementPlan Chunk 5). The flip itself remains
    a post-deploy step, so this stays OPEN.)
26. `[FIXED]` **Stale comment in `App.jsx:132`** — the comment claimed system
    admin auth was "handled inside pages via sessionStorage", which no longer
    matched the in-memory sys-token model (`frontend/src/lib/api/system.js`).
    Reworded to point at the in-memory token. Resolved in the 2026-06-14 review
    (ImprovementPlan Chunk 8).
27. `[OPEN]` **`POST /users` runs the role-escalation guard after inserting the
    user row** (`routes/users.js` ~141–158). The user `INSERT` happens before
    the per-`roleId` `assertActorHoldsRolePrivileges` loop, and each
    `tenantQuery` is its own transaction, so a blocked escalation attempt leaves
    an orphaned user account (no role is assigned, so **no privilege escalation
    occurs** — this is a data-hygiene wart, not a security hole). Found while
    adding the Chunk 6 escalation test. Fix: validate every requested role
    against the actor's privileges *before* the `INSERT`, or wrap the create +
    role assignment in a single `withTenant` transaction. Low priority.

---

## Repo hygiene & licensing (ImprovementPlan Chunk 2)

1. `[FIXED]` **No repository LICENSE** — owner chose **proprietary / all rights
   reserved**. Added a root `LICENSE` (Copyright (c) 2026 Peter Cooper, all
   rights reserved) and updated `CONTRIBUTING.md`. Resolved in the 2026-06-14
   review, Chunk 1.
2. `[FIXED]` **`docs/FromBeacon/` provenance unconfirmed** — added
   `docs/FromBeacon/README.md` stating the directory is third-party reference
   material only, with all original copyright (© John Franklin 2017) retained
   and **no claim of redistribution rights** asserted. Files retained for
   reference; removal offered on rights-holder request. Resolved in the
   2026-06-14 review, Chunk 1.
3. `[FIXED]` **No `SECURITY.md`** — added a vulnerability-disclosure policy
   directing reports through GitHub private security advisories, with supported
   scope and a do-not-include-real-PII note. Resolved in the 2026-06-14 review,
   Chunk 1.

---

## Linting & tooling (ImprovementPlan Chunk 3)

1. `[DEFERRED]` **Newer `eslint-plugin-react-hooks` rules not adopted** — the
   v7 plugin's recommended set adds `react-hooks/set-state-in-effect` (~27
   sites) and `react-hooks/immutability` (~25 sites), which would each require
   real component refactors. The plugin is pinned to v5 (`rules-of-hooks` +
   `exhaustive-deps`) for the baseline. Revisit alongside the frontend
   dedup/refactor work (Chunks 8/10), then consider upgrading to v7.
2. `[OPEN]` **`react-hooks/exhaustive-deps` left as a warning (~30 sites)** —
   each is a `useEffect`/`useMemo`/`useCallback` with an incomplete dependency
   array. Warnings do not fail CI. Audit and fix incrementally; some are
   deliberate (mount-only effects) and can take an inline disable with a note.
3. `[ACCEPTED]` **`react/no-unescaped-entities` disabled** — apostrophes and
   quotes in JSX text render correctly; escaping them is noise.
4. `[PARTIAL]` **`shared/constants.js` lint/format coverage** — Chunk 10
   (2026-06-14) brought `shared/` under **Prettier** via the backend's
   `format` / `format:check` scripts (`prettier ... "../shared/**/*.js"`), so CI
   now enforces its formatting. **ESLint** is not yet applied: ESLint 9 flat
   config refuses files outside the config file's base path, so a sibling
   package cannot lint `../shared` without root-level tooling (a root
   `package.json` + `eslint.config.js` + a CI job). That is disproportionate for
   a single 182-line constants file; add it only if `shared/` grows into
   multiple modules with real logic.
5. `[FIXED]` **`pdfmake` migrated 0.2.x → 0.3.x** — Chunk 10 (2026-06-14)
   migrated `backend/src/routes/letters.js` off the removed
   `pdfmake/src/printer` class to the 0.3 server singleton (`require('pdfmake')`
   → register Roboto fonts into `pdfmake.virtualfs`, declare the family with
   `addFonts`, lock the URL/local access policies, then
   `await pdfmake.createPdf(doc).getBuffer()`). The Dependabot ignore rule for
   pdfmake minor bumps was removed. Verified by the existing
   `letters.test.js` PDF-download test (asserts an `application/pdf` body).
   (Was surfaced 2026-06-14 when grouped Dependabot PR #429 broke backend tests.)

---

## Frontend deduplication (ImprovementPlan Chunk 8)

1. `[ACCEPTED]` **Privilege strings not centralised** — owner decision: hoisting
   the ~90 `can('resource','action')` call sites into a constants module adds
   indirection without a real safety gain. `storageKeys.js` and `routes.js`
   (frequent targets) were created; privilege strings stay inline.
2. `[OPEN]` **`useAsyncLoad` not adopted on multi-load / filter pages** — the
   shared hook only fits single-payload loaders. Pages that fan several
   `Promise.all` loads into different state (e.g. `MembershipRenewals`,
   `Calendar`) or re-fetch on a button using current filter values (e.g.
   `EmailDelivery`, `FinanceLedger`, `MemberList`, `GroupList`, `AuditLog`) were
   left as hand-rolled effects, because the memoised `reload` would capture
   stale filter state. Revisit if the hook grows a "manual-args" mode.

---

## Oversized frontend pages (ImprovementPlan Chunk 10, finding M2)

1. `[OPEN]` **A few pages still over the ~700-line guideline** — Chunk 10 split
   all the originally-flagged M2 pages (extraction only, no behaviour change):
   `MemberEditor.jsx` (2,317 → 1,994), `EntityMembers.jsx` (722 → 583),
   `GroupRecord.jsx` (1,128 → 152), `TeamRecord.jsx` (889 → 125),
   `Calendar.jsx` (1,125 → 861), and (2026-06-13 follow-up) `TransactionEditor.jsx`
   (1,097 → 792), `CreditBatches.jsx` (1,028 → 446), `MemberList.jsx` (921 → 453),
   `FinanceLedger.jsx` (892 → 395), `SystemDashboard.jsx` (832 → 458). Two parents
   remain over the guideline and could take a further extraction pass if revisited:
   `MemberEditor.jsx` (~1,994 — the address/partner block is the largest remaining
   chunk but is heavily intertwined with shared form state) and `Calendar.jsx`
   (~861 — its filter form and "other"-mode event management). `TransactionEditor.jsx`
   (792) is close to the line and is mostly the flat top-level field grid.

---

## Backend service-layer extraction (ImprovementPlan-2026-06-14 Chunk 3)

1. `[OPEN]` **Largest route files still carry their business logic.** Chunk 3
   established the service-layer pattern end-to-end on one route:
   `routes/finance/transactions.js` (747 → 179) now delegates all logic and data
   access to the new `services/transactionService.js`, with Zod validation kept
   at the route boundary (mirrors `services/authService.js`). The two larger
   offenders remain to be extracted the same way in follow-up sessions:
   `routes/backup/restore.js` (~1,512) and `routes/members/crud.js` (~1,037).
   Each is a behaviour-preserving extraction — the route's existing tests must
   pass unchanged. `routes/public/join.js` (~768) and the rest of
   `routes/finance/*` are lower priority.

---

## UI Terminology

1. `[FIXED]` **Group/Team Cash — "Central Ledger" vs "Finance Ledger" wording** — The
   shortcut button on the Group Cash and Team Cash tabs says **"Central Ledger"**
   (tooltip: *"View this group's/team's other transactions - in the central ledger"*).
   The description line above it previously called the same destination the "Finance
   Ledger", which was inconsistent. Resolved 2026-06-14 (ImprovementPlan Chunk 7): the
   description line now reads "The central ledger shows different, complementary
   transactions", matching the button. The destination page keeps its "Finance Ledger"
   menu/page title (its own name); the tooltip already bridges the two terms.

---

## Online Joining / Members Portal

1. `[DEFERRED]` **Duplicate application detection limited by shared emails** — Some members
   genuinely share the same email address (e.g. couples). Any future duplicate
   detection logic for online applications must account for this — checking by
   email alone would produce false positives. Consider using email + surname
   combination, and warn rather than block.

2. `[DEFERRED]` **Real PayPal API integration** — The initial implementation uses stub functions
   with clear interfaces. Actual PayPal REST API / IPN integration needs to be
   built. Ref: docs 7.9, 7.9.1, 9.8.

3. `[DEFERRED]` **Shared email address handling** — When two members share an email address,
   the portal registration and login flow needs special handling (doc 10.2
   section c). The backend login route has minimal handling (tries each member
   with that email sequentially), but there is no UI disambiguation — if two
   members share the same email and password, the user cannot select which
   member they are. Deferred to a later phase.

---

## Documentation Typos

1. `[FIXED]` **Doc 7.10.5 — Pending Transactions bulk action eligibility** — The original
   Beacon manual bullet says transactions are eligible if they "Are not in the Current
   financial year", which contradicts its own footnote (out-of-year transactions must be
   opened individually). beacon2026's actual behaviour is correct — bulk checkboxes appear
   only on in-year, non-cleared, non-batched transactions. Resolved 2026-06-14
   (ImprovementPlan Chunk 7): added an editor's note to the faithful BeaconUG
   transcription flagging the source error (rather than silently rewriting the original),
   and documented the correct eligibility in `docs/beacon2026UG/34-pending-transactions.md`.

---

## User Guide — Screenshots

1. `[OPEN]` **beacon2026 User Guide images are missing** — the 64-section guide under
   `docs/beacon2026UG/` references screenshots (`![...](images/<name>.png)`) across
   ~61 sections, but the `docs/beacon2026UG/images/` directory does not yet exist, so
   every embedded image renders as a broken link. The guide *text* is complete and
   accurate. Deferred because the screenshots must be captured from a running
   beacon2026 instance — per `CLAUDE.md`, image content must not be guessed at, so the
   user will supply (or approve) the screenshots. To resolve: capture each
   referenced image, name it to match the existing `images/<name>.png` references,
   and add the `images/` directory. Identified in the 2026-06-14 documentation
   review.

---

## System Settings (doc 8.3) — Deferred Items

1. `[FIXED]` **public_phone, public_email, home_page** — Now displayed to members as a
   "Need help? Contact us" block (shared `frontend/src/components/PublicContact.jsx`)
   on the Members Portal sign-in page and the online Join form, fed by the new public
   `GET /:slug/info` endpoint and the extended join-config response. Resolved in the
   2026-06-14 review, ImprovementPlan Chunk 7. (Confirmation-email inclusion remains a
   possible future enhancement but was out of scope.) Ref: doc 8.3.

---

## Member Record (doc 4.2 / 4.3)

1. `[DEFERRED]` **Member-to-member navigation in compact view** — The original Beacon member record
   has a dropdown with < > arrows to navigate directly between members without returning
   to the Members List. This should be added to the compact member view
   (`MemberCompactView.jsx`) as a future enhancement. Ref: Beacon member record screenshot.

---

## Group / Member Contact Hiding (doc 4.2.4)

1. `[DEFERRED]` **`hide_contact` / `show_addresses` not enforced in the group members view** —
   The per-member `hide_contact` and per-group `show_addresses` fields are stored and
   editable, but the shared `EntityMembers.jsx` table (used by GroupRecord/TeamRecord)
   unconditionally renders address, telephone and mobile for every row, and the backend
   (`routes/groups/members.js`, `routes/teams/members.js`) returns all contact data
   without filtering.

   **Real blocker (re-verified 2026-06-14, ImprovementPlan Chunk 7):** correct
   enforcement must hide contact *from group leaders only*, not from membership
   admins (UG 4.2.4). beacon2026 has no runtime signal for "this viewer is a leader":
   the scoped privileges `group_records_as_leader` / `group_records_as_member` are
   **seeded** (`seed/privilegeResources.js`, `seed/defaultRoles.js`) **but enforced
   nowhere** — every group members route is gated solely by `group_records_all`. A
   naive "hide for everyone holding `group_records_all`" would wrongly hide contact
   from admins. So this depends first on implementing the scoped group-leader access
   model (a separate, larger piece of work). The previous comparison-doc claim that
   `hide_contact` "hides email/phone in group members list" was inaccurate and has been
   corrected to Partial. Ref: doc 4.2.4.

2. `[DEFERRED]` **System-wide "Hide Address from Group Leaders" setting** — Doc 4.2.4(b) describes a
   global system setting that hides addresses of ALL members from ALL group leaders (unless
   they have other privileges). This setting is not yet implemented in beacon2026.
   Ref: doc 4.2.4, doc 8.3.

---

## Accessibility / E2E

1. `[OPEN]` **Form labels missing `htmlFor`/`id` association** — Many `<label>` elements
   lack `htmlFor` attributes (and their inputs lack `id`). This breaks Playwright
   `getByLabel()` and hurts screen-reader accessibility. The highest-traffic pages
   have been fixed (April 2026): MemberEditor, TransactionEditor, GroupRecord,
   SystemSettings, JoinForm, PortalPersonalDetails, UserEditor, TransferMoney,
   TransactionRefund, PersonalPreferences, and DateInput. Further pages fixed in
   ImprovementPlan Chunk 11 (June 2026): VenueEditor, MemberClassEditor (incl.
   `aria-label` on the monthly-fee grid inputs), ChangePassword, and RoleEditor.
   Further pages fixed in ImprovementPlan Chunk 9 (2026-06-14): the public auth
   pages PortalLogin, PortalForgotPassword, PortalResetPassword, and
   PortalRegister now associate every `<label>` with its input via
   `htmlFor`/`id`.
   Remaining lower-traffic pages should be fixed incrementally as E2E tests are
   written for each page.

2. `[FIXED]` **Sortable column headers not keyboard-accessible** (June 2026,
   ImprovementPlan Chunk 11, finding O5) — sortable `<th>`/`<span>` headers were
   `onClick`-only. The shared `SortableHeader` component and the inline
   forename/surname split headers are now focusable and activate on Enter/Space
   via `lib/a11y.js` (`clickableKeyProps`); `SortableHeader` also exposes
   `aria-sort`. Note: the RoleEditor privilege-matrix toggle-all headers (a
   non-sortable bulk-toggle affordance) remain `onClick`-only — out of scope for
   the sortable-header fix; fix incrementally if revisited.

---

## E2E Test Coverage — Deferred Items

1. `[DEFERRED]` **Email send action** — Email compose UI is tested but the Send button is NOT
   clicked in tests because SendGrid integration is not live in the test environment.
   When SendGrid is enabled, add a test that sends to a test address and verifies
   the delivery record appears.

2. `[DEFERRED]` **PDF/Excel download verification** — Tests verify that download buttons are
   present but do not verify the downloaded file content. Future tests should
   intercept the download and check Content-Disposition / file size / basic content.

3. `[DEFERRED]` **Membership renewals bulk action** — The renewals page structure is tested but
   the "Renew selected" bulk action (which creates finance transactions and changes
   statuses) is not exercised. Add a full-cycle test: seed member -> renew -> verify
   status change + transaction.

4. `[DEFERRED]` **Portal registration and login flow** — The Members Portal has a separate auth
   system (identity verification, email verification, password). E2E tests for the
   full portal flow (register -> verify email -> login -> view groups -> edit details ->
   request card) are deferred due to complexity (separate browser context, email
   verification step). Ref: docs 10.1, 10.2.

5. `[DEFERRED]` **Online joining flow** — The public joining form -> PayPal stub -> payment
   confirmation flow is not tested end-to-end. Deferred until PayPal integration
   is real or a dedicated test mode is added.

6. `[DEFERRED]` **Password recovery and force-change-password** — Multi-step auth flows
   (identify user -> security Q&A -> temp password -> force change) are not tested.
   These require careful state management (user with `must_change_password` flag).

7. `[DEFERRED]` **Data restore** — Only data export is tested (spec 11). The restore flow
   (upload .xlsx -> auto-detect format -> import) is not tested because it would
   destructively overwrite the test tenant's data mid-run.

### Remaining uncovered routes

- `[DEFERRED]` **Email Delivery Detail** (`/email/delivery/:id`) — requires a SendGrid delivery
  record; deferred until email integration is testable.
- `[DEFERRED]` **Transaction Refund** (`/finance/transactions/:id/refund`) — requires an eligible
  transaction (not cleared, not GA-claimed); could be added when a suitable
  transaction exists in the test flow.
- `[DEFERRED]` **Change Password** (`/change-password`) — requires a user with
  `must_change_password` flag; adding this test requires creating a user with
  the flag and logging in as that user (separate browser context).

---

## Data Export / Restore — Deferred Items

1. `[DEFERRED]` **Member photos not exported** — `photo_data` (base64, up to 2.7 MB per member)
   and `photo_mime_type` are excluded from the Members export because large base64
   blobs would make Excel files unmanageably large. A separate photo export mechanism
   (e.g. ZIP of images keyed by membership number) would be needed.

2. `[ACCEPTED]` **Email batches / recipients not exported** — `email_batches` and
   `email_recipients` are delivery history (SendGrid message IDs, per-recipient
   status). This is transient data that cannot be meaningfully restored, so it
   is deliberately excluded.

3. `[ACCEPTED]` **Calendar export type is a placeholder** — the "Calendar" export in Data
   Backup produces a single-row sheet noting that events are exported with the Groups
   export (Group Events sheet). Owner decision (2026-06-14, ImprovementPlan Chunk 7):
   **leave as-is** rather than removing the option or duplicating the events into a
   second sheet. The placeholder message was reworded to state accurately where events
   live (it previously said "Calendar is not yet implemented", which was misleading
   since the calendar/events feature is fully built).

4. `[DEFERRED]` **Beacon restore — group-tied calendar events not migrated** — `restoreBeacon()`
   now imports Open Meetings (Calendar rows with `gkey` empty) but skips group-tied
   Calendar rows. Restoring those would require resolving the `gkey` to its
   `groupMap` entry and confirming the per-group event semantics carry over. Defer
   until needed; for now the group schedule has to be re-entered post-restore.

---

## Feature Toggles — deferred phases

All items in this section have been completed (v0.8.6).

## Render / Deployment — Deferred Items

- `[FIXED]` **`beacon2026.vercel.app` login failed with "Failed to fetch"
  while `beacon2.vercel.app` still worked.** Cause: `CORS_ORIGIN` on Render
  was left pointing at the old `beacon2.vercel.app` domain after the rename,
  so the browser blocked the cross-origin request from the new one (no CORS
  headers = generic fetch failure, not a helpful error). Fixed by setting
  `CORS_ORIGIN` to `https://beacon2026.vercel.app` in Render. That domain is
  now canonical; `beacon2.vercel.app` is retired. Also fixed in the same pass:
  `SystemLogin.jsx`/`SystemDashboard.jsx` still hardcoded a "Beacon2" header
  (PR #465). Resolved 2026-08-01.
- `[ACCEPTED]` **Backend service keeps the `beacon2-backend.onrender.com` URL.**
  Renaming a Render service (done 2026-07-30, beacon2 → beacon2026) does not
  change its auto-generated `*.onrender.com` hostname — Render never renames
  that slug after creation. To get a `beacon2026`-branded URL you'd need to
  either recreate the service (risks losing the existing DB link — the
  database itself also can't be renamed, it stays `beacon2_a89s`) or add a
  custom domain. Left as-is for now since it's cosmetic only; revisit if a
  custom domain is wanted before general availability.
- `[FIXED]` **`DATABASE_URL` on Render confirmed correct** — checked in the
  dashboard 2026-08-01, holds the real internal connection string, not just a
  label.
- `[FIXED]` **Render backend service was in Docker mode with the wrong build
  context, breaking every deploy** (`COPY backend/ ./backend/: not found`).
  Happened because the service was recreated via Render's "New Web Service"
  wizard rather than "New → Blueprint" against `render.yaml`, so it
  auto-detected `backend/Dockerfile` and defaulted to Docker with Root
  Directory `backend` — but that Dockerfile expects a repo-root build
  context. Fixed 2026-08-01 by setting Dockerfile Path =
  `backend/Dockerfile` and Docker Build Context Directory = `.` in Render's
  service settings, without recreating the service. See
  `DEPLOYMENT.md` → Troubleshooting for the general fix if this recurs.

## Temporary UI — Deferred Items

- `[DEFERRED]` **Menu "NEW" badges are temporary and should be removed.**
  Added 2026-08-01 to call out the sections that are genuinely new in
  beacon2026 vs the original Beacon (Teams, Utilities, SQL reports, Feature
  configuration, Event types) for admins who are used to Beacon. Implemented
  as `isNew: true` on the relevant item objects in `Home.jsx`'s `sections`
  array, rendered via the top-level `NewBadge()` function in the same file.
  Once admins no longer need the callout, delete the `isNew` flags and the
  `NewBadge` component/render calls.
