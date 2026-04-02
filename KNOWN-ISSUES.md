# Beacon2 — Known Issues and Deferred Items

Items noted during development that need addressing in future sessions.

---

---

## Online Joining / Members Portal (deferred from initial implementation)

1. ~~**Joint membership online joining**~~ — **Done.** When a joint membership class is
   selected, the form shows second-person fields and creates both members linked at the
   same address with bidirectional partner_id.

2. **Duplicate application detection limited by shared emails** — Some members
   genuinely share the same email address (e.g. couples). Any future duplicate
   detection logic for online applications must account for this — checking by
   email alone would produce false positives. Consider using email + surname
   combination, and warn rather than block.

3. ~~**Members Portal — online renewals**~~ — **Done.** Portal members can renew online
   when `portal_config.renewals` is enabled. Supports joint renewal and Gift Aid.

4. ~~**Members Portal — photo upload**~~ — **Done.** Photo upload implemented in
   PortalPersonalDetails.jsx (base64 storage, JPEG/PNG/GIF, max 2 MB). Photos appear
   on membership cards and group members PDF.

5. **Public groups list and calendar public pages** — The Public Links page now shows
   URLs for public groups list and calendar, but the actual public-facing pages at
   those routes are not yet built. Ref: doc 9.4 section (b).

6. **Real PayPal API integration** — The initial implementation uses stub functions
   with clear interfaces. Actual PayPal REST API / IPN integration needs to be
   built. Ref: docs 7.9, 7.9.1, 9.8.

7. **Shared email address handling** — When two members share an email address,
   the portal registration and login flow needs special handling (doc 10.2
   section c). Deferred to a later phase.

---

## Membership Cards (doc 4.7)

1. **Auto-attach cards to confirmation emails** — `email_cards` setting exists in
   tenant_settings but the integration with the online joining/renewal confirmation
   email flow is not yet implemented. Ref: doc 4.7 section about System Settings.

2. **Members Portal: Replacement card PDF attachment** — The portal replacement card
   feature (doc 10.2.5) now exists but currently only sends a confirmation email
   (stubbed). The actual PDF card attachment to the email needs to be wired up when
   SendGrid integration is completed.

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

2. **email_cards** — The "E-mail membership cards" checkbox is stored but the logic to
   auto-attach membership card PDFs to online joining/renewal confirmation emails is not
   yet implemented. Ref: doc 8.3, doc 4.7.

3. ~~**gift_aid_online_renewals**~~ — **Done.** Controls Gift Aid checkboxes on
   the portal renewal page.

4. ~~**online_renew_email**~~ — **Done.** Displayed on the portal renewal page as
   contact email for renewal enquiries.

---

## Migration DDL warnings

1. ~~**`users_member_id_fkey` constraint already exists**~~ — **Fixed.** Resolved by
   wrapping the `ALTER TABLE ADD CONSTRAINT` in a `DO $$ ... EXCEPTION WHEN
   duplicate_object THEN NULL; END $$` block in `tenant_schema.sql` (line ~701).
   No more cosmetic error on re-runs.

---

## Cookie Consent — Deferred Optional Cookie Items

The cookie consent dialog lists eight optional items. The following are fully
implemented and persist via localStorage gated by cookie consent:

- Last u3a site, inactivity timeout, name sort/display, text size/theme (original four)
- Last membership class for exporting addresses and labels (`beacon2_last_export_class`)
- Label printing settings (`beacon2_label_settings`) — now consent-gated
- Email compose 'From' address and copy selection (`beacon2_email_compose_prefs`)

All eight optional cookie items are now fully implemented.

---

## Member Record (doc 4.2 / 4.3)

1. ~~**Photo upload**~~ — **Done.** Photo upload/view/remove implemented on member record
   and Members Portal; photos appear on membership cards and group members PDF.

2. **Member-to-member navigation in compact view** — The original Beacon member record
   has a dropdown with < > arrows to navigate directly between members without returning
   to the Members List. This should be added to the compact member view
   (`MemberCompactView.jsx`) as a future enhancement. Ref: Beacon member record screenshot.

---

## Group / Member Contact Hiding (doc 4.2.4)

