# Groups, Faculties, Venues, Group Members, Group Ledgers, Calendar

Sheets: `Faculties`, `Venues`, `Groups`, `Group members`, `Group Ledgers`,
`Calendar`.

---

## `Faculties`

Categories that group interest groups. A u3a typically has a dozen or so —
"Languages", "Arts", "Sciences", etc.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `gfkey` | string | no | **Primary key** in this sheet |
| `faculty` | string | no | Display name — `Groups.faculty` references this by name |

**Cross-references:** `Groups.faculty` (by name, case-insensitive).

---

## `Venues`

Locations where groups meet. May be member homes (with `private = 1` to keep
the address out of public listings) or public venues.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `gvkey` | string | no | **Primary key** in this sheet |
| `venue` | string | no | Display name |
| `address` | string | yes | Multi-line address (single text field) |
| `postcode` | string | yes | |
| `telephone` | string | yes | |
| `contact` | string | yes | Name of contact at venue |
| `email` | string | yes | |
| `website` | string | yes | |
| `private` | boolean (0/1) | no | If true, address is private (member's home) |
| `accessible` | boolean (0/1) | no | Wheelchair / mobility accessible |
| `notes` | string | yes | Free-text notes |

**Cross-references:** `Groups.gvkey` (by key), `Calendar.gvkey` (by key).

---

## `Groups`

The interest groups themselves. The unit of "what people do at u3a."

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `gkey` | string | no | **Primary key (string token).** Used by `Group members`, `Group Ledgers`, `Calendar`. |
| `group_name` | string | no | Display name (also the FK target for `Ledger.group`) |
| `faculty` | string | yes | FK to `Faculties.faculty` (by name) |
| `venue` | string | yes | Denormalised venue name (free text — may not match a `Venues` row) |
| `status` | string | no | `'active'` or `'inactive'` (case-insensitive in source). Treat anything other than `'inactive'` as active. |
| `info` | string | yes | Public description of the group |
| `meets_when` | string | yes | Free-text frequency (e.g. "1st Tuesday of month") |
| `start_time` | time `HH:MM` | yes | |
| `end_time` | time `HH:MM` | yes | |
| `members` | integer | yes | **Denormalised count** of current members — recompute from `Group members` for accuracy |
| `max_members` | integer | yes | Capacity. Null = no cap. |
| `notes` | string | yes | Internal notes |
| `contact` | string | yes | Free-text enquiries contact (often the leader) |
| `join_online` | boolean (0/1) | no | Allow self-join via website |
| `leave_online` | boolean (0/1) | no | Allow self-leave via website |
| `waiting_list` | boolean (0/1) | no | Whether a waiting list is enabled when full |
| `notify_leader` | boolean (0/1) | no | Whether leader is emailed when membership changes |
| `leaders` | string | yes | Denormalised free-text list of leader names |
| `mkey` | string | yes | **Primary leader's `mkey`** (denormalised) |
| `mem_no` | integer | yes | **Primary leader's `mem_no`** (denormalised) |
| `leaders_count` | integer | yes | Denormalised count of leaders |
| `gvkey` | string | yes | FK to `Venues.gvkey` (by key) |
| `gfkey` | string | yes | FK to `Faculties.gfkey` (by key) — duplicate of `faculty` lookup |

**Note:** Several columns (`members`, `leaders`, `leaders_count`, `mkey`,
`mem_no`) are denormalised aggregates from `Group members`. If you need
accurate counts, recompute from `Group members` rather than trusting these.

**Cross-references:** `Group members.gkey` (by key), `Group Ledgers.gkey` (by
key), `Calendar.gkey` (by key, optional), `Ledger.group` (by name, case-insensitive).

---

## `Group members`

The membership of each group — who belongs to which group, when they joined,
whether they're a leader.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `gkey` | string | no | FK to `Groups.gkey` |
| `group_name` | string | no | Denormalised group name |
| `mem_no` | integer | no | FK to `Members.mem_no` |
| `forename` | string | no | Denormalised member forename |
| `surname` | string | no | Denormalised member surname |
| `added` | date | yes | When this person joined this group |
| `waiting` | date or `'0'` | yes | Date placed on waiting list, or `'0'` / null if not waiting |
| `leader` | boolean (0/1) | no | True if this person is a leader of the group |
| `member_status` | string | yes | Denormalised `Members.status` at time of export |

**Composite uniqueness:** `(gkey, mem_no)` — a member can only be in a given
group once.

**Waiting-list semantics:** A row with a non-null `waiting` date is currently
on the waiting list (not a full member). A row with `waiting` null/`0` and an
`added` date is a full member.

For **group popularity** analysis, count rows per `gkey` excluding rows where
`waiting` is set. For **demand**, count waiting rows separately.

---

## `Group Ledgers`

Group-level financial transactions — money the group itself collects and
spends, distinct from u3a-wide finances in the main `Ledger` sheet. Typical
entries: tea & biscuits, materials, group outings.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `gtkey` | string | no | **Primary key** in this sheet |
| `gkey` | string | no | FK to `Groups.gkey` |
| `group` | string | no | Denormalised group name |
| `date` | date | no | Date of transaction |
| `payee` | string | yes | Counterparty (member name, supplier, etc.) |
| `amount` | decimal | no | **Signed: positive = money in (e.g. fees collected), negative = money out (e.g. expense)** |
| `detail` | string | yes | Free-text description |

**Sign convention:** Same as the main `Ledger` — positive is in, negative is
out. When loading into a database, you may want to split into `money_in` and
`money_out` columns and store positives only.

---

## `Calendar`

u3a-wide events: open meetings, social events, AGMs. **Per-event attendance
is NOT recorded** in legacy Beacon — only the events themselves.

Rows where `gkey` is **non-empty** were originally a group meeting; rows with
`gkey` **empty** are u3a-wide "open meetings." For analysis purposes, both
are useful — but be aware that not all group meetings end up here (most
recurring group meetings are described only by `Groups.meets_when`).

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `ckey` | string | no | **Primary key** in this sheet |
| `date/time` | datetime | no | **Note the slash** — use `row['date/time']`. Combined date+time field. |
| `end_time` | time `HH:MM` | yes | End time only (no end date) |
| `gkey` | string | yes | FK to `Groups.gkey` if this is a group meeting; null/empty for u3a-wide events |
| `group` | string | yes | Denormalised group name |
| `gvkey` | string | yes | FK to `Venues.gvkey` |
| `venue` | string | yes | Denormalised venue name |
| `topic` | string | yes | Subject of the meeting |
| `detail` | string | yes | Long description |
| `enquiries` | string | yes | Contact for enquiries |
| `exclude_public` | boolean (0/1) | no | If true, hide from public listings |

**Parsing the `date/time` field:** values may be Excel datetime serials, ISO
`YYYY-MM-DD HH:MM:SS`, or UK `DD/MM/YYYY HH:MM`. Split into a date and a time
when loading; the `end_time` column is just a time.
