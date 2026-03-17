**6.1.5** **Email** **tips,** **duplicates** **and** **sender**
**issues**<img src="./40bnvwrq.png"
style="width:2.05208in;height:0.38542in" />

> Back

Maximise chances of successful delivery

There are a numbers of ways in which you can reduce the likelihood of
your Beacon emails not being delivered:

> 1\. Minimise the frequency of sending emails to similar large lists
> (over 50) of recipients. It is better to delay until you have more
> information to put into a single email.
>
> 2\. Avoid sending emails that the majority of recipients won't bother
> to open. It encourages the system to assume that messages from the
> sender are spam.
>
> 3\. If you are sending an email to a large number of people, say over
> 50, please accept that your email will be processed by spam filters in
> the same way as mass marketing emails. Therefore you should follow the
> following industry guidelines for such mail.
>
> i\) Avoid or minimise sending attachments when sending an email to
> large lists of recipients. It is tempting to do so, as Beacon and
> SendGrid enable you to do so, but it is recommended instead to put the
> files on to your website and to provide a weblink to let the user
> download the file if they want. You can alternatively use services
> such as Dropbox.
>
> ii\) When putting a link (URL) into an email, do NOT use the URL
> itself as the clickable visible text. Instead use some descriptive
> English text. Note that this is the opposite of Beacon's previous
> guidance and is due to the way SendGrid handles links, and you may
> need to change some of your standard email messages.
>
> iii\) Maximum organisation visibility helps as well. Including your
> physical mailing address and phone number in your email footers helps
> mail providers recognise you as a legitimate organisation and sender
> of email. This also helps your recipients know that this message is
> indeed from you!
>
> iv\) Provide an explicit way for the recipient to unsubscribe from
> getting emails from you, even though you know they have said they want
> such emails. For example at the bottom of your email: *"To*
> *unsubscribe* *from* *these* *mails* *email* *memsec@youru3a* *with*
> *subject* *unsubscribe* *from* *emails."*

Duplicate emails to the same address

Sometimes members share an email address and this means that the Beacon
member record for those members will have the same email address. When
emails for these members are sent then duplicate emails will be
dispatched by Beacon. However, there are circumstances where these
duplicates go missing.

Emails for Beacon go to a specialist bulk emailer SendGrid. In order to
protect against errors and to protect their industry spamming
reputation, SendGrid filter out duplicates where the email, including
titles and contents, are

*identical*. Should you wish to get round this then personalising the
content of an email using a tag such as "Dear \#FAM," (to generate Dear
Graham, etc.) will ensure the email gets through SendGrid.

Unfortunately, some email providers will do their own filtering of
duplicate emails based on unpublished rules. For example, Gmail has been
observed to do this, perhaps based on a score derived from delivery
time, identical title and other spam assessments.

Beacon e-mail appears to have been sent by the wrong person

u3a members may experience problems whereby e-mails sent to them through
Beacon appear to have been sent by someone other than the person
actually sending them. This problem is generally at device level and so
members with multiple devices may experience it on some but not all
devices. Likewise, members may experience the problem on more than one
device but with each reporting a different 'wrong' sender.

The problem is due to the contact details, of a previously received
Beacon e-mail, having been saved in the **Address** **book/Contacts** on
the device(s). The solution is to check the **Address**
**book/Contacts** on the affected device(s) and delete any entry
associated with e-mail address noreply@u3abeacon.org.uk. To prevent a
recurrence, members should **not** save the contact details of any
Beacon e-mail.

The reason is that all Beacon e-mail, regardless of the sender or the
u3a, has the same **From:** address of noreply@u3abeacon.org.uk. Beacon
e-mails also have a **Reply-To:** field that contains the name and
e-mail address of the sender and provides the return path to them for
any replies.

If a member, receiving a Beacon e-mail, saves the contact details in
their Address book/Contacts, they will be saved with the sender's name,
as in the **Reply-To:** field, but with Beacon's **From:** address -
noreply@u3abeacon.org.uk. Consequently, all future Beacon emails
received on that device will appear to come from that same person
regardless of the actual person sending them. As an example, if Jane
Smith of Any u3a sends a Beacon e-mail and a member receiving it saves
the contact details, all subsequent e-mail received from Beacon on that
device will appear to have been sent by Jane Smith regardless of the
actual sender.

This is not a quirk or fault of Beacon mail but the way in which e-mail
Address books/Contacts work.

Hotmail tips

Hotmail is one of a few service providers that returns good status but
then discards the mail if the sender's address or domain name is on the
Blocked senders list.

First, go to the Blocked senders list and in the search field enter
"u3abeacon.org.uk" (without the quotes) and delete all entries found.

Then, add the full beacon e-mail address "noreply@u3abeacon.org.uk" or
just the domain "u3abeacon.org.uk" (no quotes) to the Safe senders list.

Revision History

||
||
||
||
||
