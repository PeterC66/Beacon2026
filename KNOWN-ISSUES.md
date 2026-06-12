# Beacon2 — Known Issues and Deferred Items

Items noted during development that need addressing in future sessions.

**Status tags** — each item carries one of:

- `[OPEN]` — a genuine issue to fix when convenient.
- `[ACCEPTED]` — understood and deliberately not changing (rationale given).
- `[DEFERRED]` — worth doing but parked for a later phase / dependency.

**Related documents:** the consolidated, chunked work plan is
[`docs/ImprovementPlan.md`](docs/ImprovementPlan.md); pure code-rationalisation
items live in [`CODEBASE-RECOMMENDATIONS.md`](CODEBASE-RECOMMENDATIONS.md);
fixed security findings are in [`SECURITY-REVIEW.md`](SECURITY-REVIEW.md).

---

## Security — open findings from 2026-06-10 review

Items identified during the chunk 1 + chunk 2 security sweep that were not
fixed in the same session. See CHANGELOG 2026-06-10 for what was fixed.
These are catalogued and re-verified in `docs/ImprovementPlan.md` (Chunks 4–5).

1. `[OPEN]` **Account-enumeration via response timing on `/auth/recover`**
   (`routes/auth.js:248`). Send the email asynchronously or add a constant-
   time delay.
2. `[OPEN]` **Inconsistent password policy** — `PATCH /users/:id` accepts `min(8)` with
   no complexity rules, while `/force-change-password` and portal reset
   require `min(10)` + complexity. Centralise into a single helper.
3. `[OPEN]` **Refresh-token reuse detection silently no-ops without Redis**
   (`utils/redis.js:48`). Document this more prominently or persist
   invalidation marks in Postgres as a fallback.
4. `[OPEN]` **`requireSysAdmin` skips invalidation / `active` check**
   (`middleware/auth.js:47`). Sysadmin tokens stay valid for the full access-
   token lifetime regardless of account state.
5. `[OPEN]` **Temp-password generator has modulo bias** (`routes/users.js:312`,
   `routes/auth.js:346`). `b % 58` over 256-byte values is biased. Use
   rejection sampling or `crypto.randomInt`.
6. `[OPEN]` **Origin check bypass when `NODE_ENV !== 'production'`**
   (`routes/auth.js:38`). Mis-set `NODE_ENV` in staging would silently lose
   CSRF protection on `/refresh`.
7. `[OPEN]` **Privilege-string format collisions** — `${resource}:${action}` with
   resources that may contain `:` (`finance:transactions:create`). Works
   today, fragile if a future resource code includes `:create`.
8. `[OPEN]` **No targeted rate limit on portal endpoints** (`app.js:69-71`). Only
   the global 300/15min/IP `generalLimiter` covers `/public/:slug/portal/*`;
   `/auth/*` has a tighter `authLimiter`. Add a 20/15min/IP limiter per
   portal-register/login/forgot/reset/verify-email route.
9. `[OPEN]` **Portal JWT skips Redis session-invalidation check**
   (`routes/portal.js:22`). Disabling a member's portal credentials does
   not take effect until the 15-min access token expires.
10. `[OPEN]` **Verification tokens still logged via `console.log`**
    (`routes/public.js:804` portal register-verify, `routes/portal.js:699`
    portal email-change verify). The forgot-password leak was fixed
    2026-06-10; these two remain. Either wire SendGrid or refuse the
    request when email is not configured — don't persist the token and
    emit it to stdout.
11. `[OPEN]` **Slug regex inconsistency** — `routes/public.js:24` allows
    `[a-z0-9_-]` but `utils/db.js:27` only allows `[a-z0-9_]`. A slug
    containing `-` 500s inside `tenantQuery` rather than 400-ing at the
    edge. Unify both regexes.
12. `[OPEN]` **Photo upload doesn't validate magic bytes** —
    `routes/portal.js:726`. Mime-type is whitelisted to jpeg/png/gif and
    Helmet's nosniff blocks browser sniffing, so no XSS — but mislabelled
    payloads silently succeed and may break PDF rendering downstream.
