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
| 7 | Admin CRUD screen for org-wide (unowned) standard emails/letters | DONE — see below |
| 1 | Remove "Save as standard email/letter" buttons from compose screens | DONE — see below |
| 2 | Floating scroll arrows: scope trigger to table, fix target to full page | DONE — see below |
| 3 | Home menu: "Poll" → "Polls" | DONE — see below |
| 4 | Rich formatting for emails (bring to parity with letters) | DONE — see below |
| 5 | Seed St Ives's own standard emails/letters into the existing tenant | NOT STARTED — data action, not new code |
| 6 | Un-cap table-heavy tab widths (e.g. group Members) | DONE — see below |
| 8 | "Add Events" panel submit button: "Add Events" → "Save" | DONE — see below |
| 9 | Unsaved-changes warning on all group/team tabs, not just Details | DONE — see below |
| 10 | Per-tenant switch: A–Z buttons = Filter vs Jump-to-first-record | DONE — see below |

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

**Built:** [`StandardMessages.jsx`](../frontend/src/pages/settings/StandardMessages.jsx),
route `/standard-messages` ([`App.jsx`](../frontend/src/App.jsx)), nav entry
"Std emails & letters" under Home → Set up
([`Home.jsx`](../frontend/src/pages/Home.jsx)). Two sections (Std Emails, Std
Letters) mirroring `StdEmailsTab`/`StdLettersTab`'s list+inline-form pattern,
each filtering the existing `GET /email/standard-messages` /
`GET /letters/standard-letters` responses to `owner_group_id == null`
client-side (no server-side filter param exists) and always saving with
`ownerGroupId: null`. Gated per-section on `hasFeature('email'|'letters')` and
`can('..._all','view')`; add/edit further gated on `create`, delete on
`delete`. No backend changes needed — the tenant-wide CRUD routes already
existed. Not yet click-tested in a live browser (no local Postgres/seeded
tenant available in-session) — verified via lint, format, and the full
frontend/backend test suites (all green).

---

## 1. Remove "Save as standard email/letter" buttons

Depends on #7 landing first (see above). Once the admin screen exists, delete
the save-as-standard button and its inline save-name row from
`EmailCompose.jsx` (~L349-370) and `LetterCompose.jsx` (~L396-425). Leave the
"Load standard message/letter" dropdown and delete-from-dropdown control in
place — those are for *using* a template while composing, unaffected.

**Built:** removed `handleSaveMsg`/`saveName`/`showSaveRow`/"Save as standard
message" button+row from
[`EmailCompose.jsx`](../frontend/src/pages/email/EmailCompose.jsx) (also
dropped the now-unused `canManageStdMessages`/`can` since nothing else in the
file used them), and the equivalent
`handleSaveLetter`/`saveName`/`showSaveRow`/"Save as standard letter"
button+row from
[`LetterCompose.jsx`](../frontend/src/pages/letters/LetterCompose.jsx). Left
the "Load standard message/letter" dropdown and (on the letters page) the
"Delete standard letter" button untouched — creating/editing org-wide
templates now goes exclusively through the item #7 admin screen; group/team
leaders still create/edit their own group's templates via the Std
Emails/Letters tabs, unaffected by this change.

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

**Built:** `scrollToTop`/`scrollToBottom` in `ScrollButtons.jsx` now call
`window.scrollTo(...)` exactly as planned above, instead of
`containerRef.current.scrollIntoView(...)`. No other change — visibility
scoping was already correct. No dedicated test file existed for this
component.

---

## 3. "Poll" → "Polls"

One-line label change, [`Home.jsx:349`](../frontend/src/pages/Home.jsx).

**Built:** the `label:` field in the "Set up" nav item for `/polls` changed
from `'Poll'` to `'Polls'`. No test referenced the old label text.

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

**Built:** `EmailCompose.jsx` now uses the same TipTap editor as
`LetterCompose.jsx` — the shared config/toolbar was pulled out into
[`components/RichTextEditor.jsx`](../frontend/src/components/RichTextEditor.jsx)
so both compose screens share one implementation (`LetterCompose.jsx` was
refactored to use it too, no behaviour change there). Body is stored/sent as
the TipTap JSON-doc shape (matching `POST /letters/download`'s existing
schema) rather than HTML — `POST /email/send`'s `body` field changed from
`z.string()` to the doc-object schema. Per-recipient resolution moved into a
new [`backend/src/utils/richEmailBody.js`](../backend/src/utils/richEmailBody.js)
(`resolveRichBody()`), which walks the doc the same way
`tiptapToPdfContent()` does for letters (paragraph/heading, bold/italic/
underline, `textStyle` fontSize, alignment, hardBreak) and produces a real
HTML part plus a plain-text fallback, with `#TOKEN` values HTML-escaped so
member-supplied data can't inject markup into a broadcast — `sgMail.send()`
now gets distinct `text`/`html` instead of the old `body.replace(/\n/g,
'<br>')` shim. The old `resolveTokens()` (string-based) is untouched and
still used by `routes/portal/*.js` and `routes/public/join.js`'s
`system_messages` templates — those are a separate feature (portal/join
confirmation emails) and were out of scope here; **`KNOWN-ISSUES.md` #23
remains open**, it was never about `email.js`/`standard_messages`. The
group/team "Std Emails" tab and the tenant-wide Standard Messages admin
screen (item 7) edit these bodies as plain text (one paragraph per line) via
`simpleTiptapDoc.js`, the same simplification already used for
`StdLettersTab.jsx` — editing a richly-formatted email from either of those
screens flattens its formatting, same trade-off letters already made. Not
yet click-tested in a live browser (no local Postgres/seeded tenant available
in-session, same constraint as item 7) — verified via lint, format, and the
full frontend/backend test suites (all green), including new unit tests for
`resolveRichBody()` (marks, alignment, hardBreak, token substitution/
escaping, multi-line token values) and an integration test for `POST
/email/send` asserting the SendGrid payload's `subject`/`html`/`text`.

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

