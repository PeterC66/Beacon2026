# Providing an API from beacon2026

## Why this note exists

We want other systems to be able to read beacon2026 data — first and
foremost the u3a's own SiteWorks WordPress website, but also scripts,
newsletter tooling, and potentially a region or network aggregating
across several u3as.

The obvious framing is "let's add an API". That framing is wrong in a
useful way, because **beacon2026 already has an API**: the thirty-odd
route groups in `backend/src/app.js` that the React frontend consumes.
The real question is not whether to build an API but **where to draw
the line between the API we already have and one we are willing to make
promises about.**

This note answers that question, recommends a shape, and sets out a
phased plan. Finance is deliberately out of scope throughout — the
resources in scope are groups, members, events, venues and faculties.

It is a companion to `docs/website-editing-options.md` and
`docs/website-post-types-from-beacon2026.md`, which look at the same
problem from the WordPress end. The last section of this note explains
how the three fit together, and why building the read API first may
make some of the work in those notes unnecessary.

---

## The recommendation in one table

**Two APIs, deliberately separated — and only one of them is new.**

| | Internal API (already exists) | Public API (new) |
|---|---|---|
| Paths | `/members`, `/groups`, `/calendar`, … | `/api/v1/:slug/…` |
| Consumers | the beacon2026 React frontend, and nothing else | u3a websites, scripts, region/network tooling |
| Authentication | JWT access token, 15 minutes, bound to a user | anonymous, or a long-lived API key |
| Contract | none — it changes whenever the frontend needs it to | versioned; v1 never breaks |
| Documented for outsiders | no, deliberately | yes, OpenAPI |
| Field visibility | the user's privileges | the u3a's public toggles, plus key scopes |

The failure mode to design against is concrete and likely: a u3a's
webmaster discovers that `https://…/public/demo2/groups` returns clean
JSON in a browser, hard-codes it into the website, and we can no longer
change that route without breaking their site. Drawing the line before
that happens costs half a day. Drawing it after three u3as have
integrated costs considerably more, and the cost lands on them, not us.

An option we should explicitly **reject**: a separate bespoke
integration endpoint per consumer — one for WordPress, one for the
region, one for the newsletter. It looks cheaper for the first
consumer and it fragments the security review across N surfaces, each
of which has to independently get PII filtering right.

---

## Design decisions proposed

These are the choices the rest of this note is built on. Changing any
of them changes the shape of the work.

| Decision | Choice |
|---|---|
| Number of public surfaces | **One.** A single versioned API under `/api/v1`, serving every external consumer. |
| Direction of data flow | **Read-only for v1.** beacon2026 remains the source of truth and exposes it; it accepts no writes through this API. Writes already have purpose-built flows (online joining, Members Portal). |
| Access tiers | **Three tiers on the same routes** — anonymous, API key, member — differing only in which fields are projected, never in which routes exist. |
| Anonymous visibility rule | **The anonymous tier can never expose more than the u3a's existing public web pages already do.** It is driven by the existing `group_info_config` / `calendar_config` `public` toggles. No second visibility model. |
| Member data | **API key plus an explicit scope, never anonymous.** Shipped last, as its own decision, with its own privacy-policy wording. |
| Opt-in | **Per-u3a.** A new `publicApi` feature toggle, off by default. A u3a that does nothing is unaffected. |
| Versioning | **`v1` in the path, additive-only.** New fields may be added; existing fields never change meaning or disappear within a version. |
| Credential type | **Dedicated API keys**, not JWTs. Stored hashed, tenant-scoped, scoped by resource, revocable, with a recorded last-used time. |
| Documentation | **OpenAPI 3.1**, hand-written and checked into the repo, served at `/api/v1/openapi.json`. |

---

## The three access tiers

The tiers share routes and handlers. What differs is the projection —
which fields survive into the response.

### Tier 1 — anonymous

No credential. Returns exactly the fields the u3a has already marked
`public` in Public Links (`group_info_config`, `calendar_config`).

