# 27. Transfer Money

The **Transfer Money** screen lets you move money between your u3a's finance
accounts — for example, transferring funds from your current account to a
savings account, or from a petty cash float back to the main account.

To open it, click **Transfer money** on the **Home** page.

![Transfer Money screen](images/27-transfer-money.png)

---

## How transfers work

A transfer creates **two linked transactions** — one taking money out of the
source account and one putting money into the destination account. Both
transactions share a **transfer ID** so Beacon2 knows they belong together.

Because transfers are paired, you should never need to manually create separate
"payment" and "receipt" transactions to move money between accounts.

---

## Transfer form

Fill in the following fields to create a transfer:

| Field | Required? | Description |
|-------|-----------|-------------|
| **Date** [A] | Yes | The date of the transfer |
| **Amount** [B] | Yes | The amount to transfer |
| **From account** [C] | Yes | The account the money is coming out of |
| **To account** [D] | Yes | The account the money is going into |
| **Payment reference** [E] | No | A reference for the transfer (e.g. bank transfer reference) |
| **Detail** [F] | No | A short description of why the transfer is being made |
| **Notes** [G] | No | Any additional notes for internal use |

> **Note:** The **From account** and **To account** must be different — you
> cannot transfer money to the same account.

Click **Save** to create the transfer. Beacon2 will create both linked
transactions automatically.

---

## Transfer history [H]

Below the transfer form, the **Transfer history** table shows all previous
transfers. Each row displays:

| Column | Description |
|--------|-------------|
| **Date** | When the transfer was made |
| **Detail** | The description entered for the transfer |
| **From** | The source account |
| **To** | The destination account |
| **Amount** | The amount transferred |
| **Cleared** | Whether both sides of the transfer have been reconciled |

---

## Editing and deleting transfers

- Click a transfer in the history table to open it for editing.
- You can **edit** or **delete** a transfer only if neither side has been
  **cleared** (reconciled). Once a transfer has been reconciled in either
  account, it is locked.
- Deleting a transfer removes both the outgoing and incoming transactions
  together.

---

[← 26. The Transaction Record](26-transaction-record.md) | [Contents](index.md) | [28. Credit Batches →](28-credit-batches.md)