**Built:** confirmed `TeamRecord.jsx` had the identical `max-w-4xl` wrapper.
Also swept and found the same tabbed-record pattern in
[`EventRecord.jsx`](../frontend/src/pages/calendar/EventRecord.jsx)
(Details/Members/Financials) and included it. All three now compute a
`wrapperMaxW` local (`max-w-4xl` on the Details tab, `max-w-7xl` on every
other tab) and interpolate it into the outer wrapper's className, instead of
a hard-coded class — the wrapper width now responds to which tab is active.
No other record-style pages (Member, Venue, Event Type, etc.) share this
multi-tab table-heavy pattern, so they were left untouched. Not yet visually
checked in a live browser (no local Postgres/seeded tenant available
in-session, same constraint as items 4/7) — verified via lint, format, and
the full frontend test suite (all green).

---

## 8. "Add Events" panel button → "Save"

[`Calendar.jsx:896`](../frontend/src/pages/calendar/Calendar.jsx) — the
submit button inside the Add Events panel (`{addSaving ? 'Adding...' : 'Add
Events'}`). Change to "Save" (and probably "Saving..." for the in-flight
state). Leave the "+ Add Event" header button (L329, opens the panel) alone.

**Built:** the button now reads `{addSaving ? 'Saving...' : 'Save'}`. No
other change — the header "+ Add Event" button was untouched, and no test
referenced the old text. The equivalent button on the group/team Events tab
(`components/Schedule.jsx`, a separate copy) was left as "Add Events" since
it wasn't named in this item's scope.

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

**Built:** wired into all four as planned. None of these tabs navigate away
on save (they stay on the same page/tab), so the ordering constraint from the
hook's doc comment didn't apply here — `markClean()` is simply called
after each successful save/add and in each cancel handler.
`Schedule.jsx` (shared group/team Events tab): `markDirty()` in the Add
Events form's `setAdd()`, `markClean()` after a successful add.
`GroupLedger.jsx`/`TeamLedger.jsx`: introduced small `setAdd(patch)`/
`setEdit(patch)` wrappers (replacing the repeated inline
`setAddForm((p) => ...)`/`setEditForm((p) => ...)` lambdas) that call
`markDirty()` before updating state; `markClean()` after a successful
add/edit save and in `cancelEdit()`. `StdEmailsTab.jsx`/
`StdLettersTab.jsx`: same pattern via a `set(field, value)` wrapper.
Note: switching between tabs on the same record page does not itself
trigger the warning (no route/URL change happens), matching the existing
Details-tab behaviour — the guard only fires on in-app navigation away from
the page and on browser refresh/close.

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

**Built:** new opt-out feature-config key `azButtonsJumpToRecord` (camelCase,
matching every other key's convention rather than the plan's illustrative
snake_case), added to `ALL_FEATURE_KEYS` in
[`shared/constants.js`](../shared/constants.js) (automatically defaults to
`true` in every `STANDARD_IMPLEMENTATIONS` preset via `buildStandardFeatures`)
and a toggle in the "Other" section of
[`FeatureConfig.jsx`](../frontend/src/pages/settings/FeatureConfig.jsx). All
three screens using the `ALPHABET`/letter-button pattern were covered —
[`MemberList.jsx`](../frontend/src/pages/members/MemberList.jsx),
[`GroupList.jsx`](../frontend/src/pages/groups/GroupList.jsx),
[`TeamList.jsx`](../frontend/src/pages/teams/TeamList.jsx) — no others use it.
New shared hook
[`useLetterJump.js`](../frontend/src/hooks/useLetterJump.js) (real
duplication across three near-identical pages, unlike the plan's original
per-page framing) exposes `rowRef(id)` / `jumpToLetter(list, field, letter)` /
`highlightId`: each page attaches `rowRef(id)` to its table rows, and in jump
mode `handleLetterClick` calls `jumpToLetter(sorted, field, letter)` instead
of setting the `letter` filter state — `field` is `'surname'` for members
(matching the server's existing surname-based `letter` filter and the
default sort) and `'name'` for groups/teams (matching the server's
name-based filter and its `ORDER BY g.name`). The match is against whatever
order the table is currently showing (`sorted`, respecting the user's active
column sort, not forced back to surname/name order), so "first record
starting with that letter" means the first one currently visible from the
top, not necessarily alphabetically first if the user has re-sorted by
another column — this only matters when a column sort other than the default
is active. On jump, the target row gets a 1.5s amber highlight ring
(`ring-2 ring-amber-400`) distinct from the existing blue bulk-selection
outline, so the user can see where they landed. The "All" button (which has
no meaning in jump mode — there is no filter to clear) is hidden when the
toggle is on; the floating scroll-to-top/bottom arrows from item 2 already
cover top-of-page navigation. `MemberListTable.jsx`'s pre-existing but
never-read `rowRefs.current[surname[0]] = el` (dead infrastructure, keyed by
letter and overwritten on every matching row so it only ever kept the last
one) was replaced by the hook's per-id refs, which is what jump-to-*first*-
record actually needs. `GroupList.jsx`/`TeamList.jsx` had no per-row refs at
all before this. Existing `GroupList.test.jsx`/`MemberList.test.jsx` mocks
of `useAuth()` were missing `hasFeature` (not previously called
unconditionally at the top of either component) — added
`hasFeature: vi.fn().mockReturnValue(true)` to both. Not yet click-tested in
a live browser (no local Postgres/seeded tenant available in-session, same
constraint as items 4/6/7/9) — verified via lint, format, and the full
frontend/backend test suites (all green).