This is the important design line, and it is worth stating plainly:
**the anonymous API is a second rendering of data that is already on
the open web.** If a u3a has not ticked "venue — public", the API does
not return the venue, for the same reason the public groups page does
not show it. There is no new judgement call for a u3a to make and no
new way to leak.

This tier alone satisfies the website use case.

### Tier 2 — API key

An `Authorization: Bearer b2k_…` key, issued by a u3a administrator
inside beacon2026. Returns the anonymous fields plus whatever the
key's scopes permit — full group detail, waiting-list state, venue
addresses, member counts, and (last, and only with an explicit scope)
member records.

This is what a SiteWorks companion plugin, a region aggregator, or a
committee member's script would use.

### Tier 3 — member

Already built, and out of scope for this note: the Members Portal
routes under `/public/:slug/portal/app`, authenticated as a member.
No change proposed. It is listed here only so the map is complete and
nobody proposes a fourth mechanism for the same job.

---

## Resources

```
GET /api/v1/:slug/org            u3a name, public contact details, home page
GET /api/v1/:slug/faculties      interest areas
GET /api/v1/:slug/venues         (+ /:id)
GET /api/v1/:slug/groups         (+ /:id)   ?faculty=&status=
GET /api/v1/:slug/events         (+ /:id)   ?from=&to=&group=&type=
GET /api/v1/:slug/events.ics     iCalendar feed  ?group=
GET /api/v1/openapi.json         the specification
```

Deferred to tier 2 with an explicit scope, and to a later phase:

```
GET /api/v1/:slug/members/stats  aggregate counts only — no individuals
GET /api/v1/:slug/members        individual records
GET /api/v1/:slug/groups/:id/members
```

### A note on `events.ics`

The iCalendar feed deserves separate mention because it is the highest
value-per-line item in this plan. It is a few hours of work, requires
no client to be written, no key to be issued and no integration to be
maintained — and it lets any member subscribe to the u3a calendar in
Google Calendar, Apple Calendar or Outlook and have it stay current.

It is also the one item here that delivers value directly to ordinary
members rather than to webmasters, which makes it the easiest to
justify and the easiest to demonstrate.

---

## Cross-cutting design

**Response envelope.** Collections return
`{ data: [...], meta: { total, limit, offset } }`; single resources
return `{ data: { … } }`. Errors return
`{ error: { code, message } }` with a stable machine-readable `code`.

Note this differs from the existing public routes, which return
`{ groups: [...], u3aName }`. That is deliberate: those routes serve
the React frontend, which depends on their current shape. **Leave them
exactly as they are.** The new API is a parallel surface, not a
refactor of the old one. Duplicating a little query logic is cheaper
than a frontend regression.

**Pagination.** `?limit=` (default 50, maximum 200) and `?offset=`.
Every collection, from day one — retrofitting pagination into a
published contract is a breaking change.

**Caching.** `Cache-Control: public, max-age=300` and an `ETag` on
anonymous responses, honouring `If-None-Match`. This matters more here
than in most projects: the backend runs on a Render plan that can take
the best part of a minute to wake, and a u3a website that hits us on
every page render will be slow and will look like our fault.

**Rate limiting.** A dedicated limiter for `/api`, keyed by API key
where one is present and by IP otherwise. See the gotchas below — the
existing app-wide limiter is actively wrong for this use case.

**Feature toggle.** A new `publicApi` key in `ALL_FEATURE_KEYS`
(`shared/constants.js`), defaulting to off, surfaced on the Feature
Config page. A u3a that never turns it on gets 403 on every `/api`
route and is unaffected by all of this.

**Privilege.** A new `api_keys` privilege resource, following the
four-step process in `CLAUDE.md`: add to
`backend/src/seed/privilegeResources.js`, grant in
`backend/src/seed/defaultRoles.js` (Administration only — this should
not be a Group Leader capability), add to `ALL_PRIVS` in
`backend/src/__tests__/helpers.js`, then `requirePrivilege` on the
route and `can` in the frontend guard.

