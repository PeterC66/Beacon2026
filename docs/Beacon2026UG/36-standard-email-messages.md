# 36. Standard Email Messages

Standard email messages are reusable templates that save you from typing the same
email over and over again. Any user can load a saved template; templates are shared
across all users of your u3a.

![Standard email messages on the compose page](images/36-standard-email-messages.png)

---

## Where to find them

Standard messages are managed from the **email compose page** (see
[Section 35: Sending Emails](35-sending-emails.md)). The Standard Messages bar
sits between the From/To area and the subject field.

---

## Loading a saved template

1. Click the **Load standard message** dropdown [A].
2. Choose the template you want.
3. The **Subject** and **Message body** are filled in with the saved content.

You can edit the subject and body freely after loading -- the original template is
not changed.

---

## Saving a new template

1. Compose your subject and message body as you would for a normal email.
2. Click **Save as standard message** [B]. A name field appears.
3. Type a name for the template (e.g. "Renewal reminder" or "Welcome new member").
4. Click **Save**.

The template is now available in the dropdown for all users. If you save with the
same name as an existing template, the old version is replaced.

---

## Deleting a template

To remove a template you no longer need:

1. Select the template from the **Load standard message** dropdown so you can
   confirm it is the right one.
2. The delete option is available from the standard messages management area.
3. Confirm the deletion when prompted.

> **Note:** Deleted templates cannot be recovered. If you think you might need it
> again, consider keeping it or copying the text elsewhere first.

---

## Ownership: who can add, edit or delete a template

Every template is either **unowned** or **owned by a group or team**. Ownership
only affects who can *manage* the template -- everyone who can compose an
email can still see and use every template, regardless of who owns it.

- **Unowned templates** can only be added, edited or deleted by
  **Administration**. New templates saved from the email compose page's
  **Save as standard message** button are unowned by default, and that button
  is only shown to Administration.
- **Group/team-owned templates** can also be added, edited or deleted by
  that group or team's own **leaders**, from a **Std Emails** tab on the
  group/team's own record page (alongside Details, Members and Group Cash).
  A leader only sees and manages their own group/team's templates there --
  not any other group's.
- Only **Administration** can assign a template to a group/team, or move it
  to a different one. A leader creating a new template from their group's
  Std Emails tab automatically has it owned by that group -- there is no
  group picker to choose otherwise.
- If a group or team that owns templates is deleted, its templates become
  unowned rather than being deleted -- an Administration user can then
  reassign or edit them.

---

## Default templates on a new u3a

Every new beacon2026 tenant starts with two ready-made templates, adapted from
the original Beacon User Guide: **New Member Welcome** and **Renewal
Confirmation**. Both include bracketed placeholders (e.g. "[add a link to
your u3a website]") for the handful of details that are specific to your own
u3a. Edit, rename or delete these like any other Standard Message -- they are
a starting point, not fixed content.

---

## Tips

- Templates can include **personalisation tokens** (e.g. `#FAM`, `#SURNAME`). When
  the email is sent, these tokens are replaced with each member's details -- just
  like a normal email.
- Give your templates clear, descriptive names so that other users can find and use
  them easily.
- Templates are visible to and usable by everyone at your u3a -- there are no
  private templates. Who can *edit* a given template depends on its
  ownership -- see "Ownership" above.

---

[← 35. Sending Emails](35-sending-emails.md) | [Contents](index.md) | [37. Email Delivery →](37-email-delivery.md)
