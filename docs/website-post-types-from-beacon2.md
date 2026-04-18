# Creating and modifying SiteWorks post-types from Beacon2

## Why this note exists

`docs/website-editing-options.md` sets out four broad architectures (A–D) and
five editing tiers for letting Beacon2 users edit the u3a SiteWorks WordPress
website. It recommends starting with option A (link out to WordPress) because
it is the cheapest reversible step.

This note is a deeper dive into a narrower, higher-value question: what would
it take for Beacon2 itself to **create and modify the structured SiteWorks
custom post-types** — `u3a_group`, `u3a_event`, `u3a_venue`, `u3a_contact` —
so that the website reflects Beacon2 data automatically, without anyone
logging into WordPress to maintain those entries.

This is a specific form of option D from the earlier note, confined to
structured content that Beacon2 already models. Free-form pages and news
posts are out of scope for this work; a note at the end covers how they
might be incorporated later.

---

## Design decisions already taken

These are the choices this plan is built on. Changing any of them would
change the shape of the work significantly.

| Decision | Choice |
|---|---|
| Direction of data flow | **Beacon2 → WordPress only.** Beacon2 is the source of truth. Beacon2 writes; it does not read the website back except to detect mismatches. |
| Exclusion model | **Per post-type default plus per-post override.** Each u3a decides, for each of the four post-types, whether Beacon2 manages that type. Individual posts can be flagged "not managed by Beacon2" on the WordPress side and Beacon2 will leave them alone. |
| Post-types in scope | `u3a_group`, `u3a_event`, `u3a_venue`, `u3a_contact`. Notices are handled as a special event type inside Beacon2 and flow through `u3a_event`. Generic WordPress `post` and `page` are out of scope for now. |
| Rollout | **Phased.** Groups first, then events, then venues and contacts. Each phase is a delivery that stands on its own. |
| Authentication to WordPress | **WordPress Application Passwords (built into WP core) plus a small Beacon2 companion plugin.** Application Passwords carry the authentication load; the companion plugin only provides the per-post "Beacon2-managed" flag, an admin overview and a handful of UI affordances. No custom auth code. |
| Push trigger | **Background queue** with an optional "publish now" action. Saves commit locally and an async worker pushes to WordPress within a short interval. A failed push is retried with exponential backoff. |
| Beacon2-side delete | **Trash the WordPress post** (reversible within WP's trash retention window). |
| WordPress-side delete | **Reconciliation view.** Beacon2 does not silently re-create a deleted post nor silently flip the Beacon2 record. It surfaces the mismatch for a human. |

---

## What has to be built in Beacon2

### Backend

- **Per-u3a integration settings.** Stored in the existing tenant settings
  pattern. Fields: website base URL; Application Password (encrypted at
  rest, never returned to the frontend once saved); per-post-type "manage
  this type" switch for each of the four in-scope types; a
  last-successful-sync timestamp per type for diagnostics.
- **Outbox table.** One row per pending change:
  `tenant_id, entity_type, entity_id, operation (create|update|delete),
   payload_hash, attempts, next_attempt_at, status, last_error`.
  The outbox is the single source of truth for what still needs to happen;
  a row is inserted whenever a Beacon2 record is saved or deleted.
- **Worker loop.** A single job type that pulls due rows, calls the
  WordPress REST API, updates status, and schedules retries. Runs alongside
  the existing backend process; no new infrastructure.
- **Field mappers — one per post-type.** Translates a Beacon2 record into
  the shape the WordPress REST API expects, including the SiteWorks meta
  fields (`group_startdate`, `contact_phone`, etc.). This is where the
  real work lives; see §Field mapping below.
- **Reconciliation service.** Periodically walks the WordPress REST API
  for each managed post-type, compares against Beacon2's own records, and
  records three categories: (i) on both and in sync, (ii) on both but
  differing, (iii) on one only (either an orphaned WP post or an unpushed
  Beacon2 record).
- **New privilege resource** — `website_integration` — gated by the
  standard `requirePrivilege` pattern. Seeded in `privilegeResources.js`
  and granted to the Administration role in `defaultRoles.js` (per the
  CLAUDE.md rule on privileges).

### Frontend

- **Settings page** for the per-u3a integration config. Includes a "test
  connection" button that calls a read-only WP endpoint to verify the URL
  and credentials before the user ever tries to push.
- **Per-record controls** on group / event / venue / contact screens:
  a "website status" badge (`in sync`, `pending`, `error`, `excluded`,
  `not managed`) and a "publish now" action.
- **Reconciliation dashboard** showing the three categories above, with
  links into each record and actions to resolve the mismatch (re-push,
  mark excluded, delete the WP post, etc.).
- **Comparison view** (see §Comparison utility below).

---

## The Beacon2 companion WordPress plugin

Kept deliberately small. It does **not** handle authentication and it does
**not** call Beacon2. Its only job is to make "Beacon2 manages this post"
visible and controllable inside WordPress.

- A per-post meta field `_beacon2_managed` (boolean) and
  `_beacon2_record_id` (string). The latter prevents duplicates when a
  push retries.
- A meta box in the editor for the four in-scope post-types showing the
  current management state, the Beacon2 record ID, and the last-synced
  timestamp. A checkbox lets an admin flip "managed by Beacon2" off for
  this specific post.
- A "Managed by Beacon2" column in the post-type admin list so an admin
  can see at a glance which posts are owned by Beacon2.
- A read-only admin page listing all Beacon2-managed posts grouped by
  type, with counts — mainly for reassurance and audit.
- An activation check that records the plugin version; used by Beacon2
  during `test connection` to warn if the plugin is missing or outdated.

Estimated plugin size: a few hundred lines of PHP. Maintenance across
WordPress upgrades is low because the plugin uses only stable core hooks
(`add_meta_box`, `manage_{post_type}_posts_columns`, `rest_api_init`).

---

## Field mapping

This is the part most likely to surprise. Each SiteWorks post-type has a
set of custom meta keys, some of which are typed strings (dates as
`YYYY-MM-DD`), some are serialised PHP, some are comma-separated IDs.
They are not a documented API — they are the shape the SiteWorks theme
happens to expect.

The mappers therefore need care, per-type test fixtures, and a
version-stamp somewhere so we notice if a SiteWorks upgrade changes the
expectations. Specific points to watch:

- **`u3a_group`** — meeting schedule fields (day, start-time, frequency)
  have specific string formats. Beacon2's richer scheduling model will
  not always round-trip; the mapper has to choose a "best fit" summary
  for groups whose schedule is more complex than SiteWorks supports.
- **`u3a_event`** — date/time handling needs explicit `::date` / `::time`
  casts (per `CLAUDE-REFERENCE.md` §1). Recurring events may produce
  either one post or many; decide this up front.
- **`u3a_venue`** — straightforward, but deduplication matters:
  Beacon2 venue 12 should always correspond to the same WP post.
- **`u3a_contact`** — **privacy-sensitive.** Committee contact details
  are usually public on the website, but Beacon2 holds plenty of
  contact data that is not public. The mapper must explicitly filter to
  the fields intended for public display, and only for members who are
  flagged as committee / public contacts. A default of "don't push"
  is safer than "push everything the model has".

Images and featured images are excluded from phase 1 — they add file
transfer, content-type handling and media-library bookkeeping that
can be deferred.

---

## Comparison utility

Useful from day one and essential before flipping a u3a from "manual
WordPress editing" to "Beacon2-managed". For each of the four post-types:

- Pull every post of that type from WordPress (paginated REST call).
- Pair them with Beacon2 records using `_beacon2_record_id` where
  present, and title-based fuzzy match where absent.
- Show three lists: **matched and equivalent**, **matched but differ**
  (side-by-side diff of mapped fields), **unmatched** (WP-only or
  Beacon2-only).

The comparison view is read-only — no changes are made until an
administrator chooses an action per row. This makes it safe to run at
any time, including before the first push.

---

## One-off data load from SiteWorks to Beacon2

Asked whether this is possible, especially for generic pages and posts.

**For the four in-scope post-types:** technically feasible — the REST
API returns everything the comparison utility needs. In practice its
value is small, because Beacon2 already holds better-quality data for
groups, events, venues and members. The likely use case is a u3a
onboarding onto Beacon2 who is currently maintaining the website by
hand and wants a shortcut. A dev-only import script, guarded by a
feature flag, is a reasonable way to do that without building a full UI.

**For generic `post` (news) and `page`:** possible at the REST-API
level — the content, title, author and date are all accessible. The
awkward part is where the data would *go*: Beacon2 has no "generic
pages" or "news" module. Importing without a destination just dumps
HTML into a column. Two honest options:

1. **Park until there is a Beacon2 module that holds such content.**
   There is no rush; Option A (link out) already covers editing of
   pages and posts on the WordPress side.
2. **Build a minimal "Beacon2 news" module** that stores imported
   posts and lets Beacon2 users edit them; then phase 2+ of this work
   pushes them back to WordPress. That is a substantial piece of work
   in its own right — probably three to four weeks — and should not be
   bundled into the post-type sync work.

Recommendation: **defer** pages-and-posts import until the four
post-types are in production and there is real evidence of demand.

---

## Phased rollout

| Phase | Contents | Rough effort |
|---|---|---|
| **1** | All scaffolding — outbox, worker, settings page, privilege, companion plugin, reconciliation framework, comparison utility — plus the first post-type end-to-end: `u3a_group`. | 3 weeks |
| **2** | `u3a_event` (including notices). Mostly a new mapper; scaffolding is reused. | 1 week |
| **3** | `u3a_venue` and `u3a_contact`. Contacts carries the privacy-filter work. | 2 weeks |
| **4 (later)** | Generic `post` / `page` import, if demand appears. | Defer; estimate when scoped. |

Phase 1 is deliberately heavier because nothing is useful until the
outbox, worker and companion plugin all exist. Phases 2 and 3 are
incremental and low-risk once phase 1 lands.

Each phase is a self-contained release behind a per-u3a toggle, so a
u3a can opt in to groups-only without the others.

---

## Risks and open questions

- **SiteWorks meta-key stability.** If SiteWorks changes its meta keys
  in a future release, our mappers break. Mitigation: pin a tested
  SiteWorks version on each u3a's site and re-test Beacon2 integration
  before upgrading it. A warning on the settings page if the detected
  SiteWorks version is outside the tested range.
- **Companion plugin maintenance.** One plugin across many u3a
  websites. Distribution, versioning and upgrade path need deciding
  (zip on a Beacon2 release page? hosted repo? packaged inside
  Beacon2's "test connection" flow with a guided install?). Flagged
  here rather than solved.
- **Privacy for `u3a_contact`.** As noted above — default to the
  minimum set of fields, opt-in for anything more.
- **Hosting and multi-tenancy.** A single Beacon2 instance can serve
  many u3as, each with its own website and its own Application
  Password. No architectural problem, but worth stating: each outbox
  row carries `tenant_id` and the worker uses `tenantQuery()` /
  `withTenant()` throughout (per the CLAUDE.md rule on tenant queries).
- **Manual WordPress edits.** Even with the per-post "managed" flag,
  some admins will hand-edit a managed post and be surprised when
  Beacon2 overwrites it on next save. The reconciliation view, a
  clear indicator in the WordPress editor, and sensible defaults
  ("off" until an admin explicitly turns management on) all help, but
  this is a user-education issue as much as a technical one.

---

## Summary

Building Beacon2-driven creation and modification of the four SiteWorks
custom post-types is well-defined work. The heavy items — outbox, worker,
companion plugin, privilege, settings, reconciliation, comparison — are
front-loaded into phase 1 and then reused for each subsequent type.

Total effort to cover all four in-scope post-types is in the region of
**six weeks** of focused development, delivered in three releasable
phases. A one-off import from SiteWorks is feasible for the four
post-types (low value) and for generic pages/posts (blocked on the
absence of a Beacon2 destination module, best deferred).

The design stays compatible with the existing `website-editing-options.md`
recommendation: it sits alongside option A (link-out editing) rather than
replacing it, and nothing in this plan forecloses moving later to SSO
(option C) or a wider embedded editor.