**Auditing.** Log key creation, scope change and revocation through
the existing `logAudit`. Do **not** audit individual GET requests —
a website polling every five minutes would add roughly 100,000 audit
rows a year per u3a and make the audit log useless for the things it
exists for. Recording `last_used_at` on the key row gives the same
operational answer at a fraction of the cost.

---

## What has to be built

### Backend

- **`backend/src/routes/api/` router tree** — `index.js` owning tenant
  resolution, tier detection and the response envelope, then one module
  per resource (`org.js`, `faculties.js`, `venues.js`, `groups.js`,
  `events.js`, `ics.js`). Tenant resolution is near-identical to the
  existing `resolveTenant` in `routes/public/index.js`; extract it to a
  shared helper rather than copying it, so the two can never drift.

- **Tier-detection middleware.** Reads the `Authorization` header. No
  header means anonymous. A `b2k_` key is hashed and looked up; if
  valid and active, `req.apiKey = { id, scopes }` and `last_used_at`
  is updated (throttled — no need to write on every single request).
  An invalid or revoked key is a 401, never a silent downgrade to
  anonymous, or a revoked key would appear to keep working.

- **Projection helpers.** One per resource: given a row, the tenant's
  visibility config and the current tier/scopes, return the object to
  serialise. All field-visibility decisions live here and nowhere
  else, so there is exactly one place to review for leaks and exactly
  one place to test.

- **`api_keys` table** in `tenant_schema.sql` (idempotent DDL, as
  everything there must be): `id, name, key_hash, key_prefix, scopes
  (jsonb), created_by, created_at, expires_at, last_used_at,
  revoked_at`. Store a SHA-256 hash of the key, never the key itself,
  and show the plaintext exactly once at creation.

- **iCalendar serialiser** for `events.ics`. RFC 5545, with stable
  `UID`s derived from the event id and tenant so that a subscriber's
  calendar updates events in place rather than duplicating them.

- **OpenAPI document** at `backend/src/routes/api/openapi.json`, served
  as a static route. Hand-written: with a surface this small, a
  generator is more machinery than the problem deserves, and a
  hand-written spec that a test asserts against is easier to trust
  than a generated one nobody reads.

### Frontend

- **API Keys page** under Set up — list (name, prefix, scopes, created,
  last used, revoke), create dialog with scope tick-boxes, and the
  one-time key reveal with a copy button and an unambiguous warning
  that it will not be shown again.

- **A link from Public Links.** The Public Links page is where a u3a
  administrator already goes to think about what the outside world can
  see; the API belongs in that mental model, not hidden in a separate
  corner.

- **Nothing else.** The frontend does not consume the public API. It
  keeps using the internal one, which is the whole point of the split.

---

## Four gotchas in the current `app.js`

Each of these will cost an afternoon if it is discovered at deploy
time rather than at design time. All four are consequences of
middleware that is correct for the current single-consumer app and
wrong for a public API.

1. **CORS.** `cors({ origin: process.env.CORS_ORIGIN })` echoes that
   one configured origin to every caller — it does not compare it
   against the request's `Origin`. A browser on a u3a's own domain
   therefore fails the check. The `/api` router needs
   `cors({ origin: '*' })`, and because the global `cors()` runs
   first and wins, **the `/api` router must be mounted before it.**

2. **Helmet.** `helmet()` sets
   `Cross-Origin-Resource-Policy: same-origin` by default, which
   blocks cross-origin fetches *even when CORS is correct*. This
   produces a confusing failure where the headers look right and the
   browser still refuses. Needs relaxing to `cross-origin` on `/api`
   only.

3. **Rate limiting.** `generalLimiter` is 300 requests per 15 minutes
   per IP, applied app-wide. A WordPress site is a single IP; a busy
   page or a plugin with a short cache would trip it and take the
   frontend down with it, since they share the limiter. `/api` needs
   its own limiter and must sit outside the general one — which,
   conveniently, mounting it before the global middleware also
   achieves.

