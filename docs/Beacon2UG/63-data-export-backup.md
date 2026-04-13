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

Seven export options are available [A], plus a full backup. Each one
downloads an Excel spreadsheet (`.xlsx` file) containing one or more sheets:

| # | Export | What it includes |
|---|--------|------------------|
| 1 | **Members and addresses** [B] | All member records with postal and email addresses, phone numbers, statuses, membership details, custom fields, and emergency contacts. |
| 2 | **Finance ledger with detail** [C] | All financial transactions (including transfer links, pending status, Gift Aid amounts, refund links), category splits, and credit batches. |
| 3 | **Groups and teams** [D] | All groups and teams with their member lists, group ledger entries, scheduled events (Group Events), assigned venues, and faculty categories. |
| 4 | **Calendar** [E] | Calendar events are included in the Groups and teams export (see above). |
| 5 | **System users/roles/privileges** [F] | All system user accounts, the roles defined in your system, and the privileges assigned to each role. |
| 6 | **u3a Officers** [G] | The list of offices and their current post holders (as shown on the u3a Officers page). |
| 7 | **Site settings and set up** [H] | Your system settings, finance accounts and categories, membership classes and fees, member statuses, polls, system messages, standard email and letter templates, and payment method defaults. |
| 8 | **Backup all data** [I] | A comprehensive download combining all of the above into a single file with multiple sheets. This is the recommended option for a full backup. |

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
