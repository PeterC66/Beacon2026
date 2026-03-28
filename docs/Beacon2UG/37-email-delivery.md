# 37. Email Delivery

The **Email Delivery** page lets you see every batch of emails you have sent and
track the delivery status of each recipient. This is useful for checking whether
your emails were delivered, or for diagnosing problems with specific addresses.

To open it, click **E-mail delivery** on the **Home** page.

![The email delivery page](images/37-email-delivery.png)

---

## The batch list

When the page opens, it shows a table of all your email batches, with the most
recent first.

| Column | What it shows |
|--------|---------------|
| **Sent** | The date and time the batch was sent |
| **Subject** | The email subject line |
| **From** | The From email address used |
| **Recipients** | The number of recipients in the batch |
| **View status** | A link to the detailed delivery page for that batch |

### Filtering by date [A]

Use the **From** and **To** date fields at the top of the page to narrow the list
to a particular date range. Click **Search** to apply the filter.

---

## Viewing delivery detail

Click **View status** on any batch to open the delivery detail page.

![Email delivery detail page](images/37-email-delivery-detail.png)

### Batch summary [B]

At the top, a summary panel shows:

- **Sent** -- the date and time the batch was despatched.
- **Subject** -- the email subject line.
- **From** -- the sender's email address.
- **Reply-To** -- the reply-to address (usually the same as From).
- **Recipients** -- the total number of recipients in the batch.

### Recipient table [C]

Below the summary, a table lists every recipient in the batch with the following
columns:

| Column | What it shows |
|--------|---------------|
| **Name** | The member's name, linked to their member record |
| **Email address** | The email address the message was sent to |
| **Status** | The current delivery status (colour-coded -- see below) |
| **Updated** | The date and time the status was last updated |

### Status colours

Beacon2 colour-codes the delivery status so you can spot problems at a glance:

| Colour | Statuses | Meaning |
|--------|----------|---------|
| Blue | Despatched, Processed | The email has been sent and is being processed |
| Green | Delivered | The email was successfully delivered to the recipient's inbox |
| Amber | Deferred | Delivery has been temporarily delayed -- it will be retried |
| Red | Bounced, Dropped, Invalid | The email could not be delivered |
| Orange | Blocked | The recipient's address is on a block list (see [Section 38](38-email-unblocker.md)) |
| Dark red | Reported as SPAM | The recipient reported your email as spam |

If there is an error message from the mail server, it is shown in brackets next to
the status.

### Refreshing statuses [D]

Delivery statuses are fetched from SendGrid (the email service provider). To get
the latest status for all recipients in the batch, click the **Refresh statuses
from SendGrid** button.

> **Tip:** It can take a few minutes for SendGrid to update statuses after sending.
> If all statuses still show "Despatched", wait a moment and click Refresh again.

---

## Typical workflow

1. Send an email from the compose page (see [Section 35](35-sending-emails.md)).
2. Click the **View delivery status** link on the success page, or navigate to
   **E-mail delivery** from the Home page.
3. Check that most recipients show a green **Delivered** status.
4. For any red statuses, check the error message -- you may need to correct the
   member's email address, or use the
   [Email Unblocker](38-email-unblocker.md) to remove a block.

---

[← 36. Standard Email Messages](36-standard-email-messages.md) | [Contents](index.md) | [38. Email Unblocker →](38-email-unblocker.md)
