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

**Status:** the four questions this note opened with — audience,
driving use case, credential model and ownership — were all settled on
2026-08-01 and are recorded in the decisions table below. This is a
decided plan awaiting implementation, not a proposal awaiting a
verdict. The one remaining external dependency is the Third Age
Trust's agreement to own the published interface (phase 0b).

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

## Design decisions

These are the choices the rest of this note is built on. Changing any
of them changes the shape of the work. All were settled on 2026-08-01;
none is still open.

| Decision | Choice |
|---|---|
| Audience | **All u3as, not just ours.** Settled 2026-08-01. This is a published national interface, not an internal tool, and the versioning, documentation and support commitments below follow from it. |
| Driving use case | **A u3a's own SiteWorks website.** Settled 2026-08-01. Other consumers are welcome, but the first release is scoped to what a website needs and nothing more. |
| Credential for the first release | **Anonymous, no key.** Settled 2026-08-01. API keys are phase 3 and conditional — they are built only if a consumer appears that needs more than already-public data. |
| Number of public surfaces | **One.** A single versioned API under `/api/v1`, serving every external consumer. |
| Direction of data flow | **Read-only for v1.** beacon2026 remains the source of truth and exposes it; it accepts no writes through this API. Writes already have purpose-built flows (online joining, Members Portal). |
| Access tiers | **Three tiers on the same routes** — anonymous, API key, member — differing only in which fields are projected, never in which routes exist. |
| Anonymous visibility rule | **The anonymous tier can never expose more than the u3a's existing public web pages already do.** It is driven by the existing `group_info_config` / `calendar_config` `public` toggles. No second visibility model. |
| Member data | **API key plus an explicit scope, never anonymous.** Shipped last, as its own decision, with its own privacy-policy wording. |
| Opt-in | **Per-u3a.** A new `publicApi` feature toggle, off by default. A u3a that does nothing is unaffected. |
| Versioning | **`v1` in the path, additive-only.** New fields may be added; existing fields never change meaning or disappear within a version. |
| Credential type | **Dedicated API keys**, not JWTs. Stored hashed, tenant-scoped, scoped by resource, revocable, with a recorded last-used time. |
| Documentation | **OpenAPI 3.1**, hand-written and checked into the repo, served at `/api/v1/openapi.json`. |
| Interface owner | **The Third Age Trust.** Settled 2026-08-01. The Trust owns the published contract and is the change-control authority; beacon2026 implements it. Named as owner in the published documentation, with a Trust contact route for integrators. |
| Deprecation notice | **Six months minimum.** Settled 2026-08-01. No field or endpoint in v1 is withdrawn or changed in meaning with less than six months' published notice, signalled in-band by `Deprecation` and `Sunset` response headers (RFC 8594) as well as on the published documentation page. |

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

**One deliberate exception, recorded during phase 1.** Faculties
(interest areas) have no entry in `group_info_config`, so nothing in
Public Links governs them and they are not covered by the rule as
stated. They are exposed anyway — `id` and `name` only — on the
narrower ground that a faculty is pure taxonomy: a label a u3a
invented to categorise its own groups, carrying no personal data of
any kind, and the organising axis that makes a website's groups page
useful at all. The same reasoning covers the `faculty` / `facultyId`
fields on a group.

The exception is noted here rather than left in a code comment because
it slightly weakens a rule the rest of this design leans on, and
anyone auditing that rule should meet the exception at the same time
as the rule. If it is ever revisited, `routes/api/faculties.js` and
the faculty fields in `routes/api/groups.js` are the only two places
to change.

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

**Four decisions settled while building it (phase 2, 2026-08-01).** Each
is part of the published contract, so each is recorded here rather than
only in the code.

- **Bounded, not paginated.** A calendar client fetches the whole file
  every time, so `?limit=` and `?offset=` are meaningless here. Instead
  the feed carries events from **180 days ago onwards, with no end date,
  up to 5000 events**. Both numbers are in the OpenAPI description. The
  window is the one thing a subscriber could notice changing, so
  widening it later is safe and narrowing it is not.
- **`Europe/London` with a `VTIMEZONE`, not floating time and not UTC.**
  Floating times read correctly in Britain and an hour out for a member
  looking at their calendar from abroad; UTC loses the summer-time
  transition. Spelling the timezone out costs seventeen lines once.