13. `[OPEN]` **Portal login email-enumeration via differentiated responses** —
    `routes/public.js:887,891`. 401 for unknown/wrong-password but 403
    "Please verify your email" for known-unverified accounts reveals
    which emails have a portal account.
14. `[OPEN]` **`/portal/forgot-password` timing enumeration** —
    `routes/public.js:922`. Bcrypt + DB write happen only on hit;
    response time leaks account existence.
15. `[OPEN]` **No magic-byte validation on photo uploads**
    (`routes/members.js:1494`, `routes/portal.js:726`). Mime-type is
    whitelisted; nosniff blocks browser XSS. But mislabelled payloads
    silently succeed and break PDF rendering downstream — DoS vector.
16. `[OPEN]` **Email-attachment `originalname` passed through unsanitised**
    (`routes/email.js:267`). Recipients can be sent files with
    attacker-crafted names (`Invoice.pdf .exe`, control-char headers).
    Sanitise to a basename, strip control chars, cap length.
17. `[OPEN]` **`clearTenantData()` doesn't purge Redis invalidation marks**
    (`routes/backup.js:658`). After restore, stale `invalidated:slug:userId`
    keys (31-day TTL) may make fresh sessions appear pre-revoked.
18. `[OPEN]` **Multer accepts any MIME type on `/system/restore` and `/email/send`**
    (`routes/system.js:201`, `routes/email.js:16`). FileSize caps the
    only bound; per-request /email/send worst case ≈ 400 MB in memory.
19. `[OPEN]` **`/email/send` `fromEmail` field is declared but ignored** —
    `routes/email.js:205,293`. The SendGrid message hard-codes
    `FROM_ADDRESS`. Either wire it up with an allow-list, or drop the
    field from the schema.
20. `[OPEN]` **`/email/send` `replyTo` is unconstrained** — anyone with
    `email:send` can set it to any address (e.g. impersonating an
    officer). Limit to the user's own member-email + offices they hold
    (the same source as `/email/from-addresses`).
21. `[OPEN]` **`/email/delivery/:batchId/refresh` issues one SendGrid API call
    per recipient** — `routes/email.js:433`. Cap the per-click amplification.
22. `[OPEN]` **Hard-coded `FROM_ADDRESS = 'noreply@u3abeacon.org.uk'`** —
    `routes/email.js:23`. Make env-configurable so deployments under
    other domains don't fail SPF/DKIM silently.
23. `[OPEN]` **`routes/public.js` and `routes/portal.js` `resolveTokens` callers
    still use `body` for templated emails** — currently only `console.log`'d
    so latent, but when SendGrid is wired they should also use the new
    `bodyHtml` for the html field.
24. `[ACCEPTED]` **`uuid<11.1.1` buffer-bounds advisory remains** — backend `npm audit`
    shows 2 moderate findings against the `uuid` package (direct +
    transitive via `exceljs`). The advisory only affects v3/v5/v6 when a
    `buf` argument is passed. Beacon2 imports only `v4` and never passes
    a buffer, so the runtime is unaffected. Major bump (`uuid@14`) is a
    breaking change for `exceljs` and should wait for an upstream release.
25. `[OPEN]` **Frontend CSP shipped in report-only mode** — after a deploy window
    of clean reports, change `Content-Security-Policy-Report-Only` to
    `Content-Security-Policy` in `frontend/vercel.json` to enforce.
    Consider tightening `connect-src 'self' https:` to the concrete
    backend host once known.
26. `[OPEN]` **Stale comment in `App.jsx:132`** — "auth handled inside pages via
    sessionStorage" no longer reflects the in-memory sys-token model.
    Tidy when next touching the file.

---

## Repo hygiene & licensing (ImprovementPlan Chunk 2)

1. `[DEFERRED]` **No repository LICENSE** — owner has not yet chosen a licence
   (proprietary vs open-source). Until one is added, the code is treated as
   "all rights reserved" by the project owner. Decide and add a `LICENSE` file.
   Deferred during Chunk 2 (2026-06-12) pending the owner's choice.
