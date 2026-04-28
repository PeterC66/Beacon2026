# Members and Membership

Sheets: `Member Statuses`, `Membership Classes`, `Membership Fees`, `Members`.

---

## `Member Statuses`

Lookup table of possible member statuses. Typical values: `Active`, `Lapsed`,
`Resigned`, `Honorary`, `Deceased`. The exact set is u3a-specific.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `stakey` | string | no | **Primary key** in this sheet (used by other sheets internally) |
| `status` | string | no | Display name (e.g. "Active") — `Members.status` references this by name |
| `locked` | boolean (0/1) | no | If true, members in this status are not eligible / not paying — typically used to flag lapsed / resigned |

**Cross-references:** `Members.status` (by name, case-insensitive).

---

## `Membership Classes`

The membership types a u3a offers — e.g. "Single", "Joint", "Associate", "Life".

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `mckey` | string | no | **Primary key** in this sheet |
| `class` | string | no | Display name (e.g. "Single") — `Members.class` references this by name |
| `status` | boolean (0/1) | no | Whether this class is currently offered (named "current" in Beacon2) |
| `fee` | decimal | yes | Default annual fee |
| `family` | boolean (0/1) | no | Joint / family membership (counts more than one person) |
| `associate` | boolean (0/1) | no | Associate of another u3a (typically reduced fee) |
| `info` | string | yes | Human description shown to applicants |
| `notes` | string | yes | Internal notes |
| `locked` | boolean (0/1) | no | Locked classes can't be edited |

**Cross-references:** `Members.class` (by name, case-insensitive); `Membership Fees.mckey` (by key).

---

## `Membership Fees`

Per-month fee schedule. Beacon supports prorated fees: a member joining in
month N pays the fee for that month, not the annual rate. Month `0` (in some
exports) or `13` (in others) means "the annual default."

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `mckey` | string | no | **FK to `Membership Classes.mckey`** |
| `class` | string | no | Denormalised class name (for human reading) |
| `month` | integer | no | 1–12 = calendar month, 0 or 13 = annual default |
| `fee` | decimal | no | Fee for that month |

**Composite uniqueness:** `(mckey, month)`.

---

## `Members`

The main entity. One row per person. Couples on a joint membership get **two
rows**, both pointing at the same `akey` (address) — see "Partners" below.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `mkey` | string | no | **Primary key (string token).** Used by `u3a Officers`, `Poll assignments`, `System Users`. |
| `mem_no` | integer | no | **Membership number.** Used by `Group members` and `Ledger` for FKs. UNIQUE within the sheet. |
| `status` | string | no | FK to `Member Statuses.status` (by name, case-insensitive). |
| `title` | string | yes | "Mr", "Mrs", "Dr", etc. |
| `forename` | string | no | First name |
| `surname` | string | no | Last name |
| `suffix` | string | yes | "Jr", "OBE", etc. |
| `known_as` | string | yes | Preferred name |
| `initials` | string | yes | |
| `spare` | string | yes | Reserved / unused field — preserve, ignore for analysis |
| `mobile` | string | yes | Phone number, free-form text |
| `e-mail` | string | yes | **Note the hyphen** — use `row['e-mail']` in code |
| `affiliation` | string | yes | "Home u3a" — name of the u3a if member's primary u3a is elsewhere |
| `custom1` | string | yes | u3a-defined custom field 1 |
| `custom2` | string | yes | u3a-defined custom field 2 |
| `custom3` | string | yes | u3a-defined custom field 3 |
| `custom4` | string | yes | u3a-defined custom field 4 |
| `joined` | date | yes | Date the member first joined |
| `renew` | date | yes | Next renewal due date |
| `gift_aid` | date | yes | Date Gift Aid declaration was signed (null if not signed) |
| `class` | string | no | FK to `Membership Classes.class` (by name, case-insensitive) |
| `mem_notes` | string | yes | Free-text notes |
| `akey` | string | yes | **Address group key.** Members sharing an `akey` share an address (and are partners — see below). May be null for members with no address recorded. |
| `house` | string | yes | House name/number — denormalised onto each member |
| `address1` | string | yes | Street |
| `address2` | string | yes | Address line 2 |
| `address3` | string | yes | Address line 3 |
| `town` | string | yes | |
| `postcode` | string | yes | |
| `county` | string | yes | |
| `telephone` | string | yes | Landline (mobile is separate) |
| `add_notes` | string | yes | Address notes |
| `emergency_contact` | string | yes | Emergency contact (free text) |
| `enhanced_privacy` | boolean (0/1) | no | If true, contact info hidden in directory |
| `payment_type` | string | yes | Default payment method for renewals |

### Partners and addresses

The seven address columns (`house`, `address1`, `address2`, `address3`, `town`,
`postcode`, `county`, `telephone`, `add_notes`) are denormalised onto each
member but logically belong to an `addresses` entity keyed by `akey`. Two
members sharing the same non-null `akey` are partners (typically a couple on a
joint membership). More than two members at the same `akey` indicates either
data error or a household membership variant — flag for review.

For analysis:
- **Membership-pattern counts** should de-duplicate by `akey` if you want
  "households" rather than "individuals."
- **Renewal income** is per-membership, not per-person, so a joint membership
  pays one fee but covers two `mem_no`s.

### Membership classes vs. statuses

- `class` = the type of membership someone bought (Single, Joint, Associate)
- `status` = the lifecycle state of that membership (Active, Lapsed, Resigned)

A member can be Active in any class, or Lapsed in any class. For churn
analysis, group by `status`. For income analysis, group by `class`.

### Cross-reference table

| Where used | How |
|-----------|-----|
| `Group members.mem_no` | Integer match |
| `Group Ledgers` | not directly — only via group |
| `Ledger.member_1`, `Ledger.member_2` | Integer match on `mem_no` |
| `u3a Officers.mkey` | String key match |
| `Poll assignments.mkey` / `mem_no` | Either |
| `System Users.mkey` | String key match |
