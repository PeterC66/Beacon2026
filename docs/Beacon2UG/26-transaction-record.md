# 26. The Transaction Record

The Transaction Record is where you create or edit an individual financial
transaction — recording money received by your u3a or a payment made.

To create a new transaction, click **Add transaction** on the **Home** page.
To view or edit an existing transaction, click its **transaction number** in
the ledger (see [Section 25](25-financial-ledger.md)).

![The Transaction Record](images/26-transaction-record.png)

---

## Transaction type [A]

Choose the type of transaction:

- **Money received** — income coming in to your u3a (e.g. subscriptions,
  group fees, donations)
- **Payment** — money going out of your u3a (e.g. room hire, printing,
  equipment)

---

## Transaction fields

| Field | Required? | Description |
|-------|-----------|-------------|
| **Account** [B] | Yes | Which finance account this transaction belongs to |
| **Date** [C] | Yes | The date of the transaction |
| **From / To** [D] | No | Who the money came from (for income) or was paid to (for payments) |
| **Amount** [E] | Yes | The total amount of the transaction |
| **Payment method** [F] | No | How the money was paid (e.g. BACS, cheque, cash) |
| **Payment reference** [G] | No | A reference number for the payment (e.g. cheque number) |
| **Detail** [H] | No | A short description of what the transaction is for |
| **Remarks** [I] | No | Any additional notes — these are for internal use only |
| **Member 1** [J] | No | Link to a member record — type to search by name or membership number |
| **Member 2** [K] | No | Link to a second member record (useful for joint memberships) |
| **Group** [L] | No | Link to an interest group, if the transaction relates to one |

> **Tip:** The **Member 1** and **Member 2** fields are searchable — just start
> typing a name or membership number and Beacon2 will show matching members.

---

## Category allocation [M]

Every transaction must be allocated to one or more **categories**. The category
allocation table at the bottom of the form lets you split the transaction amount
across multiple categories.

- Select a **Category** from the dropdown in each row.
- Enter the **Amount** to allocate to that category.
- Click **Add row** to add another category line if you need to split the
  transaction.
- The **total of all category amounts must equal the transaction amount**. If
  they do not match, Beacon2 will show a warning and prevent you from saving.

For example, if a member pays £25 in total — £20 for their subscription and £5
as a donation — you would create two category lines: one for "Subscriptions"
(£20) and one for "Donations" (£5).

---

## Pending checkbox [N]

If the account has pending transactions enabled (see [Section 34](34-pending-transactions.md)),
you will see a **Pending** checkbox. Tick this to mark the transaction as pending —
it will be excluded from the running balance and the financial statement until it
is confirmed.

---

## Saving and other actions

| Button | What it does |
|--------|--------------|
| **Save** | Saves the transaction and returns to the ledger |
| **Save & Add Another** | Saves the transaction and opens a blank form so you can quickly add the next one |
| **Delete** | Permanently deletes the transaction (only available for uncleared transactions) |

> **Warning:** You cannot delete a transaction that has been cleared (reconciled),
> transferred, or linked to a Gift Aid claim. If you need to reverse such a
> transaction, use the refund feature instead (see [Section 33](33-refunds.md)).

---

[← 25. The Financial Ledger](25-financial-ledger.md) | [Contents](index.md) | [27. Transfer Money →](27-transfer-money.md)
