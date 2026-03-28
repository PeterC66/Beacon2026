# 34. Pending Transactions

Pending transactions let you record money that you know about but has not yet
arrived or been confirmed — for example, cheques that have been received but
not yet banked, or subscription payments that are expected but not yet cleared.

This feature is **configured per account** and is entirely optional. If your
u3a does not need it, you can leave it switched off.

![Pending transactions in the ledger](images/34-pending-transactions.png)

---

## Enabling pending transactions [A]

Pending transactions are configured in **Configure Account** (the account
settings screen). For each finance account, you can set the pending mode to
one of the following:

| Mode | Behaviour |
|------|-----------|
| **Disabled** | Pending transactions are not available for this account. No pending checkbox appears on the transaction form. |
| **Optional** | A **Pending** checkbox appears on the transaction form. You can choose whether to mark each transaction as pending or not. |
| **By type** | Pending status is automatically applied based on the transaction type (e.g. all incoming payments start as pending). You can still override it manually. |

---

## Marking a transaction as pending [B]

When pending transactions are enabled for an account, the Transaction Record
(see [Section 26](26-transaction-record.md)) shows a **Pending** checkbox.

- **Tick** the checkbox to mark the transaction as pending.
- **Untick** it (or use the bulk confirm action in the ledger) to confirm the
  transaction.

---

## How pending transactions behave

Pending transactions are treated differently from confirmed transactions in
several important ways:

### Excluded from the running balance

In the **Ledger (by account)** view, pending transactions are shown but are
**not included** in the running balance column. This means the balance reflects
only money that has actually been confirmed.

### Excluded from the financial statement

The **Financial Statement** (see [Section 30](30-financial-statement.md)) only
includes confirmed transactions. Pending transactions are left out so that your
formal reports reflect actual finances.

When pending transactions exist for the selected accounts and year, Beacon2
displays a **warning banner** at the top of the Financial Statement to let you
know that some transactions have been excluded.

---

## Bulk confirm or make pending from the ledger [C]

You do not have to open each transaction individually to change its pending
status. In the **Ledger (by account)** view:

1. Tick the checkboxes next to the transactions you want to change.
2. Click **Confirm** to move them from pending to confirmed.
3. Or click **Mark as Pending** to move confirmed transactions back to pending
   status.

This is much faster when you need to confirm a batch of transactions at once —
for example, after a bank deposit has cleared.

---

## Tips for using pending transactions

- **Use it for cheque-based payments.** Record the cheque when you receive it
  (as pending), then confirm it once the bank shows it as cleared.
- **Review pending transactions regularly.** Anything that stays pending for a
  long time may indicate a problem — a lost cheque, a failed payment, or a
  data entry error.
- **Check the warning banner** on the Financial Statement before presenting
  your accounts. If the banner appears, decide whether those pending items
  should be confirmed first.

---

[← 33. Refunds](33-refunds.md) | [Contents](index.md) | [35. Sending Emails →](35-sending-emails.md)
