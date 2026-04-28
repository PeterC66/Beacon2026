# Contacts: u3a Officers

Sheet: `u3a Officers`.

The committee / officer roster for the u3a — Chair, Treasurer, Secretary,
Membership Secretary, Webmaster, etc. Each officer is normally also a member,
linked by `mkey`.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `ofkey` | string | no | **Primary key** in this sheet |
| `office` | string | no | Title of the office (e.g. "Chair", "Treasurer") |
| `mkey` | string | yes | FK to `Members.mkey`. Null only if the officer is not a Beacon member (rare). |
| `forename` | string | yes | Denormalised member forename |
| `surname` | string | yes | Denormalised member surname |
| `e-mail` | string | yes | **Note the hyphen** — use `row['e-mail']`. May be a public office email (e.g. `chair@u3a.org.uk`) different from the member's personal email. |
| `notes` | string | yes | Free-text notes |

**Cross-references:** None outbound — this sheet is leaf data.

**Note for Analyse u3a:** This sheet is unlikely to drive analytics directly,
but useful for surfacing "who to contact about X" alongside other reports.
The denormalised `forename`/`surname` mean you can render a contact list
without joining to `Members`, but if you join, prefer the live `Members` row
(in case the officer's name changed since export).

---

## Other contact-like sheets (not in scope for Analyse u3a)

`System Users` (Beacon system logins), `Polls` and `Poll assignments` (member
polls / committees), `System Messages` (email templates) — all skipped per
project scope.
