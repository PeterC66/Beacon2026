# 47. Online Renewals

Online Renewals lets existing members renew their membership and pay online
through the [Members Portal](42-members-portal.md), in much the same way that
[Online Joining](41-online-joining.md) works for new members. The member signs
in, reviews their renewal fee, optionally confirms Gift Aid, and pays via PayPal
— and their membership is updated automatically.

> **Note:** Online Renewals is only available if **Membership renewals** has been
> enabled in your [Public Links](58-public-links.md) configuration. When enabled, a
> **Renew your membership** option appears on the member's portal home page.

![The portal Online Renewals page](images/portal-renewal.png)

---

## How it works

### Step 1 — Start the renewal

The member logs in to the [Members Portal](42-members-portal.md) and clicks
**Renew your membership**. Beacon2 loads their current renewal details and shows
a renewal summary.

### Step 2 — Review the renewal summary [A]

The summary shows:

- The member's name and membership number.
- Their membership **class** and **current renewal date**.
- The **subscription** amount for the coming year.
- For a **joint membership**, the partner's details and subscription are also
  shown — joint memberships must be renewed together, and both subscriptions are
  included in the total.
- The **total to pay**.

### Step 3 — Gift Aid (if enabled) [B]

If your u3a has **Gift Aid for online renewals** enabled (see
[System Settings](48-system-settings.md)), a **Gift Aid** section is shown. The
member can confirm that Gift Aid should be claimed on their subscription (and, for
a joint membership, on the partner's subscription). Any existing Gift Aid
declaration is pre-ticked and marked *currently opted in*.

### Step 4 — Pay via PayPal

The member clicks **Make Payment** and is taken to PayPal to pay the total. They
can pay with a PayPal account or a debit/credit card.

- If they cancel, they are returned to the portal and nothing is changed.
- If the payment succeeds, PayPal redirects them back to Beacon2, which confirms
  the renewal.

### Step 5 — Confirmation [C]

On successful payment, Beacon2:

1. **Records the payment** and updates the member's **next renewal date** to the
   following membership year.
2. **Records any Gift Aid** the member confirmed.
3. **Sends a confirmation email** using the **online_renewal_confirm** system
   message template (see [System Messages](57-system-messages.md)).

The member sees a **Renewal Complete** screen showing their membership number and
the date their membership now continues until.

---

## Tips for administrators

- Enable Online Renewals by switching on **Membership renewals** in
  [Public Links](58-public-links.md).
- Set a **renewal enquiries email** in [System Settings](48-system-settings.md)
  so members have a contact for questions — it appears on the renewal page.
- If you want Gift Aid offered during online renewal, enable **Gift Aid for
  online renewals** in [System Settings](48-system-settings.md).
- Review the **online_renewal_confirm** template in
  [System Messages](57-system-messages.md) so the confirmation email reads the way
  you want before enabling the feature.

> **Note:** Online payments use PayPal. In a proof-of-concept deployment the
> PayPal integration runs in a non-production stub mode; see your administrator or
> [DEPLOYMENT.md](../../DEPLOYMENT.md) for how live payments are configured.

---

[← 46. Portal — Replacement Card](46-portal-replacement-card.md) | [Contents](index.md) | [48. System Settings →](48-system-settings.md)
