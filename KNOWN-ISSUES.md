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

2. **Full Members Portal features** — The initial implementation covers only portal
   registration and login. The following portal features are not yet built:
   - Online renewals (doc 10.2.1)
   - Viewing interest groups / join & leave groups (doc 10.2.2)
   - Viewing calendar (doc 10.2.3)
   - Updating personal details (doc 10.2.4)
   - Ordering replacement membership card (doc 10.2.5)

3. **Full Public Links configuration** — The initial Public Links page only covers
   online joining toggle and URLs. The following config sections from doc 9.4 are
   deferred:
   - Configure Members Portal feature toggles (renewals, groups, calendar, etc.)
   - Configure Group Information display options (public and portal)
   - Configure Calendar display options

4. **Real PayPal API integration** — The initial implementation uses stub functions
   with clear interfaces. Actual PayPal REST API / IPN integration needs to be
   built. Ref: docs 7.9, 7.9.1, 9.8.

5. **Shared email address handling** — When two members share an email address,
   the portal registration and login flow needs special handling (doc 10.2
   section c). Deferred to a later phase.

---

## Accessibility / E2E

1. **Form labels missing `htmlFor`/`id` association** — ~106 `<label>` elements
   across ~33 files lack `htmlFor` attributes (and their inputs lack `id`).
   This breaks Playwright `getByLabel()` and hurts screen-reader accessibility.
   Login.jsx was fixed; remaining forms should be fixed incrementally as E2E
   tests are written for each page.
