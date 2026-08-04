# Beacon2026 Tidying — Work Plan

> **Status:** active working plan, started 2026-08-04. This is a prioritised,
> chunked pass through the live backlog in
> [`../KNOWN-ISSUES.md`](../KNOWN-ISSUES.md) — it doesn't add new findings,
> it sequences the `[OPEN]`/`[DEFERRED]` items already there into sessions.
> Each chunk is sized to fit one session. Update the **Status** column as work
> lands; leave the KNOWN-ISSUES.md entry itself as the source of truth for
> *what* the item is — this file tracks *when/whether* it gets done.

## How to use this file

- Work chunks roughly in order — later chunks assume earlier ones are done
  where there's a dependency (noted inline).
- Mark a row's Status as it changes: `NOT STARTED` → `IN PROGRESS` → `DONE`
  (with PR #) or `SKIPPED` (with a one-line reason).
- If a chunk turns out to need splitting, split it — don't force unrelated
  items into one PR just to keep the table tidy.
- `[CONDITIONAL]` items (API keys, member endpoints) are deliberately **not**
  in this plan — they're not scheduled work, they're "build only if a real
  need appears." Leave them in KNOWN-ISSUES.md only.

---

## Chunk 1 — Session/audit hygiene (in progress)

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 1.1 | Inactivity timeout didn't revoke the refresh token/cookie, only logged an audit entry | "Audit log — session-restore visibility" (fixed part) | **DONE — PR [#500](https://github.com/PeterC66/Beacon2026/pull/500)** |
| 1.2 | `/auth/refresh` silent session restores write no audit entry (multi-day sessions invisible in the log) | "Audit log — session-restore visibility" #1 | NOT STARTED — needs a throttled `session_resume` action so it doesn't flood the log on every ~15-min token refresh |

---

## Chunk 2 — Security backlog (small, self-contained)

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 2.1 | `POST /users` inserts the user row before validating role escalation — orphans a roleless user on a blocked attempt (no privilege escalation, data-hygiene only) | Security #27 | NOT STARTED |
| 2.2 | `resolveTokens` callers in `public.js`/`portal.js` still use `body` not `bodyHtml` for templated emails (latent — only `console.log`'d today) | Security #23 | NOT STARTED — do together with/before any SendGrid wiring for those flows |
| 2.3 | Frontend CSP still report-only — flip to enforced per the runbook in `DEPLOYMENT.md` | Security #25 | NOT STARTED — needs a clean report-window check in production first, can't verify from dev |

---

## Chunk 3 — Code health: backend service-layer extraction

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 3.1 | Extract `routes/backup/restore.js` (~1,512 lines) into a service, mirroring `transactionService.js` | "Backend service-layer extraction" #1 | NOT STARTED — behaviour-preserving, existing tests must pass unchanged |
| 3.2 | Extract `routes/members/crud.js` (~1,037 lines) the same way | "Backend service-layer extraction" #1 | NOT STARTED |

## Chunk 4 — Code health: frontend page size + lint warnings

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 4.1 | Further-split `MemberEditor.jsx` (~1,994 lines) — address/partner block | "Oversized frontend pages" #1 | NOT STARTED |
| 4.2 | Further-split `Calendar.jsx` (~861 lines) — filter form / "other"-mode event management | "Oversized frontend pages" #1 | NOT STARTED |
| 4.3 | Audit and fix the ~30 `react-hooks/exhaustive-deps` warnings incrementally | "Linting & tooling" #2 | NOT STARTED — some are deliberate mount-only effects; add an inline disable + note for those rather than forcing a dep |
| 4.4 | Adopt `useAsyncLoad` on multi-load/filter pages once it grows a "manual-args" mode | "Frontend deduplication" #2 | NOT STARTED — blocked on the hook gaining that mode first |

---

## Chunk 5 — Accessibility

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 5.1 | Add `htmlFor`/`id` label associations on remaining lower-traffic pages | "Accessibility / E2E" #1 | NOT STARTED — do incrementally as E2E tests are written for each page, per existing convention |

---

## Chunk 6 — Documentation

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 6.1 | Capture the ~61 missing screenshots for `docs/beacon2026UG/` | "User Guide — Screenshots" #1 | NOT STARTED — needs the user to supply/approve screenshots from a running instance; not something to generate unattended |

---

## Chunk 7 — Public read API (`/api/v1`) readiness

Dependency note: 7.1–7.2 should happen before any u3a is actually pointed at
the feed; 7.3–7.4 are decisions, not code, and gate the SiteWorks plugin work.

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 7.1 | Smoke-test `/api/v1` against a real (non-mocked) database — enable `publicApi` on the demo tenant and hit every endpoint incl. `events.ics` | Public API #10 | NOT STARTED |
| 7.2 | Subscribe to `events.ics` from one real calendar client (Google/Apple/Outlook) | Public API #2 | NOT STARTED — do alongside 7.1 |
| 7.3 | Add a "Subscribe to this calendar" link on the public Calendar page + per-group entry | Public API #1 | NOT STARTED |
| 7.4 | Decide push-plugin vs. pull-into-`u3a-siteworks-core` before further SiteWorks plugin work | Public API #4 | NOT STARTED — decision needed from the owner, not a coding task |
| 7.5 | Secure Trust agreement to own/publicise the API interface | Public API #9 | NOT STARTED — not code; gates publicising v1 widely |
| 7.6 | Deprecation-notice channels (Trust-owned changes page, optional notification list) | Public API #8 | NOT STARTED |

---

## Chunk 8 — Product features (deferred, larger pieces of work)

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 8.1 | Scoped group-leader privilege model (`group_records_as_leader`/`_as_member`) — currently seeded but enforced nowhere | "Group / Member Contact Hiding" #1 | NOT STARTED — blocks 8.2 below |
| 8.2 | Enforce `hide_contact`/`show_addresses` in the group members view, once 8.1 lands | "Group / Member Contact Hiding" #1 | NOT STARTED |
| 8.3 | System-wide "Hide Address from Group Leaders" setting (doc 4.2.4b) | "Group / Member Contact Hiding" #2 | NOT STARTED |
| 8.4 | Member-to-member `< >` navigation in compact member view | "Member Record" #1 | NOT STARTED |
| 8.5 | Portal: shared-email-address login disambiguation | "Online Joining / Members Portal" #3 | NOT STARTED |
| 8.6 | Portal: real PayPal REST/IPN integration (currently stubbed) | "Online Joining / Members Portal" #2 | NOT STARTED |
| 8.7 | Duplicate online-application detection (email + surname, warn not block) | "Online Joining / Members Portal" #1 | NOT STARTED |
| 8.8 | Member photos not included in data export (needs a separate ZIP-style mechanism) | "Data Export / Restore" #1 | NOT STARTED |
| 8.9 | Beacon restore: group-tied calendar events not migrated | "Data Export / Restore" #4 | NOT STARTED |
| 8.10 | Remove menu "NEW" badges once admins are used to the new sections | "Temporary UI" | NOT STARTED — owner call on timing |

---

## Chunk 9 — Legal (blocked on external party)

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 9.1 | `CookieConsent.jsx` wording pending Third Age Trust permission | "Repo hygiene & licensing" #4 | BLOCKED — owner is seeking permission; do not reword unilaterally |

---

## Chunk 10 — Test flakiness

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 10.1 | `TransferMoney.test.jsx` amount-validation test times out intermittently under CPU load | "Test flakiness" #1 | NOT STARTED — raise the timeout or await the button explicitly instead of `findByRole` racing the data load |

---

## Chunk 11 — E2E coverage gaps

Lower priority than the above — these are missing tests, not missing
behaviour. Batch into one or two sessions once Chunks 1–5 are clear.

| # | Item | KI ref | Status |
|---|------|--------|--------|
| 11.1 | Email send action (needs SendGrid live in test env) | "E2E Test Coverage" #1 | NOT STARTED |
| 11.2 | PDF/Excel download content verification | "E2E Test Coverage" #2 | NOT STARTED |
| 11.3 | Membership renewals bulk action full-cycle test | "E2E Test Coverage" #3 | NOT STARTED |
| 11.4 | Portal registration/login full flow | "E2E Test Coverage" #4 | NOT STARTED |
| 11.5 | Online joining flow end-to-end | "E2E Test Coverage" #5 | NOT STARTED — deferred until PayPal is real (see 8.6) or a test mode exists |
| 11.6 | Password recovery / force-change-password flow | "E2E Test Coverage" #6 | NOT STARTED |
| 11.7 | Data restore flow | "E2E Test Coverage" #7 | NOT STARTED — destructive, needs a disposable test tenant |
| 11.8 | Email Delivery Detail page | "E2E Test Coverage" (remaining routes) | NOT STARTED |
| 11.9 | Transaction Refund page | "E2E Test Coverage" (remaining routes) | NOT STARTED |
| 11.10 | Change Password page (must-change-password user) | "E2E Test Coverage" (remaining routes) | NOT STARTED |

---

## Explicitly out of scope for this plan

- **API keys (phase 3)** and **member endpoints (phase 4)** of the public API
  — `[CONDITIONAL]` in KNOWN-ISSUES.md, build only if a real consumer need
  appears.
- Anything already `[ACCEPTED]` in KNOWN-ISSUES.md (deliberate design
  decisions, not backlog).
