# 33. Refunds

Sometimes you need to return money that your u3a has already received — for
example, if a member overpays their subscription or a group event is cancelled.
Beacon2 handles this through **refunds**, which create a new transaction linked
back to the original.

Refunds are accessed from the ledger — there is no separate Home page link.

![Refund form](images/33-refunds.png)

---

## Enabling refunds

Before you can issue refunds, refunds must be **enabled for the account** in
Configure Account (see the account configuration settings). If refunds are not
enabled, the refund option will not appear on transactions in that account.

---

## Starting a refund [A]

1. Open the **Financial Ledger** (see [Section 25](25-financial-ledger.md)).
2. Click the **transaction number** of the transaction you want to refund to
   open the Transaction Record.
3. Click the **Refund this transaction** link.

Beacon2 opens the refund form, which shows a summary of the original
transaction at the top for reference.

---

## Which transactions can be refunded?

Not every transaction is eligible for a refund. Beacon2 **blocks refunds** on
transactions that are:

- **Cleared** (reconciled) — the transaction has already been matched to a bank
  statement.
- **Transferred** — the transaction is one side of a transfer between accounts.
- **Gift-Aid-claimed** — the transaction has been included in a Gift Aid claim
  submitted to HMRC.

If a transaction is blocked, the "Refund this transaction" link will not appear.

---

## Refund form fields [B]

| Field | Required? | Description |
|-------|-----------|-------------|
| **Refund date** | Yes | The date of the refund. Must be **after** the original transaction date and within the **same financial year**. |
| **Payment method** | No | How the refund is being paid (e.g. BACS, cheque, cash) |
| **Payment reference** | No | A reference number for the refund payment |
| **Detail** | No | A short description of why the refund is being made |
| **Remarks** | No | Any additional notes for internal use |

---

## Category-based refund amounts [C]

The refund form shows the categories from the original transaction. For each
category, you can enter the amount to refund. The rules are:

- Each category refund amount must be **less than or equal to** the original
  amount in that category.
- You do not have to refund the full amount — partial refunds are supported.
- The total refund is the sum of all category amounts.

For example, if the original transaction was £25 split as £20 Subscriptions and
£5 Donations, you could refund £20 (Subscriptions only), £5 (Donations only),
the full £25, or any amount up to the original in each category.

---

## What happens when you save [D]

When you save the refund, Beacon2 creates a **reciprocal transaction** that is
linked to the original. Both the original and the refund display references to
each other in the ledger, so you can always trace the connection.

**Refund rows appear in red** in the ledger, making them easy to spot when
reviewing your accounts.

---

## Refund links in the ledger [E]

In the ledger, refunded transactions show a link in the **Refund** column.
Click this link to jump between the original transaction and its refund.

---

[← 32. Gift Aid Declaration](32-gift-aid-declaration.md) | [Contents](index.md) | [34. Pending Transactions →](34-pending-transactions.md)