4. **Slug validation.** `routes/public/index.js` and `utils/db.js`
   both guard on `/^[a-z0-9_]+$/`, and the comment there explains why
   they must stay identical: a slug the edge accepts but `tenantQuery`
   rejects becomes a 500 instead of a 400. The new router must use
   the same shared guard, which is another reason to extract the
   existing one rather than write a third copy.

---

## Members and data protection

Members are in scope for this work but they are not like the other
resources, and the plan treats them separately on purpose.

Groups, events, venues and faculties carry near-zero personal-data
risk: they are the things a u3a already publishes to attract members.
Members carry essentially all of it. Lumping them together would mean
the whole API inherits the review burden of its most sensitive
resource, and the safe 90% would wait for the risky 10%.

So:

- **No member data is ever available anonymously**, under any
  configuration. This is a code-level invariant with a test, not a
  toggle an administrator can get wrong.
- Member access requires an API key **and** an explicit scope
  (`members:read`), which is **never granted by a default role** and
  must be ticked deliberately when a key is created.
- **Aggregate before individual.** `/members/stats` — counts by
  status, class and group — satisfies most real requests (committee
  reporting, region returns) without exposing a single person. Ship
  it first and see whether individual records are actually needed.
- Each u3a is the data controller for its own members. Enabling
  member access through an API is a processing decision that u3a has
  to make, so it needs a distinct toggle, and the API Keys page
  should say so and point at the `privacy_policy_url` the tenant
  settings already hold.

The practical recommendation: **do not build member endpoints in the
first release.** Nothing in the driving use cases — website, calendar,
region aggregation — requires them.

---

## Relationship to the WordPress notes

`docs/website-post-types-from-beacon2026.md` designs a **push**
architecture: an outbox table, a retry worker, a companion plugin, and
a reconciliation view, so that beacon2026 writes group/event/venue/
contact records into WordPress as custom post-types.

This note designs a **pull** surface. The two are complementary, but
they overlap more than is comfortable, and it is worth being explicit
about the trade before committing to the heavier one:

| | Push (outbox → WP post-types) | Pull (WP plugin reads `/api/v1`) |
|---|---|---|
| Content lives in | WordPress | beacon2026 |
| Findable by search engines | yes, as real WP posts | only if the plugin renders server-side |
| Editable in the block editor | yes | no |
| Machinery required | outbox, worker, retries, reconciliation, companion plugin | a display plugin, and nothing on our side beyond the API |
| Failure mode | silent drift between the two systems | website shows stale or no data if we are down |
| Also serves non-WordPress consumers | no | yes |

**If the website only needs to display groups and events, pull is
substantially cheaper and the entire outbox/worker mechanism is
unnecessary.** Push earns its cost when the content must physically
live in WordPress — for search-engine indexing, or so that an editor
can mix it into a block-editor page.

That is a real question about how the SiteWorks site is actually used,
not a question about software, and it is worth answering before
building the worker. Building the read API first also de-risks the
push work if we do go on to do it, since the field mappers need
exactly the same projection logic.

---

## Phased rollout and effort

Estimates use the same two-figure basis as
`docs/website-post-types-from-beacon2026.md`: developer-weeks for one
experienced developer working by hand, and calendar time with Claude
Code in the loop, the latter running about a third to a half of the
former because the human driver remains the bottleneck on design
decisions, review and real-browser testing.

Both columns are rough — honest enough for go / no-go, not accurate
enough to commit a date to.

