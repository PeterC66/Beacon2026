# 50. Roles and Privileges

Roles and Privileges is where you control **who can do what** in Beacon2. You
create roles (such as "Membership Secretary" or "Treasurer"), assign privileges
to each role, and then assign roles to individual users.

To open this page, click **Roles and privileges** in the **Set Up** section of
the Home page.

![The Roles and Privileges page](images/50-roles-privileges.png)

---

## The role list [A]

The main table shows all roles with:

| Column | What it shows |
|--------|---------------|
| **Role name** | The name of the role |
| **Committee role** | Whether this role represents a committee position |
| **Users** | How many system users currently have this role |
| **Edit** | Click to edit the role's settings and privileges |
| **Delete** | Click to delete the role (only if no users are assigned) |

---

## Creating a new role [B]

1. Click **Create new role**.
2. Enter a **role name** (e.g. "Groups Coordinator").
3. Tick **Committee role** if this role represents a position on your u3a's
   committee — committee roles are shown in some reports and listings.
4. Add optional **Notes** to describe what this role is for.
5. Click **Save**.

After saving, you are taken to the edit page where you can set the role's
privileges.

---

## Editing a role [C]

Click **Edit** next to a role to open it. You can change the name, committee
role flag, and notes. More importantly, this is where you set the role's
**privilege matrix**.

---

## The privilege matrix [D]

The privilege matrix is a grid that controls exactly what users with this role
can see and do. It only appears when editing a role.

### How it works

- **Rows** represent resources — the different areas of Beacon2 (Members,
  Groups, Finance, Email, Set Up, etc.)
- **Columns** represent actions — **View**, **Create**, **Change**, **Delete**,
  and **Other**

Each cell has a **checkbox**. Tick a checkbox to grant that action on that
resource to users with this role.

### Quick-select shortcuts

- Click a **column header** (e.g. "View") to toggle all checkboxes in that
  column on or off — handy for granting or revoking an action across all
  resources at once.
- Click a **row header** (e.g. "Members") to toggle all checkboxes in that row
  on or off — handy for giving full access to one area.

### View is required

**View** permission is a prerequisite for any other action on the same resource.
If you tick Create, Change, or Delete without ticking View, Beacon2 will
automatically enable View for you. A user cannot change what they cannot see.

### Repeating headers

For ease of reading, the column headers (**View**, **Create**, **Change**,
**Delete**, **Other**) repeat every **15 rows** so you do not lose track of
which column is which as you scroll down the page.

> **Tip:** Start by thinking about what each role needs to **do**, then tick
> only the privileges they need. It is better to start with fewer privileges
> and add more later than to give everyone full access.

---

[← 49. System Users](49-system-users.md) | [Contents](index.md) | [51. Finance Accounts →](51-finance-accounts.md)