- **`DTSTAMP` from the row's `updated_at`, never from the clock.** A
  feed built from `now()` differs on every request, which defeats the
  `ETag` and turns every poll into a full download — exactly the load
  the caching design exists to avoid.
- **`UID` is `<event id>@<slug>.beacon2026` and is frozen.** It is how a
  subscriber's calendar recognises an event it already holds. Changing
  the recipe would not break anything visibly; it would silently give
  every existing subscriber a duplicate of every event, with no way for
  us to know and no way for them to fix it except unsubscribing. This is
  the single most irreversible commitment in v1.

The feed is only half the value while nothing in beacon2026 tells a
member the URL exists. A "subscribe to this calendar" link on the public
Calendar page is the obvious companion, and is a frontend change rather
than an API one — carried in `KNOWN-ISSUES.md` rather than done here, so
that phase 2 stayed the size it was estimated at.

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

**Serving all u3as tilts this decisively towards pull.** Push means
holding a WordPress application password for every participating u3a,
encrypted at rest and each one a credential we are responsible for; it
means a worker whose failures are per-tenant and whose retry queue we
have to monitor across hundreds of sites; and it means a
reconciliation view someone has to actually look at. Pull means a
plugin the u3a installs, credentials we never hold, and failure that
is local, visible and their own. At one u3a the two are arguable. At
several hundred, the operational asymmetry is large enough that push
should now be treated as the exception — justified per u3a by a real
need for content to live in WordPress — rather than the default
direction of travel.

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

**Status: phases 0, 1 and 2 are built** (2026-08-01), and phase 2b has a
proof of concept — see the correction below, which the proof of concept
turned up and which this note did not anticipate. What remains open
within the built phases — the Trust agreement, the deprecation-notice
channels, and a first run against a real database — is tracked in
`KNOWN-ISSUES.md`, not here.

### Correction: what a SiteWorks site already has (2026-08-01)

This note assumed phase 2b filled a gap. It does not, and the estimate
and the argument above should be read with that in mind.

Every SiteWorks site already runs **`u3a-siteworks-core`** (v2.1.2),
which registers `u3a_group`, `u3a_event`, `u3a_venue` and `u3a_contact`
post types, ships the `u3a/grouplist`, `u3a/groupdata`, `u3a/venuelist`
and `u3a/venuedata` blocks, and is styled by `u3a-siteworks-theme`.
Beside it, **`u3a-importexport`** defines a Groups / Events / Venues /
Contacts CSV format — the manual export-and-import that is today's
Beacon-to-website path.

So a display plugin does not add groups to a site that had none. It
stands next to a mature, themed Groups system, and a u3a running both
has two of everything.

That reopens the push/pull table above with a row it does not contain.
Push was rejected because *we* would have to hold a WordPress
application password for every u3a. But a plugin **the u3a installs**
can pull from `/api/v1` and materialise the results into those existing
post types — real WordPress posts, indexed by search engines, styled by
the theme, with every existing block and page working untouched, and no
credential held by anyone but the u3a. It would replace the CSV round
trip, which is the part that actually hurts.

The proof of concept built in August 2026 is nonetheless the **display**
plugin as specified here, deliberately: it is the smaller of the two,
it exercises the API end to end, and it is the cheaper thing to throw
away. The choice between the two shapes is recorded as an open decision
in `KNOWN-ISSUES.md` and should be made before anything is released.

| Phase | Contents | By hand | With Claude Code |
|---|---|---|---|
| **0** | This decision recorded and the boundary published: internal vs public, versioning policy, the no-anonymous-PII invariant, and the Trust's six-month deprecation policy. No code. | ½ day | 2 hours |
| **0b** | **Trust agreement to own the interface.** Not development work and not estimable in developer-weeks, but a prerequisite for *publishing* rather than for building. Start it in parallel with phase 1. | — | — |
| **1** | Anonymous read API — org, faculties, venues, groups, events. Router tree, tenant/tier middleware, projections, envelope, pagination, ETag and caching, the four `app.js` fixes, `publicApi` toggle, `Deprecation`/`Sunset` header support, OpenAPI document, tests. | 2 weeks | 3–4 days |
| **2** | `events.ics` iCalendar feed, including the per-group filter. | 3 days | ½ day |
| **2b** | **SiteWorks display plugin** — one WordPress plugin, shared by every u3a, rendering groups and events from the API with sensible caching. Separate codebase; the deliverable most u3as will actually see. | 2 weeks | ½–1 week |
| **3** *(conditional)* | API keys — table, hashing, scopes, admin page, one-time reveal, revocation, key-authed field expansion, documentation for integrators. | 2 weeks | 3–4 days |
| **4** *(conditional)* | Member endpoints — `/members/stats` first, then individual records if genuinely needed. | 1 week | 2 days |
| **5 (later)** | Webhooks; cross-tenant region/network aggregation; write access. | Defer; estimate when scoped. | — |

