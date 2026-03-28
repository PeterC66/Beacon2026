# 63. Data Export and Backup

The **Data Export and Backup** page lets you download your Beacon2 data as
Excel spreadsheets and restore data from backup files. This is useful for
keeping offline copies, performing analysis in a spreadsheet application, or
migrating between systems.

To open it, click **Data export & backup** in the **Misc** section of the
Home page.

![The Data Export and Backup page](images/data-export-backup.png)

---

## Export types

Eight export options are available [A]. Each one downloads an Excel
spreadsheet (`.xlsx` file) containing one or more sheets:

| # | Export | What it includes |
|---|--------|------------------|
| 1 | **Members and addresses** [B] | All member records with postal and email addresses, phone numbers, statuses, and membership details. |
| 2 | **Finance ledger with detail** [C] | All financial transactions with full line-item detail, accounts, and categories. |
| 3 | **Groups with members/venues/faculties** [D] | All groups together with their member lists, assigned venues, and faculty (subject) categories. |
| 4 | **Calendar** [E] | All scheduled meetings and events from the calendar. |
| 5 | **System users/roles/privileges** [F] | All system user accounts, the roles defined in your system, and the privileges assigned to each role. |
| 6 | **u3a Officers** [G] | The list of offices and their current post holders (as shown on the u3a Officers page). |
| 7 | **Site settings and set up** [H] | Your system settings, finance accounts, finance categories, membership classes, member statuses, and other configuration data. |
| 8 | **Backup all data** [I] | A comprehensive download combining all of the above into a single file with multiple sheets. |

To download an export, click the corresponding **Download** button. The file
will be generated and saved to your computer's downloads folder.

> **Warning:** These files may contain **personal information** (names,
> addresses, email addresses, phone numbers). If you store them outside
> Beacon2 -- for example on a USB drive or in cloud storage -- you should
> **encrypt** the file to comply with data protection requirements.

---

## Restoring from backup

The page also provides a **Restore** section [J] that lets you upload a
previously downloaded backup file to restore your data. Beacon2 supports two
backup formats:

- **Beacon2 backup** -- a file previously downloaded from the **Backup all
  data** option above.
- **Original Beacon backup** -- a backup file exported from the legacy Beacon
  system. Use this when migrating from the original Beacon to Beacon2.

To restore, click **Choose file**, select your backup file, and follow the
on-screen instructions. A confirmation dialog will appear before any data is
overwritten.

> **Warning:** Restoring from a backup will replace your current data with the
> data in the backup file. Make sure you have a current backup before
> proceeding.

---

[← Previous: u3a Officers](62-officers.md) | [Contents](index.md) | [Next: Utilities →](64-utilities.md)
