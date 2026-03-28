# 39. Composing Letters

Beacon2 lets you compose personalised letters for any selection of members and
download them as a multi-page PDF -- one letter per member. You reach the letter
compose page by selecting members and choosing **Send letter** from the
**Do with selected** menu.

![The letter compose page](images/39-composing-letters.png)

---

## Getting to the compose page

1. Go to the **Members List** (or a Group Members screen).
2. Tick the members you want to write to.
3. From the **Do with selected** dropdown, choose **Send letter** and click the
   button.

The compose page opens with your selected members shown as recipients.

---

## Recipients [A]

The **Recipients** area at the top shows the first five selected members by name,
plus a count of how many more are included (e.g. "... and 12 more"). This lets
you confirm you have the right people before composing.

---

## Standard Letters bar [B]

If your u3a has saved any reusable letter templates (see
[Section 40: Standard Letters](40-standard-letters.md)), you can load one here:

- Select a template from the **Load standard letter** dropdown. The letter body
  is filled in for you -- you can still edit it before downloading.
- Click **Save as standard letter** to save your current letter body as a new
  template for future use. Type a name and click **Save**.
- Click **Delete standard letter** (shown when a template is selected) to remove
  a template you no longer need.

> **Note:** Saving and deleting standard letters requires the appropriate
> permission. If you do not see the Save or Delete buttons, your role does not
> include that privilege -- ask your administrator.

---

## The rich text editor [C]

The letter body uses a rich text editor with a formatting toolbar at the top.
The toolbar gives you the following controls:

| Button | What it does |
|--------|--------------|
| **B** | Bold text |
| *I* | Italic text |
| <u>U</u> | Underline text |
| Align left | Left-align the current paragraph |
| Align centre | Centre-align the current paragraph |
| Align right | Right-align the current paragraph |
| Font size dropdown | Choose a font size: Small (10pt), Normal (12pt), Large (14pt), or Huge (18pt) |

Type your letter in the large editing area below the toolbar. You can format text
as you go, just like a word processor.

---

## Tokens -- click to insert [D]

The token panel on the right-hand side lists all the personalisation placeholders
you can use. Click any token to insert it at the cursor position in the letter
body. When the PDF is generated, each token is replaced with the corresponding
detail for each member.

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

> **Tip:** Tokens are not case-sensitive -- `#fam` works just as well as `#FAM`.

---

## Downloading the letters

When you are happy with your letter, click the **Download** button at the bottom
of the page. The button shows the number of letters that will be generated (e.g.
"Download (42 letters)").

Beacon2 generates a multi-page PDF file with one letter per selected member.
Each letter has the personalisation tokens replaced with that member's details.
The PDF downloads automatically to your computer.

---

## After downloading

Once the PDF has been generated, a success page confirms the number of letters
created. From there you can:

- Click **Compose another** to start a new letter.
- Click **Members** to return to the Members List.
- Click **Home** to return to the Home page.

---

## Tips

- Use the `#ADDRESSV` token to include the member's full postal address, with
  each line on a separate row -- ideal for a letter heading.
- If you regularly send the same style of letter, save it as a standard letter
  (see [Section 40](40-standard-letters.md)) so you do not have to format it
  from scratch each time.
- Letters are downloaded as a PDF, so you can print them directly or save them
  for your records.

---

[← 38. Email Unblocker](38-email-unblocker.md) | [Contents](index.md) | [40. Standard Letters →](40-standard-letters.md)
