# 61. Audit Log

The **Audit Log** provides a date-filtered view of all activity that has taken
place in your Beacon2 system. It is useful for checking who made a change, when
they made it, and what was affected.

To open it, click **Audit log** in the **Misc** section of the Home page.

![The Audit Log page](images/audit-log.png)

---

## Filtering by date

By default the audit log shows the last **three months** of activity. You can
change the date range using the **From** and **To** date fields [A] at the top
of the page, then press **Search** to refresh the list.

---

## The audit table

The table [B] displays one row per recorded action, with the following columns:

| Column | Description |
|--------|-------------|
| **When** [C] | The date and time the action occurred. Click the timestamp to see the full audit entry details (see below). |
| **By** [D] | The username of the person who performed the action. |
| **Action** [E] | A colour-coded badge showing the type of change: **Created** (green), **Updated** (blue), **Deleted** (red), or **Cleared** (amber). |
| **Target** [F] | A short description of what was affected. |
| **Key** [G] | The identifier of the affected record (e.g. a member number or group name). |
| **Record** [H] | A **view** link that navigates directly to the affected record, so you can see its current state. |
| **Entity type** [I] | The type of record that was changed (e.g. Member, Group, Transaction). |

> **Tip:** The colour-coded badges make it easy to scan down the Action column
> and spot deletions (red) or new records (green) at a glance.

---

## Viewing full details

Click the **timestamp** in the **When** column [C] to open the full audit
entry. This shows all the fields that were changed, along with their before
and after values where applicable.

Click the **view** link in the **Record** column [H] to navigate directly to
the affected record in Beacon2.

---

## Deleting old entries

If you have the required privilege, a **Delete entries before** option [J]
appears at the bottom of the page. This lets you remove audit entries older
than a given date to keep the log manageable.

> **Warning:** Deleting audit entries is permanent. A confirmation dialog will
> appear before the deletion proceeds. Make sure you no longer need the
> entries before confirming.

---

[← Previous: Personal Preferences](60-personal-preferences.md) | [Contents](index.md) | [Next: u3a Officers →](62-officers.md)
