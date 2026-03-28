# 10. Membership Renewals

The **Membership Renewals** screen is where you record that members have renewed
their subscriptions and paid their fees. It walks you through selecting the
members who are due for renewal, confirming payment details, and processing
everything in one batch.

![The Membership Renewals page](images/membership-renewals.png)

---

## Opening the Membership Renewals screen

From the **Home** page, click **Membership renewals**. The screen loads showing
the members whose subscriptions are due.

---

## Period tabs [A]

At the top of the screen, three tabs let you choose which renewal period you are
working with:

| Tab | What it shows |
|-----|---------------|
| **Current year** | Members whose renewal falls due in the current membership year. This is the tab you will use most often. |
| **Previous years** | Members who were due to renew in earlier years but have not yet been processed. Useful for catching up on any missed renewals. |
| **Next year** | Members whose renewal falls in the next membership year. This tab only appears if **advance renewals** are enabled in your [System Settings](48-system-settings.md). |

---

## Selecting the finance account and payment method [B]

Before processing renewals, choose:

- **Account** — the finance account to credit (e.g. Current account). The
  default is taken from your [System Settings](48-system-settings.md).
- **Payment method** — the method the members used to pay (e.g. BACS, cheque,
  cash). The default is also taken from System Settings.

You can change these for each batch if needed — for example, you might process
all cheque payments in one batch and all BACS payments in another.

---

## The renewals table [C]

The table shows one row per member who is due for renewal. Columns include:

| Column | Description |
|--------|-------------|
| **Select** | Checkbox for selecting members to renew |
| **Membership No** | The member's membership number (click to open their record) |
| **Name** | Full name of the member |
| **Class** | Membership class (e.g. Individual, Joint) |
| **Partner** | The name of the member's linked partner, if any |
| **Next renewal** | The date the member's subscription is next due |
| **Fee due** | The renewal fee based on the member's class |
| **Gift Aid** | Checkbox indicating whether the member has a current Gift Aid declaration |
| **Amount received** | The amount the member has actually paid — editable, so you can adjust it if the amount differs from the standard fee |

You can sort the table by clicking any **column header**.

---

## Selecting members to renew [D]

- **Individual selection** — tick the checkbox next to each member you want to
  renew.
- **Select all** — tick the checkbox at the top of the selection column to
  select every member in the list.

> **Tip:** It is common to process renewals in batches by payment method.
> For example, process all BACS payments first (since you can verify them
> against your bank statement), then switch to cheques, then cash.

---

## Processing renewals [E]

Once you have selected the members and confirmed the amounts, click
**Renew selected**. Beacon2 will show a **confirmation dialog** summarising:

- The number of members being renewed
- The total amount being recorded
- The finance account and payment method

Click **Confirm** to proceed, or **Cancel** to go back and make changes.

When you confirm, Beacon2 will:

1. Record a membership payment transaction in the financial ledger for each
   selected member.
2. Update each member's **Next renewal** date to the next anniversary.
3. Refresh the table so the renewed members no longer appear.

---

## Adding members to a poll [F]

Instead of renewing, you can select members and click **Add to poll** to add
them to a poll. This is useful if you want to track who has been contacted about
renewal but has not yet paid — for example, a "Renewal reminder sent" poll.

---

## Gift Aid [G]

The **Gift Aid** column shows whether each member has an active Gift Aid
declaration. When you renew a member who has Gift Aid enabled, Beacon2
automatically flags their payment as eligible for a Gift Aid claim. You do not
need to do anything extra — just make sure the member's Gift Aid status is
correct on their [Member Record](7-member-record.md) before processing.

---

## Typical workflow

1. At the start of each month (or whenever payments arrive), open **Membership
   renewals**.
2. Select the **Current year** tab.
3. Set the **Payment method** to BACS and process the batch of members who have
   paid by bank transfer.
4. Change the **Payment method** to cheque and process the cheque payments.
5. Repeat for any other payment methods (cash, card, etc.).
6. If any members have overpaid, adjust the **Amount received** column before
   processing — the excess will be recorded as a donation.
7. Periodically check the **Previous years** tab to ensure no overdue renewals
   have been missed.

---

[← 9. Recent Members](9-recent-members.md) | [Contents](index.md) | [11. Non-Renewals →](11-non-renewals.md)
