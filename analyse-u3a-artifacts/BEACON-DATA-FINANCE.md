# Finance: Accounts, Categories, Ledger, Detail

Sheets: `Finance Accounts`, `Finance Categories`, `Ledger`, `Detail`.

This module is where **renewal payments** live, alongside all other u3a
income and expenditure.

---

## `Finance Accounts`

Bank accounts, cash floats, PayPal accounts — anything money flows through.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `acckey` | string | no | **Primary key** in this sheet |
| `name` | string | no | Display name (e.g. "Treasurer Current Account") — `Ledger.account` references this by name |
| `status` | boolean (0/1) | no | Active flag |
| `locked` | boolean (0/1) | no | Locked accounts can't be edited |

**Cross-references:** `Ledger.account` (by name, case-insensitive).

---

## `Finance Categories`

Income / expense categories used to classify each `Detail` line. **This is
where renewal payments are identified** — typically there is a category called
"Subscriptions", "Membership Fees", "Renewals", or similar.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `catkey` | string | no | **Primary key** in this sheet |
| `name` | string | no | Display name — `Detail.category` references this by name |
| `status` | boolean (0/1) | no | Active flag |
| `locked` | boolean (0/1) | no | Locked categories can't be edited |

**Cross-references:** `Detail.category` (by name, case-insensitive).

---

## `Ledger`

The main financial transaction log. One row per transaction (a single payment
in or out of an account). A transaction may be split across multiple
categories — those splits are in the `Detail` sheet, joined by `tkey`.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `tkey` | string | no | **Primary key (string token).** Used by `Detail.tkey`. |
| `trans_no` | integer | no | Human-readable transaction number (sequential) |
| `date` | date | no | Date of transaction |
| `account` | string | no | FK to `Finance Accounts.name` (by name, case-insensitive) |
| `amount` | decimal | no | **Signed: positive = money in, negative = money out.** When loading, derive a `type` column: `'in'` if `amount >= 0`, `'out'` otherwise; store `Math.abs(amount)`. |
| `payee` | string | yes | Free-text counterparty |
| `detail` | string | yes | Short description |
| `payment_method` | string | yes | "Cash", "Cheque", "BACS", "Card", "PayPal", etc. |
| `cheque` | string | yes | Cheque number / payment reference |
| `notes` | string | yes | Free-text notes |
| `cleared` | date | yes | Date the transaction cleared the bank (null = uncleared) |
| `gift_aid` | string | yes | Gift Aid status flag (varies — typically empty or `'1'`) |
| `claimed` | string | yes | Gift Aid claim batch reference |
| `member_1` | integer | yes | FK to `Members.mem_no` — primary member if this is a member-related payment |
| `member_2` | integer | yes | FK to `Members.mem_no` — second member for joint memberships |
| `group` | string | yes | FK to `Groups.group_name` (by name, case-insensitive) — set if linked to a group |
| `c_name` | string | yes | Cardholder / payer name when different from member name |

**Joint memberships:** When a renewal is for a joint membership, both
`member_1` and `member_2` are populated. A transaction with only `member_1`
set is a single membership.

**Identifying renewal-payment transactions:**

```ts
// Pseudocode
const renewalCatKeys = financeCategories
  .filter(c => /subscr|renew|member.*fee/i.test(c.name))
  .map(c => c.catkey);

const renewalTxnIds = detailRows
  .filter(d => renewalCatKeys.includes(catkeyByName[d.category.toLowerCase()]))
  .map(d => d.tkey);

const renewalLedger = ledger.filter(t => renewalTxnIds.includes(t.tkey));
```

In practice, surface the category list to the user and let them pick which
ones count as "renewal income" — different u3as use different category names.

---

## `Detail`

Transaction line items — splits a `Ledger` row across one or more categories.
A transaction `Ledger.amount = -120.00` (an expense) might split as:
`-100.00` to "Hall Hire" and `-20.00` to "Refreshments." For renewal income,
a single payment of `+45.00` might be `+30.00` "Subscriptions" + `+15.00`
"Donations" if the member rounded up.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `tkey` | string | no | FK to `Ledger.tkey` |
| `category` | string | no | FK to `Finance Categories.name` (by name, case-insensitive) |
| `amount` | decimal | no | Portion of the parent transaction allocated to this category. **Sign convention is preserved** from the parent — but Beacon2's importer stores `Math.abs(amount)` in its destination DB. For analysis, prefer the absolute value plus the parent transaction's `type` (`in`/`out`). |

**Composite uniqueness:** `(tkey, category)`.

**Sum invariant:** `SUM(Detail.amount WHERE tkey = T) === Ledger.amount WHERE tkey = T`
(modulo sign — they should agree). If they don't, flag for review.

---

## Renewal-payment analysis recipe

1. Build `categoryByName: Map<string, FinanceCategoryRow>`
   (key = lowercased `name`).
2. Ask the user to select one or more category names that represent
   **renewal income** (default heuristic: any category whose `name` matches
   `/subscr|renew|member.*fee/i`).
3. Filter `Detail` rows whose `category` (lowercased) maps to one of the
   selected categories. These are renewal lines.
4. For each renewal `Detail` row, look up the parent `Ledger` row by `tkey`
   to get `date`, `member_1`, `member_2`, `payment_method`.
5. For analytics:
   - **Annual income**: group by `YEAR(Ledger.date)`, sum `Detail.amount`.
   - **Per-member**: group by `member_1`. (Joint members: also count `member_2`
     but split the amount, or attribute to `member_1` only — let user pick.)
   - **Renewal rate**: count distinct `member_1` per year ÷ count of `Members`
     active at start of year.
   - **Lapsed members**: members with no renewal `Detail` in year N but who
     had one in year N-1.

---

## Notes for analysis

- **Reconciliation:** `Ledger.cleared` being null doesn't invalidate the
  transaction — it just means the bank reconciliation hadn't picked it up at
  export time. For income analysis, use `Ledger.date`.
- **Transfers:** Money moved between two `Finance Accounts` may appear as two
  transactions (one negative, one positive). There's no transfer link in
  legacy Beacon — sniff by matching same date, opposite amounts, both with
  `payee` referring to the other account. Beacon2 introduces a `transfer_id`
  but legacy backups don't have it.
- **Gift Aid:** The `gift_aid` and `claimed` columns are sparsely populated.
  If gift-aid analysis is needed, cross-reference with `Members.gift_aid`
  (the date the declaration was signed).