**Phases 0–2b are the committed scope; phases 3–5 are conditional.**
That follows directly from the two answers above: a website consumer
needs only already-public data, so it needs no key, and it needs no
member records. Phases 3 and 4 are therefore not deferred work with a
date on it — they are work we build *if and when* a consumer turns up
that phases 1–2 cannot serve. Carrying them as "planned" would invite
building an authentication system for nobody.

Phase 1 is heavier than it looks because it carries all the
scaffolding; phase 2 is small precisely because phase 1 has already
paid for the routing, tenant resolution and projection layer.

The natural checkpoint is after phase 2: put the API behind the u3a
website, run it for a term, and let real use — not this document —
decide whether phase 3 is ever worth starting.

### What the "with Claude Code" figure does not include

- **Your time.** These are compressed developer-hours with an active
  driver, not time you can spend elsewhere.
- **Integrator support.** Onboarding the first u3a webmaster, writing
  the worked example they will actually copy, and answering their
  questions is real work that does not scale down with Claude.
- **WordPress infrastructure.** The phase 2b figure covers writing the
  plugin, not a throwaway SiteWorks instance to develop it against, nor
  submission and review if it is to be distributed centrally rather
  than passed around as a zip.

---

## Settled questions and risks

**Settled 2026-08-01.** All three opening questions have been
answered:

- **The driving use case is a u3a's SiteWorks website**, not a
  general-purpose data platform. The committed scope is phases 0–2;
  phases 3–5 are conditional on evidence rather than planned work.
- **Anonymous-first**, not keys from day one. Phases 1 and 3 stay
  separate, and the first release needs no key distribution, no key
  storage and no revocation story.
- **It is for all u3as**, not only ours.

The first two reinforce each other: a website only ever needs data the
u3a has already chosen to publish, so the first release can be smaller
and safer than the general case.

The third pulls the other way, and is the most consequential of the
three. It does not add features — the endpoint list is unchanged — but
it changes what each of them *commits us to*:

- **Versioning stops being a good intention.** With one consumer, a
  breaking change is a phone call. With hundreds, v1 is permanent.
  Every field in the first release should be treated as forever.
- **Anonymous-first gets better, not worse.** Issuing, storing,
  rotating and revoking keys for hundreds of u3as would be a
  significant standing administrative burden, all of it falling on
  whoever runs beacon2026. Anonymous access scales to any number of
  u3as at zero marginal admin cost. This decision was already
  recommended; at national scale it becomes close to essential.
- **Per-u3a opt-in becomes essential rather than merely tidy.** The
  `publicApi` toggle defaulting to off means a u3a that has never
  heard of this is unaffected by it, which is the right default when
  the u3a — not us — is the data controller.
- **A shared WordPress display plugin becomes the main deliverable,
  not an afterthought.** One plugin serving every SiteWorks site is a
  far better outcome than a few hundred webmasters each writing their
  own fetch code, and it is the difference between a support load we
  can carry and one we cannot. It is added as phase 2b below.
- **Caching and rate limiting become load-bearing.** They were already
  in the design; at this scale they are what stands between us and an
  outage. The upside is that anonymous responses are public and
  cacheable, so they can sit behind a CDN cheaply if volume warrants.

**Governance settled 2026-08-01: the Third Age Trust owns the
interface, with six months' deprecation notice.** That answers the
last open question and closes the design. Three things follow.

