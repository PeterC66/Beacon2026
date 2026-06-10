# Beacon2 — Known Issues and Deferred Items

Items noted during development that need addressing in future sessions.

---

## Security — open findings from 2026-06-10 review

Items identified during the chunk 1 + chunk 2 security sweep that were not
fixed in the same session. See CHANGELOG 2026-06-10 for what was fixed.

1. **`force-change-password` does not verify `must_change_password`**
   (`backend/src/routes/auth.js:316`). Any authenticated user can change their
   password without supplying the current one and overwrite their security
   Q&A. Fix: gate on `must_change_password = true` and clear the flag in the
   same UPDATE.
2. **Password change does not revoke other sessions**
   (`routes/auth.js` `/change-password`, `/force-change-password`). Compromised
   sessions outlive a password change. Fix: revoke refresh tokens + call
   `invalidateUserSessions()`.
3. **Portal login has no per-account lockout** (`routes/public.js:859`).
   Admin login has lockout; portal login does not. Add the same
   `failed_login_count` + `locked_until` pattern to the `members` portal-
   credential path.
4. **Portal forgot-password emits the reset link to `console.log`**
   (`routes/public.js:955`). Either the feature is incomplete or it's leaking
   tokens via logs in production. Wire SendGrid or refuse when email is not
   configured.
5. **Account-enumeration via response timing on `/auth/recover`**
   (`routes/auth.js:248`). Send the email asynchronously or add a constant-
   time delay.
6. **Inconsistent password policy** — `PATCH /users/:id` accepts `min(8)` with
   no complexity rules, while `/force-change-password` and portal reset
   require `min(10)` + complexity. Centralise into a single helper.
7. **Refresh-token reuse detection silently no-ops without Redis**
   (`utils/redis.js:48`). Document this more prominently or persist
   invalidation marks in Postgres as a fallback.
8. **`requireSysAdmin` skips invalidation / `active` check**
   (`middleware/auth.js:47`). Sysadmin tokens stay valid for the full access-
   token lifetime regardless of account state.
9. **Temp-password generator has modulo bias** (`routes/users.js:312`,
   `routes/auth.js:346`). `b % 58` over 256-byte values is biased. Use
   rejection sampling or `crypto.randomInt`.
10. **Origin check bypass when `NODE_ENV !== 'production'`**
    (`routes/auth.js:38`). Mis-set `NODE_ENV` in staging would silently lose
    CSRF protection on `/refresh`.
11. **Privilege-string format collisions** — `${resource}:${action}` with
    resources that may contain `:` (`finance:transactions:create`). Works
    today, fragile if a future resource code includes `:create`.
12. **No targeted rate limit on portal endpoints** (`app.js:69-71`). Only
    the global 300/15min/IP `generalLimiter` covers `/public/:slug/portal/*`;
    `/auth/*` has a tighter `authLimiter`. Add a 20/15min/IP limiter per
    portal-register/login/forgot/reset/verify-email route.
13. **Portal JWT skips Redis session-invalidation check**
    (`routes/portal.js:22`). Disabling a member's portal credentials does
    not take effect until the 15-min access token expires.
14. **Verification & reset tokens logged via `console.log`**
    (`routes/public.js:804`, `:955`; `routes/portal.js:699`). Either wire
    SendGrid or refuse the request when email is not configured — don't
    persist the token and emit it to stdout.
15. **Slug regex inconsistency** — `routes/public.js:24` allows
    `[a-z0-9_-]` but `utils/db.js:27` only allows `[a-z0-9_]`. A slug
    containing `-` 500s inside `tenantQuery` rather than 400-ing at the
    edge. Unify both regexes.
16. **Photo upload doesn't validate magic bytes** —
    `routes/portal.js:726`. Mime-type is whitelisted to jpeg/png/gif and
    Helmet's nosniff blocks browser sniffing, so no XSS — but mislabelled
    payloads silently succeed and may break PDF rendering downstream.
17. **Portal login email-enumeration via differentiated responses** —
    `routes/public.js:887,891`. 401 for unknown/wrong-password but 403
    "Please verify your email" for known-unverified accounts reveals
    which emails have a portal account.
