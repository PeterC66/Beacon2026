# 32. Gift Aid Declaration

Gift Aid lets your u3a reclaim tax on eligible donations and subscription
payments. The **Gift Aid Declaration** screen brings together all the
information you need to prepare and submit your Gift Aid claim to HMRC.

To open it, click **Gift Aid declaration** on the **Home** page.

![Gift Aid Declaration screen](images/32-gift-aid-declaration.png)

---

## Selecting a financial year [A]

Use the **Financial year** dropdown to choose which year's transactions you
want to review. Only transactions within the selected year that are linked to
members with a valid Gift Aid consent date are shown.

---

## Excluding previously claimed transactions [B]

Tick the **Exclude previously claimed** checkbox to hide transactions that have
already been marked as claimed in an earlier run. This lets you focus on the
new items you still need to submit to HMRC.

---

## The transaction table [C]

The table shows one row for each eligible transaction, with the following
columns:

| Column | Description |
|--------|-------------|
| **Select** | Checkbox to include the transaction in your claim or email |
| **Member** | The member's name and membership number |
| **Date** | The date of the transaction |
| **Gift Aid amount** | The amount eligible for Gift Aid reclaim |
| **Claimed date** | The date the transaction was marked as claimed (blank if not yet claimed) |

Use the selection checkboxes to choose which transactions to include when
downloading or marking as claimed.

---

## Selection controls [D]

Quick-selection buttons let you:

- **Select all** — tick every transaction in the list.
- **Clear all** — untick every transaction.

---

## Total Gift Aid amount [E]

At the bottom of the table, Beacon2 displays the **total Gift Aid amount** for
all currently selected transactions. This gives you a quick summary of the
value of the claim you are about to make.

---

## Downloading for HMRC [F]

Click **Download as Excel** to export the selected transactions as a
spreadsheet. The exported file uses HMRC's required column format, so you can
upload it directly to the HMRC Gift Aid service (or use it as the basis for
your claim).

---

## Marking transactions as claimed [G]

Once you have submitted your claim to HMRC, click **Mark as Claimed** to
record the claim date against the selected transactions. This prevents them
from appearing in future claims (when the **Exclude previously claimed**
checkbox is ticked).

> **Tip:** Only mark transactions as claimed after you have confirmed HMRC has
> accepted the claim. If a claim is rejected, you will want those transactions
> to remain unclaimed so they appear in your next attempt.

---

## Sending Gift Aid emails [H]

You can email selected members to let them know their donations have been
claimed under Gift Aid. Select the transactions you want to include, then click
the email button.

The email template supports two special merge tokens:

| Token | What it inserts |
|-------|-----------------|
| **#GIFTAID** | The total Gift Aid amount for that member |
| **#GIFTAIDLIST** | A detailed list of the member's Gift Aid transactions |

Set up your Gift Aid email template in Standard Email Messages
(see [Section 36](36-standard-email-messages.md)) using these tokens.

---

[← 31. Groups Statement](31-groups-statement.md) | [Contents](index.md) | [33. Refunds →](33-refunds.md)
