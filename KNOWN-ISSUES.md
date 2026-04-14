# Beacon2 — Known Issues and Deferred Items

Items noted during development that need addressing in future sessions.

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

---

## Feature Toggles — deferred phases

1. **System Dashboard integration** — System admins should be able to view and change
   feature configuration for any tenant from the System Dashboard. Currently,
   system-admin-only toggles (Finance, Email, Portal, Online Joining) can only be
   changed via direct database access. Ref: `SYS_ADMIN_ONLY_KEYS` in
   `backend/src/routes/settings.js`.

2. **Confirmation dialogs** — When turning off a master toggle for a module that has
   existing data (e.g. turning off Finance when transactions exist), the UI should
   show a confirmation dialog warning that the feature will become inaccessible.
   Currently toggles switch immediately with no warning.

3. **Feature config in data backup/restore** — The `feature_config` column is not
   included in the data export/restore cycle. Add it to the backup Excel export and
   restore import so that feature configuration is preserved across backup/restore
   operations. Ref: `backend/src/routes/backup.js`.
