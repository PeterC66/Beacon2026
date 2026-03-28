# 57. System Messages

System Messages lets you customise the automated emails that Beacon2 sends on
your behalf — for example, the confirmation a new member receives after joining
online, or the notification sent to an officer when a member updates their
details through the portal.

To open this page, click **System messages** in the **Set Up** section of the
Home page.

![The System Messages page](images/57-system-messages.png)

---

## The message list [A]

The page shows a list of message templates, each with a short title describing
when it is sent. Common templates include:

- Joining confirmation (sent to new members)
- Officer notification (sent to a designated officer when a member joins or
  updates their details)
- Portal details updated (sent when a member changes their personal details
  via the portal)

---

## Editing a message [B]

1. Click **Edit** next to the message you want to change.
2. The **Subject** and **Body** fields become editable.
3. Make your changes — you can write whatever text is appropriate for your u3a.
4. Click **Save** to confirm, or **Cancel** to discard your changes.

---

## Using tokens [C]

Message templates support **tokens** — placeholders that Beacon2 replaces with
actual member data when the email is sent. The available tokens are:

| Token | Replaced with |
|-------|---------------|
| `#FORENAME` | The member's first name |
| `#SURNAME` | The member's surname |
| `#MEMNO` | The member's membership number |
| `#MEMCLASS` | The member's membership class (e.g. Individual, Joint) |
| `#U3ANAME` | Your u3a's name |
| `#EMAIL` | The member's email address |

For example, a joining confirmation body might look like:

> Dear #FORENAME,
>
> Welcome to #U3ANAME! Your membership number is #MEMNO and your membership
> class is #MEMCLASS.

When the email is sent, the tokens are replaced with the actual values for
that member.

> **Tip:** Always test your messages after editing them. You can do this by
> creating a test member and triggering the relevant action to check that the
> email reads correctly with real data substituted in.

---

[← 56. Custom Fields](56-custom-fields.md) | [Contents](index.md) | [58. Public Links →](58-public-links.md)
