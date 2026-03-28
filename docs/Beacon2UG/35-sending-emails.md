# 35. Sending Emails

Beacon2 lets you send personalised emails to any selection of members. You reach
the email compose page by selecting members (from the Members List, Group Members,
or other screens) and choosing **Send email** from the **Do with selected** menu.

![The email compose page](images/35-sending-emails.png)

---

## Getting to the compose page

1. Go to the **Members List** (or a Group Members screen, Membership Cards, etc.).
2. Tick the members you want to email (or use **Select > Email only** to select
   everyone who has an email address on file).
3. From the **Do with selected** dropdown, choose **Send email** and click the
   button.

The compose page opens with your selected members shown as recipients.

---

## From address [A]

Choose a **From** address from the dropdown. This list is populated from the email
addresses held on your member record.

> **Tip:** Beacon2 remembers your last-used From address in your browser, so you
> won't need to re-select it every time (provided you have accepted optional
> cookies).

---

## Recipients [B]

The **To** field shows the first five recipients by name and email, plus a count of
how many more are included. Members without an email address are noted as
"(no email)" -- they will be skipped when the email is sent.

---

## Copy to self

Tick the **Send a copy to myself** checkbox if you would like a copy of the email
delivered to your own address. Note that the copy will not contain personalised
tokens -- it is sent with the raw token placeholders so you can see what was used.

---

## Standard Messages bar [C]

If you have saved any reusable email templates (see
[Section 36: Standard Email Messages](36-standard-email-messages.md)), you can load
one here:

- Select a template from the **Load standard message** dropdown. The subject and
  body are filled in for you -- you can still edit them before sending.
- Click **Save as standard message** to save your current subject and body as a new
  template for future use.

---

## Subject and message body [D]

- **Subject** -- type the subject line of your email. Personalisation tokens work
  here too.
- **Message** -- type the body of your email in the large text area. Use tokens
  from the panel on the right to personalise each email for every recipient.

---

## Tokens -- click to insert [E]

The token panel on the right-hand side lists all the personalisation placeholders
you can use. Click any token to insert it at the cursor position in the subject or
message body.

### Member tokens

| Token | Inserts |
|-------|---------|
| `#FAM` | Familiar name (the name the member is known by) |
| `#FORENAME` | Forename(s) |
| `#SURNAME` | Surname |
| `#TITLE` | Title (Mr, Mrs, Dr, etc.) |
| `#MEMNO` | Membership number |
| `#U3ANAME` | Your u3a's name |
| `#EMAIL` | Member's email address |
| `#TELEPHONE` | Telephone number |
| `#MOBILE` | Mobile number |
| `#ADDRESSV` | Full address (vertical, one line per field) |
| `#RENEW` | Renewal date |
| `#MEMCLASS` | Membership class |
| `#AFFILIATION` | Affiliation |
| `#EMERGENCY` | Emergency contact details |

### Partner tokens

If a member has a partner (joint membership), you can include their details too:

| Token | Inserts |
|-------|---------|
| `#PFAM` | Partner's familiar name |
| `#PFORENAME` | Partner's forename |
| `#PSURNAME` | Partner's surname |
| `#PTITLE` | Partner's title |
| `#PEMAIL` | Partner's email |
| `#PTELEPHONE` | Partner's telephone |
| `#PMOBILE` | Partner's mobile |

### Gift Aid tokens

When you reach the compose page from the **Gift Aid Declaration** screen, two
additional tokens appear:

| Token | Inserts |
|-------|---------|
| `#GIFTAID` | Gift Aid declaration date |
| `#GIFTAIDLIST` | Gift Aid eligible amounts |

These tokens are only available in that context and will not appear for a normal
email send.

> **Tip:** Tokens are not case-sensitive -- `#fam` works just as well as `#FAM`.

---

## Attachments [F]

Click the file input to attach one or more files to the email. There is a **20 MB
total limit** across all attachments.

> **Note:** Attachments are not recommended when sending to more than 50 recipients,
> as they significantly increase the size of the email batch.

To remove an attachment, click the red cross next to its filename.

---

## Sending the email

When you are happy with your message, click the **Send** button at the bottom of
the page. The button shows the number of recipients who will receive the email
(e.g. "Send to 42 recipients").

Beacon2 validates that you have filled in the From address, subject, and message
body before sending.

---

## After sending

Once the email has been despatched, a success page confirms:

- The number of emails sent (and any that failed).
- A link to **View delivery status**, which takes you to the delivery detail page
  for this batch (see [Section 37: Email Delivery](37-email-delivery.md)).
- A link back to **Home**.

---

## Next steps

- To save your message as a template for reuse, see
  [Section 36: Standard Email Messages](36-standard-email-messages.md).
- To track whether your emails were delivered, see
  [Section 37: Email Delivery](37-email-delivery.md).

---

[← 34. Pending Transactions](34-pending-transactions.md) | [Contents](index.md) | [36. Standard Email Messages →](36-standard-email-messages.md)
