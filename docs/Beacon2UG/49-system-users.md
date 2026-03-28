# 49. System Users

The System Users page lets you manage who can log into Beacon2 and what they
are allowed to do. Every person who needs to access the administration system
must have a user account set up here.

To open this page, click **System users** in the **Set Up** section of the
Home page.

![The System Users page](images/49-system-users.png)

---

## The user list [A]

The main table shows all system users with the following columns:

| Column | What it shows |
|--------|---------------|
| **Full name** | The user's name (taken from their linked member record) |
| **Username** | The login name, shown in `monospace` text |
| **Linked member** | Which member record this user is connected to |
| **Site admin** | Whether the user is a Site Administrator |
| **Date created** | When the account was first set up |
| **Last accessed** | When the user last logged in |
| **Roles** | The roles assigned to this user |

All columns are sortable — click a column header to sort by that column.

---

## Selecting users [B]

Each row has a **checkbox** on the left. Tick one or more users and click
**Send email** to send an email to the selected users (this only works if the
user is linked to a member who has an email address).

---

## Creating a new user [C]

1. Click **Create new user**.
2. **Select a member** from the dropdown — this links the user account to an
   existing member record.
3. Enter a **username**. Usernames must contain only lowercase letters and
   numbers (no spaces or special characters).
4. Optionally enter an **email address** (if different from the member's email).
5. Click **Save**.

Beacon2 will generate a **temporary password** and display it on screen. Make a
note of it — you will need to give it to the new user. They will be asked to
change this password the first time they log in.

> **Tip:** Write down the temporary password carefully before closing the
> dialog. Once you navigate away, you cannot retrieve it — you would need to
> set a new temporary password.

---

## Editing a user [D]

Click a user's name to open their details. From here you can:

- **Change the username** (same lowercase letters and numbers rule applies)
- **Change the email address**
- **Set active or inactive** — deactivating a user prevents them from logging
  in without deleting the account
- **Assign roles** — a table of checkboxes lists all available roles; tick the
  ones this user should have

### Set Temporary Password

Click **Set Temporary Password** to generate a new temporary password for the
user. This is useful if someone has forgotten their password. The new temporary
password is displayed on screen and the user will be prompted to change it at
their next login.

---

## Site Administrator [E]

The **Site Administrator** is a special user who has all privileges in Beacon2,
regardless of which roles are assigned. The Site Administrator account:

- Is shown prominently in the user list
- Cannot be deleted
- Always has full access to every page and function

Every u3a must have at least one Site Administrator. If you need to transfer
Site Administrator status to a different person, contact the Beacon support team.

---

[← 48. System Settings](48-system-settings.md) | [Contents](index.md) | [50. Roles and Privileges →](50-roles-privileges.md)
