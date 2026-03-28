# 8. Adding a New Member

When someone joins your u3a, this is where you create their membership record
and log their first payment. Beacon2 guides you through a simple form that
collects the new member's details, address, and payment information in one go.

![The Add New Member page](images/add-new-member.png)

---

## Getting started

Click **Add new member** from the **Home** page, or from the navigation bar at
the top of the [Members List](6-members-list.md).

> **Tip:** Before adding a new member, it is worth checking whether they already
> exist in the system. Go to the Members List, tick all the **Status** boxes, and
> search for their name. This avoids creating duplicate records.

---

## The new member form

The form is divided into several sections. Fields with labels in **bold** are
mandatory -- Beacon2 will prompt you if any are missing when you try to save.

The new member's status is automatically set to **Current**.

### 1. Personal details [A]

| Field | Notes |
|-------|-------|
| **Title** | Mr, Mrs, Ms, Dr, etc. Required if the member will be registered for Gift Aid. |
| **Forenames** | First name(s). |
| **Surname** | Family name. |
| **Known as** | Optional -- an informal name the member prefers. |
| **Email** | Email addresses are automatically converted to lowercase. |
| **Mobile** | Mobile phone number. |

> **Note:** The **Initials** field is not shown on this form. Beacon2 generates
> initials automatically from the forenames. You can edit them later on the
> [Member Record](7-member-record.md) if needed.

### 2. Contact details [B]

Enter the member's email address, mobile number, and any other contact details.
An **Emergency contact** field is available for a name and phone number.

### 3. Address [C]

| Field | Notes |
|-------|-------|
| **House no / name** | House number or name. |
| **Street** | Street name. |
| **Town** | Pre-filled from your u3a's system settings -- edit if different. |
| **County** | Pre-filled from system settings. |
| **Postcode** | **Required.** Automatically converted to uppercase. Validated on save. |

The **Town**, **County**, and **STD code** fields are pre-filled with the defaults
from your [System Settings](48-system-settings.md), since most of your members
will live in the same area. Simply overtype them if the new member lives elsewhere.

### 4. Gift Aid [D]

Tick the **Gift Aid** checkbox if the member has signed a Gift Aid declaration.
The consent date is set to today's date automatically.

> **Remember:** Gift Aid requires a **Title** (Mr, Mrs, etc.) on the member
> record. Beacon2 will remind you if the title is missing.

### 5. Membership class [E]

Select the appropriate **Class** from the dropdown (e.g. Individual, Joint,
Associate). The fee shown updates automatically based on the class selected.

---

## Partner linking [F]

If the new member shares an address with someone who is already a member (or with
another new member joining at the same time), you can link them as partners.

### Linking to an existing member

Select the existing member's name from the **Partner** dropdown. Their address
details will be filled in automatically. If the partner's renewal is due, you may
be offered the option to renew them at the same time.

### Adding a new partner at the same time

Choose **Share address with new partner** to open an additional section for the
partner's personal details. Both members will be created together and will share
a single address record.

> **Note:** If a new member is joining as a Joint member with an existing Individual
> member, update the existing member's class first -- this ensures the correct fee
> is applied.

---

## Payment [G]

Every new member needs a payment record. Fill in the following:

| Field | Notes |
|-------|-------|
| **Amount received** | The amount the member has paid. If this exceeds the fee, the extra is recorded as a donation. |
| **Payment method** | Cash, cheque, BACS, etc. |
| **Account** | The finance account to credit (e.g. Current account, Membership account). |
| **Payment reference** | Optional -- e.g. cheque number or bank reference. |

---

## Saving the new member

When you have filled in all the required fields, click **Save** (or **Add Member**).
Beacon2 will:

1. Create the new member record with a status of **Current**.
2. Create a membership payment transaction in the financial ledger.
3. Return you to the Members List, where the new member will now appear.

If any mandatory fields are missing or a value is in the wrong format (e.g. an
invalid postcode), Beacon2 will highlight the problem and ask you to correct it
before saving.

---

[← 7. The Member Record](7-member-record.md) | [Contents](index.md) | [9. Recent Members →](9-recent-members.md)
