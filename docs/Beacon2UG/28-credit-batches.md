# 28. Credit Batches

Credit batches let you **group incoming transactions together** so they can be
reconciled as a single item against your bank statement. This is especially
useful when you pay in a bundle of cheques or cash — the bank shows one deposit,
but Beacon2 has many individual transactions.

To open this screen, click **Credit batches** on the **Home** page.

![Credit Batches screen](images/28-credit-batches.png)

---

## Selecting an account and mode [A]

At the top of the screen, choose:

- **Account** — the finance account you want to work with.
- **Mode** — how to filter the transactions shown:
  - **Uncleared** — shows only transactions that have not yet been reconciled.
  - **Since date** — shows transactions from a specific date onwards, regardless
    of cleared status.

---

## The batch list [B]

The batch list shows all existing batches for the selected account. Each row
displays:

| Column | Description |
|--------|-------------|
| **Reference** | The batch reference (click to view transactions in the batch) |
| **Date** | The date the batch was created |
| **Count** | The number of transactions in the batch |
| **Total** | The total value of all transactions in the batch |
| **Status** | **Cleared**, **Part cleared**, or **Uncleared** |

Click a batch reference to see the individual transactions within that batch.

---

## Creating a new batch [C]

1. In the **unbatched transactions** list below the batch list, tick the
   checkboxes next to the transactions you want to group together.
2. Click **Create batch**.
3. Beacon2 creates a new batch containing the selected transactions and assigns
   it a reference number.

> **Tip:** Batches work best when they match real-world deposits. For example,
> if you pay in five cheques totalling £125 as a single bank deposit, create a
> batch of those five transactions. When you reconcile, you can clear the whole
> batch in one go.

---

## Adding transactions to an existing batch [D]

If you forgot to include a transaction when creating a batch, or a new
transaction arrives that belongs to the same deposit:

1. Select the transaction(s) from the unbatched list.
2. Choose the target batch from the **Add to batch** dropdown.
3. Click **Add to batch**.

You can only add transactions to an **uncleared** batch.

---

## Removing transactions from a batch [E]

1. Click the batch reference to view its transactions.
2. Tick the transactions you want to remove.
3. Click **Remove from batch**.

The removed transactions return to the unbatched list.

---

## Deleting a batch

You can delete a batch only if it is **empty** (all transactions have been
removed from it). An empty batch serves no purpose, so tidying these up keeps
your batch list clean.

---

## Using batches during reconciliation

When you reconcile an account (see [Section 29](29-reconcile-account.md)),
batched transactions can be cleared together as a single line item. This makes
reconciliation much faster when your bank statement shows lump-sum deposits.

---

[← 27. Transfer Money](27-transfer-money.md) | [Contents](index.md) | [29. Reconcile Account →](29-reconcile-account.md)
