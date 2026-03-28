# 46. Portal — Replacement Card

The Replacement Card page in the Members Portal lets members request a new
membership card by email — useful if their original card has been lost or
damaged. It is a simple, one-click process.

> **Note:** This feature is only available if **Replacement Card** has been
> enabled in your [Public Links](58-public-links.md) configuration.

![The portal Replacement Card page](images/portal-replacement-card.png)

---

## How it works

### Step 1 — Request the card [A]

When a member visits the Replacement Card page, they see a brief explanation and
a **Request Replacement Card** button. Clicking the button opens a confirmation
dialog asking them to confirm that they would like a replacement card sent to
their email address.

### Step 2 — Validation

Before processing the request, Beacon2 checks that:

- The member's status is **Current** — only current members can request a
  replacement card.
- The membership is within the **renewal period** — if the membership has
  expired, the request will not be processed.

If either check fails, the member will see a message explaining why the request
cannot be completed.

### Step 3 — Confirmation [B]

Once confirmed, Beacon2:

1. **Sends a replacement card email** to the member using the
   **card_replacement_confirm** system message template (see
   [System Messages](57-system-messages.md)). This email typically includes the
   member's name, membership number, and card details.
2. **Marks the card as not printed** on the member's record, so it will appear
   in the [Outstanding Cards](12-membership-cards.md) list for your card
   coordinator to action.

The member sees a success message confirming that the replacement card request
has been submitted.

---

## Tips for administrators

- Make sure the **card_replacement_confirm** system message template is set up
  with appropriate wording before enabling this feature. You can customise the
  template in [System Messages](57-system-messages.md).
- After a member requests a replacement, the card will appear in your
  [Membership Cards](12-membership-cards.md) outstanding list — check this
  regularly so replacements are printed promptly.
- If you do not want members to request their own replacements (for example,
  if your u3a hand-delivers cards), you can disable the feature in
  [Public Links](58-public-links.md).

---

[← 45. Portal — Personal Details](45-portal-personal-details.md) | [Contents](index.md) | [47. Online Renewals →](47-online-renewals.md)
