# 65. SQL Reports

> **beacon2026 extra:** SQL Reports has no equivalent in the original Beacon.

SQL Reports is a library of saved, parameterised queries against your u3a's
own data, plus (for site administrators) an ad-hoc SQL editor for one-off
questions the built-in screens don't answer. Results can be viewed on screen
or downloaded as an Excel file.

To open it, click **SQL reports** in the **Misc** section of the Home page.

## Who can do what

Access is split between two levels:

- **Viewing the list and running a saved report** requires the **Reports —
  View** and **Reports — Run** privileges, which can be granted to any role
  like any other privilege (see [Section 50](50-roles-privileges.md)). A
  committee member could, for example, be given a curated set of reports to
  run without being able to see or change the SQL behind them.
- **Creating, editing or deleting a saved report, and using the ad-hoc SQL
  editor,** is restricted to **Site Administrators** and cannot be delegated
  by privilege. This is deliberate: whoever writes the SQL can, in principle,
  query anything in your u3a's data, so this level is kept to the same people
  who already hold full administrative control of the system.

If you only have the Run privilege, the **New report**, **Edit**, **Delete**
and **Ad-hoc SQL** options simply do not appear.

## Running a saved report

1. Open **SQL reports** from the Home page. You'll see a list of saved
   reports with their name and description.
2. Click a report's name to open it.
3. If the report defines parameters (for example, a date range or a
   membership status), fill them in — each is shown with the plain-language
   label the report's author gave it, not the underlying SQL parameter name.
4. Click **Run** to see the results as a table, or **Download** to get them
   as an Excel (.xlsx) file.

Every run and download is recorded in the [Audit Log](61-audit-log.md).

## Creating and editing saved reports (Site Administrators)

From the SQL reports list, a Site Administrator sees two extra links:
**New report** and **Ad-hoc SQL**, plus **Edit** / **Delete** on each existing
report.

A saved report has:

- **Name** and **Description** — shown to everyone who can view the list.
- **SQL** — a single `SELECT` or `WITH` query. Only read-only queries are
  accepted; anything else (`INSERT`, `UPDATE`, `DELETE`, multiple statements
  separated by `;`, and so on) is rejected when you try to save it.
- **Parameters** — optional named placeholders. Write `:paramName` in the SQL
  wherever a value should be substituted, then declare a matching parameter
  below with a user-facing **label**, a **type** (text, number, date or
  boolean), and whether it's **required**. When someone runs the report, they
  fill in a form built from these labels — they never see or edit the raw SQL.

## The ad-hoc SQL editor (Site Administrators)

For a one-off question that doesn't justify a saved report, **Ad-hoc SQL**
lets a Site Administrator type any `SELECT` or `WITH` query directly and run
it or download the result, without saving it anywhere.

## Safety limits that apply to every query

Whether it's a saved report or ad-hoc SQL, every query runs under the same
guardrails:

- Only a single `SELECT` or `WITH` statement is accepted — no writes, and no
  chaining multiple statements together.
- The query executes in a genuinely **read-only** database transaction, so
  even a query that somehow slipped past validation cannot change any data.
- A **15-second** time limit applies; a query that runs longer is stopped.
- Results are capped at **5,000 rows** — if a query would return more, the
  result is truncated and marked as such.
- Every query only ever sees your own u3a's data — there is no way, from
  this tool, to reach another u3a's tenant.

## Not yet documented elsewhere

This feature is new enough that it isn't covered in the wider architecture
notes beyond `docs/data-model.md`'s schema entry for `saved_reports` — this
chapter is the first end-user documentation for it.

---

[← 64. Utilities](64-utilities.md) | [Contents](index.md)
