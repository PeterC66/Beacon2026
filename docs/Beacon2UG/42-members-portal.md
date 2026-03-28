# 42. The Members Portal

The Members Portal is a separate area of Beacon2 designed for your u3a's members
— not the system users who administer the u3a. It gives members online access to
view groups, the calendar, their personal details, and other features, all through
a simple, friendly interface.

> **Note:** The features available in the portal are controlled by your Site
> Administrator through the [Public Links](58-public-links.md) settings. Each
> feature can be independently enabled or disabled.

![The Members Portal home page](images/members-portal.png)

---

## Logging in to the portal

The portal has its own login page, separate from the main Beacon2 login used by
system users.

To log in, the member enters their **Email** and **Password** [A], then clicks
**Login**.

If a member has forgotten their password, they can click the **Forgot Password**
link to start the password recovery process (see below).

---

## Registering for the portal

Before a member can log in, they need to register. This is a one-time process
that verifies their identity and sets up their portal credentials.

### Step 1 — Verify your identity [B]

The member is asked to provide four pieces of information that must match their
existing membership record:

| Field | Notes |
|-------|-------|
| **Membership number** | The number shown on their membership card or joining confirmation. |
| **Forename** | Must match the forenames on their member record. |
| **Surname** | Must match the surname on their member record. |
| **Postcode** | Must match the postcode on their member record. |

If any of these do not match, Beacon2 will not allow registration to proceed.
This prevents someone from registering against another person's membership.

### Step 2 — Set your credentials [C]

Once identity is verified, the member sets their portal login details:

| Field | Notes |
|-------|-------|
| **Email** | This becomes their portal login email. |
| **Password** | Must meet the same rules as system passwords (minimum 10 characters, mix of upper and lower case, at least one number, no spaces). |
| **Confirm password** | Must match the password above. |

### Step 3 — Email verification

After registering, the member receives a **verification email** at the address
they provided. They must click the link in the email to confirm their address
before they can log in. This ensures that the email belongs to the person
registering.

---

## Forgot Password

If a member forgets their portal password, they can use the **Forgot Password**
link on the login page. Beacon2 will send a password reset email to the address
associated with their portal account, allowing them to set a new password.

---

## The portal home page

Once logged in, the member sees the portal home page [D], which includes:

- A **time-based greeting** (e.g. "Good morning, Jane") with the member's name.
- Their **renewal date** — when their membership is next due for renewal.
- A list of **portal features** that have been enabled for your u3a.

### Available features

The home page shows buttons or links for each enabled feature:

| Feature | Description |
|---------|-------------|
| **Groups** | Browse and join interest groups. See [Section 43](43-portal-groups.md). |
| **Calendar** | View upcoming meetings and events. See [Section 44](44-portal-calendar.md). |
| **Personal Details** | View and edit contact information. See [Section 45](45-portal-personal-details.md). |
| **Replacement Card** | Request a replacement membership card. See [Section 46](46-portal-replacement-card.md). |

Only features that your Site Administrator has enabled in [Public Links](58-public-links.md)
will appear. If a feature is not shown, it has been turned off for your u3a.

---

## Logging out

Click **Logout** to end the portal session. This clears the session completely —
the member will need to log in again next time they visit.

---

## Tips for administrators

- Enable or disable individual portal features in [Public Links](58-public-links.md)
  to control what your members can see and do.
- Encourage new members to register for the portal after joining — they are
  prompted to do so after [Online Joining](41-online-joining.md), but existing
  members may need a reminder.
- If a member has trouble registering, check that their forenames, surname, and
  postcode in Beacon2 match what they are entering. Common issues include extra
  spaces, abbreviations, or an outdated postcode.

---

[← 41. Online Joining](41-online-joining.md) | [Contents](index.md) | [43. Portal — Groups →](43-portal-groups.md)
