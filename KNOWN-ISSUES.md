# Beacon2 — Known Issues and Deferred Items

Items noted during development that need addressing in future sessions.

---

## Gift Aid

1. **Joint/family membership Gift Aid handling** — When a member's class has the
   joint attribute (`is_joint`) and the payer has `gift_aid_from` set, the full
   joint fee should qualify for Gift Aid even if the partner doesn't pay tax.
   Currently the Gift Aid declaration does not apply any special joint-membership
   logic. The HMRC declaration row should show against the paying member only
   (not the partner separately). Ref: Beacon User Guide 7.8.

---

## Online Joining / Members Portal (deferred from initial implementation)

1. **Joint membership online joining** — When a member selects a joint membership
   class (`is_joint`), the joining form should show fields for the second person's
   details (name, etc.) and create both member records linked at the same address.
   Deferred to a later phase. Ref: doc 10.1, doc 9.4.1.

2. **Duplicate application detection limited by shared emails** — Some members
   genuinely share the same email address (e.g. couples). Any future duplicate
   detection logic for online applications must account for this — checking by
   email alone would produce false positives. Consider using email + surname
   combination, and warn rather than block.

3. **Members Portal — online renewals** — Online renewals (doc 10.2.1) are not yet
   built. The portal_config.renewals toggle exists but the feature is deferred.

4. **Members Portal — photo upload** — Doc 10.2.4 describes uploading a member photo
   for membership cards via the portal. This requires file/photo storage infrastructure
   (S3 or R2) which is not yet implemented. Deferred. Ref: doc 10.2.4, doc 4.3.

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

3. **gift_aid_online_renewals** — The "Show Gift Aid for online renewals" checkbox is
   stored but the online renewal flow itself is not yet built. When online renewals are
   implemented, this setting should control whether Gift Aid tick boxes appear. Ref: doc 8.3.

4. **online_renew_email** — Stored and returned in join-config, but the online renewal
   flow is not yet built. When implemented, use this as reply-to on renewal confirmation
   emails and display on the renewal form. Ref: doc 8.3.

---

## Migration DDL warnings

1. **`users_member_id_fkey` constraint already exists** — The `ALTER TABLE ADD CONSTRAINT`
   statement for the users → members FK logs error code `42710` on every re-run because
   `ADD CONSTRAINT IF NOT EXISTS` requires PostgreSQL 17+. The migration runner's
   per-statement try/catch catches this and continues — it is purely cosmetic. A `DO $$`
   block workaround is not possible because the migration runner splits statements on `;`,
   which would break the inner `ALTER TABLE` semicolon. Options to fix:
   - Upgrade to PostgreSQL 17+ and use `ADD CONSTRAINT IF NOT EXISTS`
   - Enhance `migrate.js` to support `DO $$` blocks (split on `;\n` outside `$$` fences)
   Ref: `backend/prisma/tenant_schema.sql` line ~677, `backend/src/utils/migrate.js` line ~82.

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

1. ~~**Photo upload**~~ — **Done.** Photo upload/view/remove implemented on member record;
   photos appear on membership cards and group members PDF. Portal photo upload deferred
   (portal self-service not yet built).

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
