# 41. Online Joining

Online Joining lets prospective members join your u3a directly from your website,
without needing a login or an existing account. They fill in a simple form, pay
online via PayPal, and are automatically set up as a new member — all without
any manual data entry by your volunteers.

> **Note:** Online Joining must be enabled in your [Public Links](58-public-links.md)
> settings before the form is accessible. Your Site Administrator can turn it on
> and configure the public URL that links to the joining page.

![The Online Joining form](images/online-joining.png)

---

## How it works — overview

1. A prospective member visits the joining page (linked from your u3a website).
2. They fill in the form and click **Join**.
3. They are taken to PayPal to pay the membership fee.
4. On successful payment, Beacon2 creates their member record, sends confirmation
   emails, and shows them their new membership number.
5. They are prompted to register for the [Members Portal](42-members-portal.md).

---

## The joining form

### 1. Membership class [A]

The first thing the applicant sees is a **Membership class** dropdown. Each class
is shown with its annual fee (e.g. "Individual — £15.00", "Joint — £25.00"). Only
classes that are configured for online joining are listed.

### 2. Personal details [B]

| Field | Required? | Notes |
|-------|-----------|-------|
| **Title** | No (but see Gift Aid below) | Mr, Mrs, Ms, Dr, etc. |
| **Forenames** | Yes | First name(s). |
| **Surname** | Yes | Family name. |
| **Email** | Yes | Used for confirmation and portal registration. |
| **Mobile** | No | Mobile phone number. |

### 3. Address [C]

| Field | Required? | Notes |
|-------|-----------|-------|
| **House no / name** | No (but see Gift Aid below) | House number or name. |
| **Street** | No | Street name. |
| **Town** | No | Town or city. |
| **County** | No | County. |
| **Postcode** | Yes | Must be a valid UK postcode format. Automatically converted to uppercase. |

### 4. Gift Aid [D]

If your u3a has Gift Aid enabled, a **Gift Aid** checkbox is shown. Ticking it
means the member consents to your u3a reclaiming tax on their subscription under
the Gift Aid scheme.

> **Important:** HMRC requires a **Title** and a **House no / name** for Gift Aid
> claims. If the applicant ticks the Gift Aid box, Beacon2 will insist that both
> fields are filled in before allowing them to continue.

### 5. Privacy policy [E]

A link to your u3a's privacy policy is shown at the bottom of the form. The
applicant must acknowledge this before submitting.

---

## Validation

Beacon2 checks the form before allowing the applicant to proceed:

- **Forenames**, **Surname**, **Email**, and **Postcode** are all required.
- **Postcode** must be in a valid UK format (e.g. AB1 2CD, A1 2BC).
- If **Gift Aid** is ticked, **Title** and **House no / name** are also required
  (this is an HMRC requirement for Gift Aid declarations).
- **Email** must be in a valid format.

If anything is missing or incorrect, Beacon2 highlights the field and displays a
helpful message explaining what needs to be corrected.

---

## Payment via PayPal

Once the form passes validation, the applicant clicks **Join** and is redirected
to PayPal to complete payment. The amount is determined by the membership class
they selected.

- The applicant can pay with a PayPal account or with a debit/credit card.
- If they cancel the payment, they are returned to the form and no record is
  created.
- If the payment succeeds, PayPal redirects them back to Beacon2 to complete the
  process.

---

## What happens after successful payment

When payment is confirmed, Beacon2 performs several actions automatically:

1. **Member record created** — a new member is created with an initial status of
   **Applicant**, then immediately promoted to **Current**.
2. **Finance transaction** — a membership payment transaction is recorded in your
   financial ledger, linked to the new member.
3. **Confirmation email** — the new member receives a confirmation email at the
   address they provided.
4. **Officer notifications** — your u3a officers (as configured in
   [u3a Officers](62-officers.md)) receive an email notifying them that a new
   member has joined online.
5. **Membership number shown** — the applicant sees a confirmation page displaying
   their new membership number [F].

---

## Registering for the Members Portal

After receiving their membership number, the new member is prompted to register
for the [Members Portal](42-members-portal.md). This gives them online access to
view groups, the calendar, and their personal details.

Registration is optional at this point — they can always register later using the
portal's registration page.

---

## Tips for administrators

- Make sure your **PayPal** integration is correctly configured in
  [System Settings](48-system-settings.md) before enabling Online Joining.
- Review your **membership classes** to ensure the correct fees are set — these
  are the amounts that will be charged.
- Check your [Public Links](58-public-links.md) settings to control which
  features are visible and to obtain the URL for your website.
- Consider testing the joining process yourself to make sure everything works
  smoothly before publicising the link.

---

[← 40. Standard Letters](40-standard-letters.md) | [Contents](index.md) | [42. The Members Portal →](42-members-portal.md)
