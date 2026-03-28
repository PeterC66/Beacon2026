# 38. Email Unblocker

The **Email Unblocker** is an admin tool that removes an email address from
SendGrid's bounce and spam report lists. Once unblocked, future emails sent through
Beacon2 will be delivered to that address again.

To open it, click **E-mail unblocker** on the **Home** page. This feature requires
the full email permission.

![The email unblocker page](images/38-email-unblocker.png)

---

## When to use this

When an email bounces (because of a typo, a full mailbox, or a temporary server
issue), SendGrid adds the address to a block list to protect your u3a's sender
reputation. Once blocked, no further emails will be sent to that address until it
is unblocked.

You should use the unblocker when:

- A member tells you they are not receiving emails from Beacon2.
- You see a **Blocked**, **Bounced**, or **Dropped** status on the
  [Email Delivery](37-email-delivery.md) detail page.
- You have confirmed that the member's email address is correct and working (ask
  them to send you a test email first).

---

## How to unblock an address

1. Open the **Email Unblocker** page from the Home page.
2. Enter the email address you want to unblock in the **Email address to unblock**
   field [A]. It is best to copy and paste the address from the member's record to
   avoid typing errors.
3. Click the **Unblock email address** button [B].
4. A green success message confirms the address has been removed from the block
   lists, or an error message is shown if something went wrong.

> **Important:** Always confirm the email address is valid before unblocking. If the
> address is genuinely invalid (e.g. the mailbox no longer exists), unblocking it
> will only cause it to bounce again and could harm your u3a's sender reputation.

---

## Tips

- If a member has changed their email address, update their member record first,
  then unblock the old address if needed -- but usually you will only need to
  ensure the new address is not blocked.
- You do not need to unblock addresses that show a **Deferred** status -- SendGrid
  will automatically retry those.
- If you are unsure whether an address needs unblocking, check the
  [Email Delivery](37-email-delivery.md) detail page for that member's most recent
  email to see the exact status and error message.

---

[← 37. Email Delivery](37-email-delivery.md) | [Contents](index.md) | [39. Composing Letters →](39-composing-letters.md)