1. **Per-group `show_addresses` not wired into visibility logic** — The `show_addresses`
   boolean field exists on the group record and is stored/retrieved via the API, but the
   group members table in GroupRecord.jsx only checks the per-member `hide_contact` flag
   when deciding whether to show email/phone. The `show_addresses` toggle should also
   control whether addresses are visible to group leaders viewing that group's member list.
   Ref: doc 4.2.4.

2. **System-wide "Hide Address from Group Leaders" setting** — Doc 4.2.4(b) describes a
   global system setting that hides addresses of ALL members from ALL group leaders (unless
   they have other privileges). This setting is not yet implemented in Beacon2.
   Ref: doc 4.2.4, doc 8.3.

---

## Accessibility / E2E

1. **Form labels missing `htmlFor`/`id` association** — ~106 `<label>` elements
   across ~33 files lack `htmlFor` attributes (and their inputs lack `id`).
   This breaks Playwright `getByLabel()` and hurts screen-reader accessibility.
   Login.jsx was fixed; remaining forms should be fixed incrementally as E2E
   tests are written for each page.

---

## E2E Test Coverage — Deferred Items

The following areas have E2E spec files (01–18) covering page-load, structure
verification, and CRUD workflows. Deeper interaction tests for some areas are
deferred:

1. **Email send action** — Email compose UI is tested but the Send button is NOT
   clicked in tests because SendGrid integration is not live in the test environment.
   When SendGrid is enabled, add a test that sends to a test address and verifies
   the delivery record appears.

2. **PDF/Excel download verification** — Tests verify that download buttons are
   present but do not verify the downloaded file content. Future tests should
   intercept the download and check Content-Disposition / file size / basic content.

3. **Membership renewals bulk action** — The renewals page structure is tested but
   the "Renew selected" bulk action (which creates finance transactions and changes
   statuses) is not exercised. Add a full-cycle test: seed member → renew → verify
   status change + transaction.

4. ~~**Credit batch full workflow**~~ — **Done.** Spec 13 now tests the full
   create-batch → select-transactions → create → verify-in-list → delete-batch flow.
   Falls back gracefully when no unbatched transactions are available.

5. **Portal registration and login flow** — The Members Portal has a separate auth
   system (identity verification, email verification, password). E2E tests for the
   full portal flow (register → verify email → login → view groups → edit details →
   request card) are deferred due to complexity (separate browser context, email
   verification step). Ref: docs 10.1, 10.2.

6. **Online joining flow** — The public joining form → PayPal stub → payment
   confirmation flow is not tested end-to-end. Deferred until PayPal integration
   is real or a dedicated test mode is added.

7. **Password recovery and force-change-password** — Multi-step auth flows
   (identify user → security Q&A → temp password → force change) are not tested.
   These require careful state management (user with `must_change_password` flag).

8. **Data restore** — Only data export is tested (spec 11). The restore flow
   (upload .xlsx → auto-detect format → import) is not tested because it would
   destructively overwrite the test tenant's data mid-run.

### Previously uncovered routes — now tested (April 2026)

The following routes had no E2E coverage and have now been added:

- **Configure Account** (`/finance/accounts/:id/configure`) — page-load test via
  accounts list → "configure" link. Verifies pending-transactions and refunds
  controls are visible. (spec 13)
- **Payment Method Defaults** (`/finance/payment-method-defaults`) — page-load test
  via accounts list link. (spec 13)
- **Audit Record detail** (`/audit/:id`) — click-through from the audit log's "When"
  column, verifies detail page loads. (spec 10)
- **Member Compact View** (`/members/:id/compact`) — navigates from member editor
  to compact view, verifies heading and action buttons. (spec 14)

### Remaining uncovered routes

- **Email Delivery Detail** (`/email/delivery/:id`) — requires a SendGrid delivery
  record; deferred until email integration is testable.
- **Transaction Refund** (`/finance/transactions/:id/refund`) — requires an eligible
  transaction (not cleared, not GA-claimed); could be added when a suitable
  transaction exists in the test flow.
- **Change Password** (`/change-password`) — requires a user with
  `must_change_password` flag; adding this test requires creating a user with
  the flag and logging in as that user (separate browser context).
