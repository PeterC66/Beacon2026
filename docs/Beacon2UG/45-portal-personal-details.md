# 45. Portal — Personal Details

The Personal Details page in the Members Portal lets members view and update
their own contact information, address, photo, and password — without needing to
ask an administrator to make changes on their behalf.

> **Note:** This feature is only available if **Personal Details** has been
> enabled in your [Public Links](58-public-links.md) configuration.

![The portal Personal Details page](images/portal-personal-details.png)

---

## Personal information [A]

The top section shows the member's personal details. The following fields can be
edited:

| Field | Notes |
|-------|-------|
| **Title** | Mr, Mrs, Ms, Dr, etc. |
| **Forenames** | First name(s). |
| **Surname** | Family name. |
| **Known as** | Optional informal name. |
| **Suffix** | Optional suffix (e.g. OBE, JP). |
| **Initials** | Initials derived from forenames. |
| **Mobile** | Mobile phone number. |
| **Email** | Email address (see important note below about changing email). |
| **Emergency contact** | Name and phone number for emergencies. |

### Hide contact details from group leaders

A checkbox labelled **Hide contact details from group leaders** is available [B].
If ticked, the member's email and phone number will not be visible to group
leaders in group membership lists. This is useful for members who prefer not to
be contacted directly by group leaders.

---

## Address [C]

The address section allows the member to update their postal address:

| Field | Notes |
|-------|-------|
| **House no / name** | House number or name. |
| **Street** | Street name. |
| **Town** | Town or city. |
| **County** | County. |
| **Postcode** | Must be a valid UK postcode. Automatically converted to uppercase. |
| **Home phone** | Home telephone number. |

---

## Photo [D]

Members can upload a photo of themselves. This photo may appear on their
membership card and in group PDFs (depending on your u3a's configuration).

- Accepted formats: **JPG**, **PNG**, or **GIF**.
- Maximum file size: **2 MB**.

To upload a photo, click the upload area and select an image file from your
device. The photo is saved immediately.

---

## Changing your password [E]

At the bottom of the page, a **Change Password** section allows the member to
update their portal password.

| Field | Notes |
|-------|-------|
| **Current password** | Your existing portal password. |
| **New password** | Must be at least 10 characters, contain upper and lower case letters, at least one number, and no spaces. |
| **Confirm new password** | Must match the new password exactly. |

Click **Change Password** to save the new password. The member remains logged in
after the change.

---

## Changing your email address

If a member changes their **Email** field and saves, Beacon2 treats this as a
significant change because the email address is used for portal login.

When the email is changed:

1. A **verification email** is sent to the new address.
2. The member is **logged out** of the portal immediately.
3. They must click the verification link in the email before they can log in
   again with the new address.

A confirmation email is sent using your u3a's system message template (see
[System Messages](57-system-messages.md)).

> **Tip:** If a member changes their email by mistake and gets locked out,
> an administrator can update their email address directly in the
> [Member Record](7-member-record.md).

---

## Tips for administrators

- Encourage members to keep their details up to date through the portal — it
  reduces the administrative burden on your volunteers.
- If a member reports problems changing their email, check that the verification
  email is not being caught by spam filters.
- The **Hide contact details** option is a privacy feature — respect members'
  wishes if they choose to use it.

---

[← 44. Portal — Calendar](44-portal-calendar.md) | [Contents](index.md) | [46. Portal — Replacement Card →](46-portal-replacement-card.md)