2. `[DEFERRED]` **`docs/FromBeacon/` provenance unconfirmed** — the directory
   redistributes original Beacon source (`privileges.php`, `styles.css`)
   carrying "© John Franklin 2017 — this copyright notice must be retained",
   plus sample exports. Kept as-is for now (owner to confirm permission and
   reference-only status, then add a provenance README or remove). Deferred
   during Chunk 2 (2026-06-12).

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
4. `[OPEN]` **`shared/constants.js` not covered by either package's `lint` /
   `format:check`** — it lives outside `backend/src` and `frontend/src`, so CI
   does not enforce its style. It was Prettier-formatted once during Chunk 3.
   Add a dedicated lint/format target for `shared/` if it grows.

---

## UI Terminology

1. `[OPEN]` **Group/Team Cash — "Central Ledger" vs "Finance Ledger" wording** — The
   shortcut button on the Group Cash and Team Cash tabs now says
   **"Central Ledger"** (tooltip: *"View this group's/team's other transactions -
   in the central ledger"*), while the description line above it and the
   destination page's title still use **"Finance Ledger"**. The two refer to the
   same thing but the inconsistency may confuse some users. Revisit if feedback
   warrants — options: align the description to "central ledger", or rename the
   button back to "Finance Ledger" (giving up the shorter label).

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

1. `[OPEN]` **Doc 7.10.5 — Pending Transactions bulk action eligibility** — The document says
   transactions are eligible for bulk pending actions if they "Are not in the Current
   financial year". This should read "Are in the Current financial year" — only
   current-year transactions should be eligible for bulk pending changes.

---

## System Settings (doc 8.3) — Deferred Items

1. `[DEFERRED]` **public_phone, public_email, home_page** — Stored in tenant_settings and editable
   on the System Settings page, but not yet displayed anywhere to members (e.g. portal
   login page, online joining form, confirmation emails). Ref: doc 8.3.

---

## Member Record (doc 4.2 / 4.3)

1. `[DEFERRED]` **Member-to-member navigation in compact view** — The original Beacon member record
   has a dropdown with < > arrows to navigate directly between members without returning
   to the Members List. This should be added to the compact member view
   (`MemberCompactView.jsx`) as a future enhancement. Ref: Beacon member record screenshot.

---

## Group / Member Contact Hiding (doc 4.2.4)

1. `[DEFERRED]` **Per-group `show_addresses` not wired into visibility logic** — The `show_addresses`
   boolean field exists on the group record and is stored/retrieved via the API, but the
   group members table in GroupRecord.jsx unconditionally renders address, telephone, and
   mobile for every row. Neither `show_addresses` nor the per-member `hide_contact` flag
   is checked when deciding what to display. The backend also returns all contact data
   without filtering. Ref: doc 4.2.4.

2. `[DEFERRED]` **System-wide "Hide Address from Group Leaders" setting** — Doc 4.2.4(b) describes a
   global system setting that hides addresses of ALL members from ALL group leaders (unless
   they have other privileges). This setting is not yet implemented in Beacon2.
   Ref: doc 4.2.4, doc 8.3.

---

## Accessibility / E2E

1. `[OPEN]` **Form labels missing `htmlFor`/`id` association** — Many `<label>` elements
   lack `htmlFor` attributes (and their inputs lack `id`). This breaks Playwright
   `getByLabel()` and hurts screen-reader accessibility. The highest-traffic pages
   have been fixed (April 2026): MemberEditor, TransactionEditor, GroupRecord,
   SystemSettings, JoinForm, PortalPersonalDetails, UserEditor, TransferMoney,
   TransactionRefund, PersonalPreferences, and DateInput. Remaining lower-traffic
   pages should be fixed incrementally as E2E tests are written for each page.

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

3. `[OPEN]` **Calendar export type is a no-op** — the "Calendar" export button in Data Backup
   currently just notes that events are in the Groups export. Consider removing the
   Calendar export option entirely, or having it produce the same Group Events sheet
   independently.

4. `[DEFERRED]` **Beacon restore — group-tied calendar events not migrated** — `restoreBeacon()`
   now imports Open Meetings (Calendar rows with `gkey` empty) but skips group-tied
   Calendar rows. Restoring those would require resolving the `gkey` to its
   `groupMap` entry and confirming the per-group event semantics carry over. Defer
   until needed; for now the group schedule has to be re-entered post-restore.

---

## Feature Toggles — deferred phases

All items in this section have been completed (v0.8.6).