**It is a dependency, not just a decision.** Naming the Trust as owner
assigns it a standing obligation — change control, a contact route for
integrators, and a support expectation from every u3a that integrates.
That agreement has to be secured *before* v1 publishes, because the
commitment is unilateral in the wrong direction otherwise: u3as would
be relying on a promise the Trust has not made. This is an
organisational conversation rather than a technical task, it is not on
the critical path for *building* phases 1–2b, and it **is** on the
critical path for publishing them. Worth starting early, since it will
move more slowly than the code.

**Six months' notice needs a channel, and anonymous access removes the
obvious one.** This is the one real tension the settled decisions
create between them: anonymous access is what lets the API scale to
every u3a with no administrative burden, and the price is that we do
not know who our integrators are, so we cannot email them. The
recommended answer is three overlapping channels, none of which
requires knowing anyone's identity:

- **In-band headers.** `Deprecation` and `Sunset` (RFC 8594) on every
  affected response, from the moment notice starts. A well-built
  client can surface these; the phase 2b plugin should log them
  visibly in WP admin, which covers most u3as automatically.
- **A published changes page**, owned by the Trust, linked from the
  OpenAPI document, stating the current version and the date until
  which it is guaranteed.
- **Voluntary integrator registration** — an email address on a
  notification list, no key and no authentication attached. Cheap,
  optional, and it recovers the ability to notify for the integrators
  who care enough to sign up.

**It sets a floor on v1's lifetime.** Publishing v1 commits to it for
at least six months past any future notice, so the honest planning
assumption is that **every field shipped in phase 1 is supported for
well over a year.** That is an argument for shipping fewer fields
initially, not more: an omitted field can be added at any time as an
additive change, whereas a field shipped carelessly is load-bearing
for years. Where there is doubt about a field, leave it out.

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
- **Contact-detail harvesting at scale.** This one is a direct
  consequence of serving all u3as and deserves care. Where a u3a has
  ticked "contact — public", the anonymous response carries leader
  names, and the free-text `enquiries` field frequently contains an
  email address or phone number. None of that is *newly* exposed — the
  existing public groups page already renders it — but a uniform,
  documented, national API changes the economics of collecting it from
  "scrape several hundred differently-built websites" to "one loop".
  The invariant should not be broken to fix this; it is the backbone
  of the design. Mitigations instead: keep rate limiting meaningful
  for anonymous callers, do not add a bulk cross-tenant endpoint (a
  deliberate non-feature), and warn u3as on the Public Links page that
  anything ticked public is machine-readable. Worth raising with
  whoever owns the interface before v1 rather than after.
- **Load.** Several hundred u3a websites polling uncached would not be
  survivable on the current Render plan. Mitigation: caching and ETags
  from day one, documented guidance that integrators should cache, and
  a shared plugin that caches properly so that good behaviour is the
  default rather than something each webmaster has to get right. CDN
  fronting is available if volume warrants it.
- **Support burden.** Every published API acquires users who need
  help, and at national scale that is the cost most likely to be
  underestimated. The single most effective mitigation is that the
  phase 2b plugin should be good enough that the common case involves
  no support at all.

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

Phases 1, 2 and 2b — the read API, the iCalendar feed and the shared
SiteWorks plugin — are the committed first delivery, at roughly
**four and a half developer-weeks by hand, or one and a half to two
weeks of calendar time with Claude Code in the loop.** They cover the
website use case and the member-calendar use case between them.

**API keys and member endpoints are not scheduled work** — they are
options we hold, to be exercised only if a consumer appears that
already-public data cannot serve. Anonymous access is what lets this
scale to every u3a without a standing administrative burden.

The one thing that must not be deferred is the consequence of building
for all u3as: **v1 is a promise to people we will never meet.** The
Third Age Trust owns that promise and has six months' notice to honour
before anything in it changes, so the deprecation policy, the OpenAPI
document and the Trust's contact route belong in the first release —
they are cheap to publish alongside v1 and impossible to impose
afterwards.

Two practical consequences worth carrying into phase 1. First,
**secure the Trust's agreement early**; it gates publishing rather
than building, and it will move more slowly than the code. Second,
**ship fewer fields than feel natural.** Six months' notice means
anything published in phase 1 is load-bearing for well over a year,
while anything omitted can be added at any time without notice at all.
The asymmetry is entirely one-way, and it should be reflected in every
judgement call about what goes in the first response.
