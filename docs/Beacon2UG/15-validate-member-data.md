# 15. Validate Member Data

The **Validate Member Data** tool checks your entire membership database for missing
or invalid information, helping you keep your records clean and accurate. It is
especially useful after importing data or at the start of the membership year.

To open it, go to the Home page and click **Utilities**, then choose
**Validate member data**.

![Validate member data screen](images/15-validate-member-data.png)

---

## What gets checked

When you run a validation, Beacon2 examines every member record and flags the
following problems:

### Missing mandatory fields

Every member should have a **Status**, **Class**, and **Joined date**. If any of
these are missing, the member is flagged. These fields are essential for renewals,
statistics, and reporting to work correctly.

### Invalid postcode

Postcodes are checked against the standard UK postcode format. If a postcode does
not match (for example, it has a missing space, extra characters, or is in a
non-UK format), it is flagged.

### Invalid email address

Email addresses are checked for correct format (e.g. they must contain an "@" and
a valid domain). Addresses that are clearly malformed are flagged — for example,
a missing dot in the domain or spaces in the address.

### Invalid phone or mobile number

Telephone and mobile numbers are checked for valid UK format. Numbers that are too
short, too long, or contain unexpected characters are flagged.

---

## Understanding the results

After the check runs, the results are displayed in a colour-coded list. Each colour
tells you what type of problem was found:

| Colour | Problem type |
|--------|-------------|
| **Orange** | Missing mandatory fields (status, class, or joined date) |
| **Yellow** | Invalid postcode |
| **Red** | Invalid email address |
| **Purple** | Invalid phone or mobile number |

Each row shows the member's name, membership number, and the specific issue found.

---

## Fixing issues inline

For certain fields, you can fix the problem right on the validation screen without
opening the full member record:

- **Postcode** — click the postcode value to edit it in place [A].
- **Email** — click the email value to edit it in place [B].
- **Mobile** — click the mobile number to edit it in place [C].
- **Telephone** — click the telephone number to edit it in place [D].

After making a correction, click **Save** [E] to update the member's record
immediately.

> **Tip:** Inline editing is great for quick fixes like correcting a typo in a
> postcode or email address. For anything more involved, click the member's name
> to open their full record.

---

## Issues that cannot be fixed inline

Some problems — such as a missing status, class, or joined date — cannot be edited
inline because they involve fields that are not shown on the validation screen.
For these, click the **member's name** [F] to open their full member record where
you can fill in the missing information.

---

## Re-checking after fixes

After you have made corrections, click the **Re-check** button [G] to run the
validation again. This refreshes the results so you can confirm that your fixes
have resolved the issues. Keep fixing and re-checking until you are happy that
your data is clean.

---

## Typical workflow

1. Click **Utilities** on the Home page, then **Validate member data**.
2. Wait for the validation to complete — this may take a moment if you have a
   large membership.
3. Review the colour-coded results.
4. Fix simple issues (postcodes, emails, phone numbers) inline by clicking the
   value and correcting it.
5. For missing mandatory fields, click the member's name to open their full record
   and add the missing data.
6. Click **Re-check** to confirm everything is now correct.

> **Tip:** It is good practice to run a validation check periodically — perhaps
> once a quarter or after a bulk import of new members — to catch any data issues
> early.

---

[← Previous: Membership Statistics](14-membership-statistics.md) | [Contents](index.md) | [Next: The Groups List →](16-groups-list.md)
