# 59. Payment Method Defaults

Payment Method Defaults let you map each payment method to a default finance
account. This saves time when adding members and processing renewals, because
Beacon2 automatically selects the right account based on how the member is
paying.

This page is accessed from the **Finance Accounts** page — click the
**Payment Method Defaults** link at the bottom of the
[Configure Account](51-finance-accounts.md) page.

![The Payment Method Defaults page](images/59-payment-method-defaults.png)

---

## How it works [A]

The page shows a table listing every payment method, with a dropdown next to
each one where you select the default finance account:

| Payment method | Default account |
|----------------|-----------------|
| **Cash** | Select which account cash payments are recorded against |
| **Cheque** | Select which account cheque payments are recorded against |
| **Standing Order** | Select which account standing order payments are recorded against |
| **Direct Debit** | Select which account direct debit payments are recorded against |
| **Online** | Select which account online (PayPal) payments are recorded against |
| **Other** | Select which account other payment types are recorded against |

For each payment method, choose the finance account from the dropdown. For
example, you might map Cash and Cheque to your Current Account, Standing Order
and Direct Debit to your Bank Account, and Online to a separate PayPal account.

Click **Save** when you have finished.

---

## Where defaults are used [B]

Once configured, these defaults are applied automatically in several places:

- **Adding a new member** — the finance account is pre-selected based on the
  chosen payment method
- **Processing renewals** — the correct account is selected for each member's
  renewal payment
- **Credit batches** — the default account is suggested when creating batch
  entries

You can always override the default on an individual transaction if needed.

> **Tip:** Set up your payment method defaults early, ideally when you first
> configure your finance accounts. This ensures consistency from the start and
> reduces the chance of payments being recorded against the wrong account.

---

[← 58. Public Links](58-public-links.md) | [Contents](index.md) | [60. Personal Preferences →](60-personal-preferences.md)