18. **`/portal/forgot-password` timing enumeration** —
    `routes/public.js:922`. Bcrypt + DB write happen only on hit;
    response time leaks account existence.
19. **No magic-byte validation on photo uploads**
    (`routes/members.js:1494`, `routes/portal.js:726`). Mime-type is
    whitelisted; nosniff blocks browser XSS. But mislabelled payloads
    silently succeed and break PDF rendering downstream — DoS vector.
20. **Email-attachment `originalname` passed through unsanitised**
    (`routes/email.js:267`). Recipients can be sent files with
    attacker-crafted names (`Invoice.pdf .exe`, control-char headers).
    Sanitise to a basename, strip control chars, cap length.
21. **`clearTenantData()` doesn't purge Redis invalidation marks**
    (`routes/backup.js:658`). After restore, stale `invalidated:slug:userId`
    keys (31-day TTL) may make fresh sessions appear pre-revoked.
22. **Multer accepts any MIME type on `/system/restore` and `/email/send`**
    (`routes/system.js:201`, `routes/email.js:16`). FileSize caps the
    only bound; per-request /email/send worst case ≈ 400 MB in memory.

---

## UI Terminology

1. **Group/Team Cash — "Central Ledger" vs "Finance Ledger" wording** — The
   shortcut button on the Group Cash and Team Cash tabs now says
   **"Central Ledger"** (tooltip: *"View this group's/team's other transactions -
   in the central ledger"*), while the description line above it and the
   destination page's title still use **"Finance Ledger"**. The two refer to the
   same thing but the inconsistency may confuse some users. Revisit if feedback
   warrants — options: align the description to "central ledger", or rename the
   button back to "Finance Ledger" (giving up the shorter label).

---

## Online Joining / Members Portal

1. **Duplicate application detection limited by shared emails** — Some members
   genuinely share the same email address (e.g. couples). Any future duplicate
   detection logic for online applications must account for this — checking by
   email alone would produce false positives. Consider using email + surname
   combination, and warn rather than block.

2. **Real PayPal API integration** — The initial implementation uses stub functions
   with clear interfaces. Actual PayPal REST API / IPN integration needs to be
   built. Ref: docs 7.9, 7.9.1, 9.8.

3. **Shared email address handling** — When two members share an email address,
   the portal registration and login flow needs special handling (doc 10.2
   section c). The backend login route has minimal handling (tries each member
   with that email sequentially), but there is no UI disambiguation — if two
   members share the same email and password, the user cannot select which
   member they are. Deferred to a later phase.

---

## Documentation Typos

1. **Doc 7.10.5 — Pending Transactions bulk action eligibility** — The document says
   transactions are eligible for bulk pending actions if they "Are not in the Current
   financial year". This should read "Are in the Current financial year" — only
   current-year transactions should be eligible for bulk pending changes.

---

## System Settings (doc 8.3) — Deferred Items

1. **public_phone, public_email, home_page** — Stored in tenant_settings and editable
   on the System Settings page, but not yet displayed anywhere to members (e.g. portal
   login page, online joining form, confirmation emails). Ref: doc 8.3.

---

## Member Record (doc 4.2 / 4.3)

1. **Member-to-member navigation in compact view** — The original Beacon member record
   has a dropdown with < > arrows to navigate directly between members without returning
   to the Members List. This should be added to the compact member view
   (`MemberCompactView.jsx`) as a future enhancement. Ref: Beacon member record screenshot.

---

## Group / Member Contact Hiding (doc 4.2.4)

1. **Per-group `show_addresses` not wired into visibility logic** — The `show_addresses`
   boolean field exists on the group record and is stored/retrieved via the API, but the
   group members table in GroupRecord.jsx unconditionally renders address, telephone, and
   mobile for every row. Neither `show_addresses` nor the per-member `hide_contact` flag
   is checked when deciding what to display. The backend also returns all contact data
   without filtering. Ref: doc 4.2.4.

2. **System-wide "Hide Address from Group Leaders" setting** — Doc 4.2.4(b) describes a
   global system setting that hides addresses of ALL members from ALL group leaders (unless
   they have other privileges). This setting is not yet implemented in Beacon2.
   Ref: doc 4.2.4, doc 8.3.

---

## Accessibility / E2E

1. **Form labels missing `htmlFor`/`id` association** — Many `<label>` elements
   lack `htmlFor` attributes (and their inputs lack `id`). This breaks Playwright
   `getByLabel()` and hurts screen-reader accessibility. The highest-traffic pages
   have been fixed (April 2026): MemberEditor, TransactionEditor, GroupRecord,
   SystemSettings, JoinForm, PortalPersonalDetails, UserEditor, TransferMoney,
   TransactionRefund, PersonalPreferences, and DateInput. Remaining lower-traffic
   pages should be fixed incrementally as E2E tests are written for each page.

---

## E2E Test Coverage — Deferred Items

1. **Email send action** — Email compose UI is tested but the Send button is NOT
   clicked in tests because SendGrid integration is not live in the test environment.
   When SendGrid is enabled, add a test that sends to a test address and verifies
   the delivery record appears.

2. **PDF/Excel download verification** — Tests verify that download buttons are
   present but do not verify the downloaded file content. Future tests should
   intercept the download and check Content-Disposition / file size / basic content.

3. **Membership renewals bulk action** — The renewals page structure is tested but
   the "Renew selected" bulk action (which creates finance transactions and changes
   statuses) is not exercised. Add a full-cycle test: seed member -> renew -> verify
   status change + transaction.

4. **Portal registration and login flow** — The Members Portal has a separate auth
   system (identity verification, email verification, password). E2E tests for the
   full portal flow (register -> verify email -> login -> view groups -> edit details ->
   request card) are deferred due to complexity (separate browser context, email
   verification step). Ref: docs 10.1, 10.2.

5. **Online joining flow** — The public joining form -> PayPal stub -> payment
   confirmation flow is not tested end-to-end. Deferred until PayPal integration
   is real or a dedicated test mode is added.

6. **Password recovery and force-change-password** — Multi-step auth flows
   (identify user -> security Q&A -> temp password -> force change) are not tested.
   These require careful state management (user with `must_change_password` flag).

7. **Data restore** — Only data export is tested (spec 11). The restore flow
   (upload .xlsx -> auto-detect format -> import) is not tested because it would
   destructively overwrite the test tenant's data mid-run.

### Remaining uncovered routes

- **Email Delivery Detail** (`/email/delivery/:id`) — requires a SendGrid delivery
  record; deferred until email integration is testable.
- **Transaction Refund** (`/finance/transactions/:id/refund`) — requires an eligible
  transaction (not cleared, not GA-claimed); could be added when a suitable
  transaction exists in the test flow.
- **Change Password** (`/change-password`) — requires a user with
  `must_change_password` flag; adding this test requires creating a user with
  the flag and logging in as that user (separate browser context).

---

## Data Export / Restore — Deferred Items

1. **Member photos not exported** — `photo_data` (base64, up to 2.7 MB per member)
   and `photo_mime_type` are excluded from the Members export because large base64
   blobs would make Excel files unmanageably large. A separate photo export mechanism
   (e.g. ZIP of images keyed by membership number) would be needed.

2. **Email batches / recipients not exported** — `email_batches` and
   `email_recipients` are delivery history (SendGrid message IDs, per-recipient
   status). This is transient data that cannot be meaningfully restored, so it
   is deliberately excluded.

3. **Calendar export type is a no-op** — the "Calendar" export button in Data Backup
   currently just notes that events are in the Groups export. Consider removing the
   Calendar export option entirely, or having it produce the same Group Events sheet
   independently.

4. **Beacon restore — group-tied calendar events not migrated** — `restoreBeacon()`
   now imports Open Meetings (Calendar rows with `gkey` empty) but skips group-tied
   Calendar rows. Restoring those would require resolving the `gkey` to its
   `groupMap` entry and confirming the per-group event semantics carry over. Defer
   until needed; for now the group schedule has to be re-entered post-restore.

---

## Feature Toggles — deferred phases

All items in this section have been completed (v0.8.6).