| Phase | Contents | By hand | With Claude Code |
|---|---|---|---|
| **0** | This decision recorded and the boundary published: internal vs public, versioning policy, the no-anonymous-PII invariant. No code. | ½ day | 2 hours |
| **1** | Anonymous read API — org, faculties, venues, groups, events. Router tree, tenant/tier middleware, projections, envelope, pagination, ETag and caching, the four `app.js` fixes, `publicApi` toggle, OpenAPI document, tests. | 2 weeks | 3–4 days |
| **2** | `events.ics` iCalendar feed, including the per-group filter. | 3 days | ½ day |
| **3** | API keys — table, hashing, scopes, admin page, one-time reveal, revocation, key-authed field expansion, documentation for integrators. | 2 weeks | 3–4 days |
| **4** | Member endpoints — `/members/stats` first, then individual records if genuinely needed. | 1 week | 2 days |
| **5 (later)** | Webhooks; cross-tenant region/network aggregation; write access. | Defer; estimate when scoped. | — |

Phase 1 is heavier than it looks because it carries all the
scaffolding — everything after it is incremental. **Phases 1 and 2
together are a coherent, useful release**, and the strong
recommendation is to ship them and let a real u3a use them in anger
before committing to phase 3. If the only consumer turns out to be our
own website, keys may never be needed at all.

### What the "with Claude Code" figure does not include

- **Your time.** These are compressed developer-hours with an active
  driver, not time you can spend elsewhere.
- **Integrator support.** Onboarding the first u3a webmaster, writing
  the worked example they will actually copy, and answering their
  questions is real work that does not scale down with Claude.
- **The WordPress side.** A display plugin, if we go the pull route,
  is separate work in a separate codebase.

---

## Risks and open questions

**Open questions for the project owner.** Two of these change the plan
materially and are worth settling before any code is written.

1. **Is the driving use case the SiteWorks website specifically, or
   something broader?** If it is purely the website, phases 1–2 plus a
   thin display plugin may be the entire project, and phase 3 never
   happens.
2. **Anonymous-first, or keys from day one?** This note recommends
   anonymous-first because it is genuinely lower risk — it can only
   expose already-public data — and unblocks the website with no key
   distribution problem. If instead every consumer should be
   identified and revocable from the start, phases 1 and 3 merge:
   somewhat more work up front, and no anonymous tier to deprecate
   later.
3. **Do we want other u3as using this, or only ours?** A single-u3a
   tool can be looser about versioning and documentation. Anything
   offered to other u3as needs the OpenAPI document, a support story
   and a deprecation policy, and the effort figures above assume it.

**Risks.**

- **Contract creep.** The commitment not to break v1 is easy to make
  and constraining to keep. Mitigation: keep the surface deliberately
  small, and treat every proposed field as permanent.
- **Accidental leakage through a new field.** The likeliest bug in
  this design is a future developer adding a column to the groups
  query and it appearing in the anonymous response. Mitigation: all
  projection in one place, allow-lists rather than deny-lists, and a
  test that asserts the exact key set of each anonymous response so
  that a new field fails the build rather than shipping quietly.
- **Load on a small backend.** A handful of u3a websites polling
  uncached would be noticeable on the current Render plan.
  Mitigation: caching and ETags from day one, and documented guidance
  that integrators should cache.
- **Support burden.** Every published API acquires users who need
  help. This is not a reason not to build it, but it is a real
  ongoing cost and it should be a conscious acceptance rather than a
  surprise.

---

## Summary

beacon2026 should provide **one new public API**, versioned at
`/api/v1`, read-only, opt-in per u3a, serving three access tiers from
a single set of routes — and should simultaneously make explicit that
the existing internal API is private and carries no promises.

The anonymous tier is bounded by a rule that is easy to state and easy
to test: **it can never expose more than the u3a's public web pages
already do.** That rule is what makes the first release safe enough to
ship quickly.

Phases 1 and 2 — the read API and the iCalendar feed — are the
recommended first delivery, at roughly **two and a half developer-weeks
by hand, or under a week of calendar time with Claude Code in the
loop.** They cover the website use case and the member-calendar use
case between them. Everything beyond that, including API keys and any
member data at all, should wait for evidence that it is needed.
