# UX Improvements — Work Plan (2026-08-04)

> **Status:** planning only, zero code written. Ten independent UI/UX items
> requested in one session; grounded against the current codebase (file/line
> references below) so a future session can pick any row up cold. Work each
> row on its own fresh `claude/*` branch off `origin/main` per `CLAUDE.md`,
> in the sequence below where a dependency is noted.

## How to use this file

- Mark a row's Status as it changes: `NOT STARTED` → `IN PROGRESS` → `DONE`
  (with PR #) or `BLOCKED` (with what it's waiting on).
- Item 7 must land before item 1 (agreed 2026-08-04) — removing the
  "Save as standard" buttons before the admin screen exists would remove the
  only way to create an org-wide standard email/letter.
- Item 5 needs a data action against the live/demo tenant(s), not new code —
  see its row for what's already shipped vs what's still missing.

---

| # | Item | Status |
|---|------|--------|
| 7 | Admin CRUD screen for org-wide (unowned) standard emails/letters | NOT STARTED — build first |
| 1 | Remove "Save as standard email/letter" buttons from compose screens | NOT STARTED — do after #7 |
| 2 | Floating scroll arrows: scope trigger to table, fix target to full page | NOT STARTED |
| 3 | Home menu: "Poll" → "Polls" | NOT STARTED |
| 4 | Rich formatting for emails (bring to parity with letters) | NOT STARTED — approved, larger piece |
| 5 | Seed St Ives's own standard emails/letters into the existing tenant | NOT STARTED — data action, not new code |
| 6 | Un-cap table-heavy tab widths (e.g. group Members) | NOT STARTED |
| 8 | "Add Events" panel submit button: "Add Events" → "Save" | NOT STARTED |
| 9 | Unsaved-changes warning on all group/team tabs, not just Details | NOT STARTED |
| 10 | Per-tenant switch: A–Z buttons = Filter vs Jump-to-first-record | NOT STARTED |

---

## 7. Admin CRUD for standard emails/letters not owned by a team/group

**Current state (confirmed):** no dedicated screen exists for this.
- Group/team-owned standard emails/letters already have full CRUD via the
  "Std Emails"/"Std Letters" tabs on the group/team record
  ([`StdEmailsTab.jsx`](../frontend/src/components/StdEmailsTab.jsx),
  `StdLettersTab.jsx`) — built in PR #498.
- Org-wide (unowned) ones can currently only be **created**, and only as a
  side effect of clicking "Save as standard message/letter" while composing
  ([`EmailCompose.jsx:349`](../frontend/src/pages/email/EmailCompose.jsx),
  [`LetterCompose.jsx:396-411`](../frontend/src/pages/letters/LetterCompose.jsx)).
  No edit, no browse-all-in-one-place, no delete-from-a-list.
- `/system-messages` ([`SystemMessages.jsx`](../frontend/src/pages/settings/SystemMessages.jsx))
  is a **different, unrelated** fixed set of automated templates (welcome
  email, renewal reminder, etc.) — not standard messages.

**Plan:** new admin page (e.g. under System settings), privilege-gated on
`email_standard_messages_all` / `letters_standard_messages_all` (already
exist, granted to Administration per PR #498's ownership work). Lists every
org-wide standard email/letter with add/edit/delete — same shape as
`StdEmailsTab`/`StdLettersTab` but without an `entityId`. This becomes the
sole path for org-wide templates once #1 removes the compose-screen buttons.

---

## 1. Remove "Save as standard email/letter" buttons

Depends on #7 landing first (see above). Once the admin screen exists, delete
the save-as-standard button and its inline save-name row from
`EmailCompose.jsx` (~L349-370) and `LetterCompose.jsx` (~L396-425). Leave the
"Load standard message/letter" dropdown and delete-from-dropdown control in
place — those are for *using* a template while composing, unaffected.

---

## 2. Floating scroll arrows — trigger scope and target

[`ScrollButtons.jsx`](../frontend/src/components/ScrollButtons.jsx) has two
separate bugs matching what was reported:
- Visibility is already correctly scoped to the table container overflowing
  the viewport (`update()`, L52-74) — no change needed there.
- Both click handlers currently call `containerRef.current.scrollIntoView(...)`
  (L96-104), which scrolls the **table** into view, not the page. Change to
  `window.scrollTo({ top: 0, behavior: 'smooth' })` and
  `window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })`.

---

## 3. "Poll" → "Polls"

One-line label change, [`Home.jsx:349`](../frontend/src/pages/Home.jsx).

---

## 4. Rich formatting for emails and letters — approved, build it

**Current state (confirmed):**
- Letters already use TipTap (rich-text editor, JSON body) in
  `LetterCompose.jsx`, rendered to PDF via `tiptapToPdfContent()`
  (`backend/src/routes/letters.js:126-175`, confirmed working — the seeded
  "Annual Data Check Form" letter has an end-to-end PDF-generation test).
- Emails are a **plain `<textarea>`**
  ([`EmailCompose.jsx:402`](../frontend/src/pages/email/EmailCompose.jsx)) —
  no formatting, sent as plain text.

**Plan:** move email composition onto the same TipTap editor as letters
(reuse the component, don't build a second rich-text editor), store the body
as HTML (or the same JSON-doc shape, converted to HTML at send time — check
which the send pipeline wants), and send real multipart email (HTML part +
plain-text fallback) instead of plain-text-only. Needs a short investigation
first: how `sendEmail`/nodemailer is currently wired in
`backend/src/routes/email.js`, and whether `resolveTokens` (the `#TOKEN`
substitution used in templates) needs an HTML-aware variant — flagged as a
latent gap for a related flow in `KNOWN-ISSUES.md` Security #23
(`resolveTokens` callers using `body` not `bodyHtml`), worth resolving as
part of this same piece of work rather than separately.

---

## 5. Seed St Ives's own standard emails/letters into the existing tenant

**Already done, but only for *new* tenants:** PR #497 seeded two generic
email templates ("New Member Welcome", "Renewal Confirmation", genericized
from the wording you gave in `.../BeaconUG/MDs/6.1.2 Standard Email
Messages – u3a Beacon/input.md`) and one letter ("Annual Data Check Form",
built as a Tiptap doc, also genericized — St Ives-specific details like the
Needingworth address were deliberately left out of the *default* seed by
agreement, since it ships to every tenant) — but only via
`backend/src/seed/createTenant.js`, i.e. **only on tenant creation**. It was
never backfilled into St Ives's own existing tenant.

**Plan:** this is a one-off data action against St Ives's live/demo tenant,
not new code — run the same seed content (this time using the *actual*
St Ives wording you gave for the "Annual Data Check Form" letter, with the
real Needingworth address / phone / email, not the genericized default)
against that tenant's database directly, or add a small one-shot admin
script that applies `defaultTemplates.js`-equivalent content to a specified
existing tenant slug. Confirm with Peter which tenant (live vs demo) before
running it.

---

## 6. Un-cap table-heavy tab widths

Confirmed: [`GroupRecord.jsx:117`](../frontend/src/pages/groups/GroupRecord.jsx)
hard-codes `max-w-4xl` (≈896px) on the record wrapper regardless of viewport
— same pattern likely in `TeamRecord.jsx` and other record-style pages, needs
a quick sweep once started. Plan: widen data-table-heavy tabs (Members,
Events, Ledger, Std Emails/Letters) to `max-w-6xl`/`max-w-7xl` or drop the
cap entirely on a laptop-sized viewport, while keeping the Details form tab
narrower (a long form doesn't benefit from full width the way a table does).

---

## 8. "Add Events" panel button → "Save"

[`Calendar.jsx:896`](../frontend/src/pages/calendar/Calendar.jsx) — the
submit button inside the Add Events panel (`{addSaving ? 'Adding...' : 'Add
Events'}`). Change to "Save" (and probably "Saving..." for the in-flight
state). Leave the "+ Add Event" header button (L329, opens the panel) alone.

---

## 9. Unsaved-changes warning on all group/team tabs

Confirmed: `useUnsavedChanges()`
([`useUnsavedChanges.js`](../frontend/src/hooks/useUnsavedChanges.js)) is
wired into `GroupDetails.jsx`/`TeamDetails.jsx` only. Not wired into:
- the group/team Events/schedule tab
- `GroupLedger.jsx` / `TeamLedger.jsx` ("Group cash")
- `StdEmailsTab.jsx` / `StdLettersTab.jsx` (shared, used by both)

Plan: wire `markDirty()`/`markClean()` into each of those the same way
Details does — mark dirty on any field edit, call `markClean()` before
navigating away after a successful save (per the hook's own doc comment,
`markClean()` must run *before* `navigate()` in save handlers).

---

## 10. Per-tenant switch: A–Z buttons = Filter vs Jump-to-first-record

Confirmed current behaviour is filter-only:
`ALPHABET` constant in
[`memberListConstants.js:29`](../frontend/src/pages/members/memberListConstants.js),
consumed by `handleLetterClick()` in
[`MemberList.jsx:170`](../frontend/src/pages/members/MemberList.jsx), which
filters the list to that letter. `ALPHABET`/the letter-button pattern is
imported in several other files (`TeamList.jsx`, `GroupList.jsx`, etc.) —
needs a check at implementation time for how many screens should be covered
by the same switch.

**Plan:** add a new tenant feature-config key (opt-out model, same pattern as
existing keys in
[`FeatureConfig.jsx`](../frontend/src/pages/settings/FeatureConfig.jsx)) —
e.g. `az_buttons_jump_to_record` — **defaulting to `true`** (jump-to-first-
record, matching classic Beacon, per Peter's explicit instruction that this
should be the default). When on, clicking a letter scrolls to/selects the
first record starting with that letter instead of filtering the list down to
only that letter.
