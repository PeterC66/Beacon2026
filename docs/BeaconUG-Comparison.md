# Beacon2 vs Beacon User Guide — Comparison

> **Purpose:** Continuously track how Beacon2 differs from the original Beacon
> as documented in the Beacon User Guide (`docs/BeaconUG/`).
>
> **How to read this document:**
> - **Built** — feature exists and broadly matches the UG description
> - **Partial** — feature exists but some aspects are missing or different
> - **Not started** — feature not yet implemented
> - **Beacon2 extra** — functionality in Beacon2 that is not in the original Beacon
>
> **Last updated:** 2026-03-28

---

## 1. Introduction (doc 1)

| Aspect | Status | Notes |
|--------|--------|-------|
| General introduction to the system | Built | Beacon2 serves the same purpose — management platform for u3a organisations |
| **Beacon2 extra:** Modern tech stack | Beacon2 extra | React + Node.js + PostgreSQL replaces the original platform; multi-tenant schema-per-tenant architecture |

---

## 2. Logging in as a System User (doc 2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Username/password login | Built | Beacon2 uses username-based login (lowercase alphanumeric) with email fallback for legacy users |
| Login page | Built | Dedicated login page with inline password recovery |
| **Beacon2 extra:** Cookie consent | Beacon2 extra | GDPR-compliant cookie consent dialog on first visit; gear icon to reopen |

---

## 3. The Beacon Home Page (doc 3)

| Aspect | Status | Notes |
|--------|--------|-------|
| Home page with navigation | Built | Card-based home page with privilege-gated navigation to all modules |
| Module organisation | Built | Same modules: Membership, Groups, Finance, Email, Set-up, Misc |
| Fixed links (Forum, User Guide, Website) | Built | Links to Beacon resources shown in bottom panel |
| Public website links (Join, Portal, Groups, Calendar) | Built | Join, Portal, Public groups list, and Public calendar all active |
| Documents link | Built | Links to prospective Beacon users documentation |
| System-wide message | Built | Editable by system admin from System Dashboard; displayed on all tenants' Home pages |
| Home page notice (tenant message) | Built | Uses `home_page_notice` system message with `#U3ANAME` substitution |
| **Beacon2 extra:** Privilege-gated cards | Beacon2 extra | Home page cards are greyed out if user lacks privileges (rather than hidden) |

---

## 4. Logging in with a new password (doc 4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Force change password on first login | Built | `must_change_password` flag enforced; dedicated `/change-password` route |
| Password requirements | Built | Min 10 chars, no spaces, upper+lower+number |
| Security Q&A setup | Built | Required during forced password change |
| Blocks navigation until completed | Built | — |

---

## 5. Beacon Cookies and Anti-Track Software (doc 5)

| Aspect | Status | Notes |
|--------|--------|-------|
| Cookie usage explanation | Built | Cookie consent dialog lists all cookies used |
| Essential vs optional cookies | Built | Essential (refresh token, consent) always allowed; optional cookies gated behind consent |
| Anti-tracking software guidance | Not started | No dedicated guidance page; cookie consent handles the functional aspect |
| Last membership class cookie | Built | Addresses Export persists last class filter in `beacon2_last_export_class` (consent-gated) |
| Label printing settings cookie | Built | Label settings persist in `beacon2_label_settings` (now consent-gated) |
| TAM submission cookie | Built | TAM status + class persist in `beacon2_tam_submission` (consent-gated); restored when TAM format selected |
| Email compose prefs cookie | Built | From address and copy-to-self persist in `beacon2_email_compose_prefs` (consent-gated) |

---

## 6. Some tips when using Beacon (doc 6)

| Aspect | Status | Notes |
|--------|--------|-------|
| General usage tips | Not started | No dedicated tips page; contextual help via HelpWidget (Zendesk integration) |
| **Beacon2 extra:** Context-sensitive help | Beacon2 extra | HelpWidget provides route-mapped help links |

---

## 4. Membership (doc 4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Membership module overview | Built | Full membership module with all sub-features |

---

### 4.1 The Membership List (doc 4.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Member list with filters | Built | Status/class/poll/letter/search filters |
| Row selection | Built | Checkbox selection for bulk actions |
| Bulk actions (add to poll, add to group, send email, send letter) | Built | — |
| Download (Excel/PDF/email CSV) | Built | — |
| Sortable columns | Built | Via `useSortedData` hook (supports compound sort keys) |
| **Beacon2 extra:** Letter filter | Beacon2 extra | Filter members by letter assignment |
| **Beacon2 extra:** Consolidated name column | Beacon2 extra | Single "Name" column showing `forenames (known_as) surname`; sortable by name or by surname; member number and name both link to member record |
| **Beacon2 extra:** Telephone + mobile columns | Beacon2 extra | Separate telephone and mobile columns shown instead of email |

---

### 4.2 Member Record (doc 4.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Personal details editing | Built | Forenames, surname, title, etc. |
| Address fields | Built | With sharing and partner linking; shows address record created/last-changed timestamps |
| Phone/email/postcode validation | Built | — |
| Status and class | Built | — |
| Dates (joined, renewed, etc.) | Built | Via DateInput component |
| Gift Aid | Built | — |
| Partner linking (bidirectional) | Built | Auto-shares address |
| Poll tick boxes | Built | — |
| Groups & Ledger tabs | Built | — |
| Photo upload | Built | Upload/view/remove in member record and portal; appears on membership cards and group members PDF. Drag-and-drop supported. |
| **Beacon2 extra:** Inline validation | Beacon2 extra | Field-level blur validation with error messages |
| **Beacon2 extra:** Compact view | Beacon2 extra | Read-only condensed layout at `/members/:id/compact` — fits all member data on one laptop screen, inspired by Beacon's dense layout. Accessible via "Compact View" nav link on member record |

---

### 4.2.1 Deleting Duplicate Members (doc 4.2.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Delete duplicate members | Built | Member deletion available from member record |

---

### 4.2.3 Removing deleted members from Groups (doc 4.2.3)

| Aspect | Status | Notes |
|--------|--------|-------|
| Clean up group membership after delete | Built | Handled automatically when member is deleted |

---

### 4.2.4 Hiding Contact Details from Group Leaders (doc 4.2.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Per-member "hide contact details" checkbox | Built | `hide_contact` field on member record; hides email/phone in group members list |
| Per-group "show addresses to group leader" toggle | Partial | `show_addresses` field stored on group record, but **not yet wired into visibility logic** — currently only `hide_contact` is checked |
| System-wide "hide address from group leaders" | Not started | Global setting from doc 4.2.4(b) not yet implemented |

---

### 4.3 Add New Member (doc 4.3)

| Aspect | Status | Notes |
|--------|--------|-------|
| Dedicated add member form | Built | — |
| Auto-Current status | Built | — |
| Gift Aid tickbox | Built | — |
| Default town/county/STD code pre-fill | Built | From system settings |
| Postcode auto-uppercase | Built | — |
| Creates membership payment entry | Built | — |
| Joined date hidden (auto-filled) | Built | Set automatically, not shown on add form |
| Send email hidden on add | Built | Button only shown for saved members |
| Emergency contact above Notes | Built | — |
| Payment overpayment highlight | Built | Blue banner showing donation amount |
| Payment underpayment highlight | Built | Amber banner showing shortfall |

---

### 4.3.1 Addresses & Phone Numbers (doc 4.3.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Address and phone handling | Built | Full address fields with validation |

---

### 4.3.2 Shared Addresses & Joint Members (doc 4.3.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Shared addresses | Built | Partner linking auto-shares address |
| Joint membership | Built | Via member class `is_joint` attribute |

---

### 4.4 Recent Members (doc 4.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Recently joined/renewed list | Built | — |
| Bulk actions (Do with selected) | Built | Download names txt, Send email, Send letter, Add to poll, Add to group, Download Excel/PDF |
| **Beacon2 extra:** Consolidated name column | Beacon2 extra | Single "Name" column with `formatMemberName()`; Name/by surname sort options |

---

### 4.5 Membership Renewals (doc 4.5)

| Aspect | Status | Notes |
|--------|--------|-------|
| Period tabs | Built | — |
| Bulk renew with finance transactions | Built | — |
| **Beacon2 extra:** Payment method defaults | Beacon2 extra | Auto-populates from Membership Payment Method Defaults (doc 8.6c) |
| **Beacon2 extra:** Sortable columns + consolidated name | Beacon2 extra | `useSortedData` sorting with Name/by surname options |

---

### 4.5.1–4.5.4 Renewal sub-topics (docs 4.5.1–4.5.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Changing class at renewal (4.5.1) | Built | — |
| Members renewed by mistake (4.5.2) | Built | Can undo renewal |
| Generate renewed members list (4.5.3) | Built | Via member list filters |
| Batch renewal confirmation emails (4.5.4) | Built | Bulk email from member list |

---

### 4.6 Non-renewals (doc 4.6)

| Aspect | Status | Notes |
|--------|--------|-------|
| This year / long term modes | Built | — |
| Bulk lapse / delete | Built | — |
| **Beacon2 extra:** Consolidated name + extra columns | Beacon2 extra | Name/by surname sort; Address, Phone, Last Renewal (year) columns; no-email icon |

---

### 4.7 Membership Cards (doc 4.7)

| Aspect | Status | Notes |
|--------|--------|-------|
| Card-printed tracking | Built | — |
| Radio-button filters | Built | Outstanding/poll/all |
| Download PDF cards (85×54mm, 10/A4, barcode) | Built | Code 128 barcode |
| Blank cards PDF | Built | — |
| Excel card data export | Built | — |
| Send card by email | Built | — |
| Mark-as-printed flow | Built | — |
| **Beacon2 extra:** Consolidated name + short address | Beacon2 extra | Name/by surname sort; single address column replaces town/postcode; no email column |
| Advance expiry to next year | Built | — |
| Auto-attach cards to confirmation emails | Not started | `email_cards` setting stored but not wired to email flow |
| Portal: order replacement card | Built | PortalRequestCard.jsx; validates Current status and renewal period; marks card_printed=false; PDF attachment in confirmation email still stubbed |

---

### 4.8 Addresses Export (doc 4.8)

| Aspect | Status | Notes |
|--------|--------|-------|
| Filtered download (Excel/CSV/TSV/TAM) | Built | — |
| PDF label printing | Built | — |

---

### 4.8.1 Label Printing Settings (doc 4.8.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Printer settings for labels | Built | All settings (cols, rows, width, height, offsets, font size) adjustable; "Save as defaults" persists to localStorage (consent-gated) |

---

### 4.9 Statistics (doc 4.9)

| Aspect | Status | Notes |
|--------|--------|-------|
| Per-class counts | Built | — |
| Status breakdown | Built | — |
| Group stats | Built | — |
| Renewal stats | Built | — |

---

## 5. Groups (doc 5)

| Aspect | Status | Notes |
|--------|--------|-------|
| Groups module overview | Built | Full groups module |

---

### 5.1 Groups List (doc 5.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Sortable groups list | Built | — |
| Create/edit/delete groups | Built | — |
| Row selection + bulk actions | Built | Send email to leaders, download Excel/PDF, add members to poll |

---

### 5.2 Group Records: Details (doc 5.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Group details tab | Built | — |
| Venue dropdown | Built | — |
| Faculty assignment | Built | — |
| **Beacon2 extra:** SiteWorks integration | Beacon2 extra | Tenant-wide toggle hides scheduling/venue fields when SiteWorks manages events |
| **Beacon2 extra:** Record timestamps | Beacon2 extra | "Group record created …; last changed …" shown at the bottom of the Details tab |

---

### 5.3 Group Record: Schedule (doc 5.3)

| Aspect | Status | Notes |
|--------|--------|-------|
| Single + recurring events | Built | — |
| Inline edit | Built | — |
| Bulk delete | Built | — |
| Hidden when SiteWorks activated | Built | SiteWorks toggle hides Schedule tab |

---

### 5.4 Group Record: Members (doc 5.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Add/remove members | Built | — |
| Mark leaders | Built | — |
| Waiting list with auto-enforcement | Built | — |
| PDF download with photos | Built | Includes member photos when available; falls back to tabular layout when no photos exist |
| Bulk actions (Do with selected) | Built | Send email, Download Excel/PDF, Remove members, Add to another group (with waiting-list support) |
| **Beacon2 extra:** Consistent with members list | Beacon2 extra | Columns, name formatting, links, sort, overdue styling, and no-email indicator all match the main members list |

---

### 5.5 Group Record: Ledger (doc 5.5)

| Aspect | Status | Notes |
|--------|--------|-------|
| Per-group in/out transactions | Built | Independent from main finance |
| Download Excel | Built | — |

---

### 5.6 Adding & Removing Groups (doc 5.6)

| Aspect | Status | Notes |
|--------|--------|-------|
| Add/remove groups | Built | Delete guard prevents removal of groups with members/transactions |

---

### 5.7 Group Venues (doc 5.7)

| Aspect | Status | Notes |
|--------|--------|-------|
| Venue CRUD | Built | — |
| Venue dropdown on group | Built | — |
| Venue fields: contact, single address, postcode | Built | Replaces multi-field address layout |
| Send email button on venue email field | Built | Opens mailto: link |
| Open website button on venue website field | Built | Opens in new tab |
| Venue list: Name, Contact, Telephone, Accessible | Built | Simplified from previous layout |

---

### 5.8 Group Faculties (doc 5.8)

| Aspect | Status | Notes |
|--------|--------|-------|
| Faculty inline CRUD | Built | — |

---

### 5.9 The Calendar (doc 5.9)

| Aspect | Status | Notes |
|--------|--------|-------|
| Chronological event view | Built | All group events + open meetings within date range |
| Date range (default next 3 months) | Built | — |
| Filters (all/member/venue/group) | Built | Member search autocomplete |
| Show Detail toggle | Built | — |
| Clickable links to group/venue records | Built | — |
| Google Maps link for venues | Built | For venues with postcode |
| Download PDF | Built | — |

---

### 5.10 Dealing with a waiting list (doc 5.10)

| Aspect | Status | Notes |
|--------|--------|-------|
| Waiting list management | Built | Auto-enforcement of max members; waiting list support |

---

### 5.11 Groups for one-off events (doc 5.11)

| Aspect | Status | Notes |
|--------|--------|-------|
| One-off event groups | Built | Can create groups for single events |
| **Beacon2 extra:** Open Meetings | Beacon2 extra | Events not tied to any group (group_id = NULL); dedicated Open Meetings page with recurrence support |

---

## 6. Emails and Letters (doc 6)

| Aspect | Status | Notes |
|--------|--------|-------|
| Email and letter module overview | Built | Both email and letter features implemented |

---

### 6.1 Emails (doc 6.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Email module overview | Built | — |

---

### 6.1.1 Sending Emails (doc 6.1.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Email compose with member selection | Built | — |
| Token substitution | Built | — |
| Attachments | Built | Via SendGrid |

---

### 6.1.2 Standard Email Messages (doc 6.1.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| CRUD email templates | Built | — |

---

### 6.1.3 Email Delivery (doc 6.1.3)

| Aspect | Status | Notes |
|--------|--------|-------|
| Batch list | Built | — |
| Per-recipient status | Built | — |
| SendGrid Activity refresh | Built | — |

---

### 6.1.4 Email Unblocker (doc 6.1.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Remove from bounce/spam lists | Built | Admin tool |

---

### 6.1.5 Email tips, duplicates and sender issues (doc 6.1.5)

| Aspect | Status | Notes |
|--------|--------|-------|
| Email guidance | Not started | No dedicated tips page; functionality handles deduplication |

---

### 6.2 Letters (doc 6.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Letter feature | Built | Letter compose page |

---

### 6.2.1 Composing Letters (doc 6.2.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Letter composition | Built | — |

---

### 6.2.2 Standard Letters (doc 6.2.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Standard letter templates | Built | — |

---

## 7. Finance (doc 7)

| Aspect | Status | Notes |
|--------|--------|-------|
| Finance module overview | Built | Full finance module with all core features |

---

### 7.1 Financial Ledger (doc 7.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Account/category/group views | Built | — |
| Year selector | Built | Calendar year filtering |
| Running balance | Built | Shown in all views; excludes pending transactions |
| Group view with per-group B/F rows | Built | When enabled via 7.10.6 setting |
| Full ledger columns | Built | Account, #, Date, Batch No, Batch Ref, From/To, Group, Mem#, Mem2#, Detail, Category, Payment Ref, Method, In, Out, Refund, Balance, Cleared |
| Clickable links | Built | # → transaction, Batch No → batch, Group → group record, Mem# / Mem2# → member record, Refund → transaction |

---

### 7.2 Transaction Record (doc 7.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Full transaction form | Built | — |
| Category splits | Built | — |
| Cleared lock | Built | — |
| Member search | Built | Client-side filter with `<select size={4}>` |
| Gift Aid eligible amount | Built | Per-member amount fields shown for incoming transactions linked to members; read-only claimed date |
| Gift Aid for Member 2 | Built | Separate gift_aid_amount_2 / gift_aid_claimed_at_2 columns |

---

### 7.3 Transfer Money (doc 7.3)

| Aspect | Status | Notes |
|--------|--------|-------|
| Paired transactions with shared transfer_id | Built | — |

---

### 7.4 Credit Batches (doc 7.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Create/view/delete batches | Built | — |
| Add/remove transactions | Built | Remove via checkboxes with Current/New totals; add from detail view |
| Batch reference field | Built | Editable on batch detail view |
| Batch description field | Built | Editable on batch detail view |
| Batch date | Built | Editable; defaults to creation date; used for "since" filtering |
| Batch number | Built | Auto-calculated sequential number per account |
| Auto-select default account | Built | First locked account pre-selected on page load |
| Auto-display batch list | Built | No Show button; auto-loads on account/mode/date change |
| Batches as single rows in reconciliation | Built | — |

---

### 7.5 Reconcile Account (doc 7.5)

| Aspect | Status | Notes |
|--------|--------|-------|
| Mark transactions as cleared | Built | — |
| Clear whole batches in one tick | Built | — |

---

### 7.6 Financial Statement (doc 7.6)

| Aspect | Status | Notes |
|--------|--------|-------|
| Per-account or all-accounts | Built | — |
| Year selector | Built | — |
| Download Excel | Built | — |
| Excludes pending transactions | Built | With warning banner |

---

### 7.6.1 Calculate a true surplus/deficit (doc 7.6.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Surplus/deficit calculation | Built | Included in financial statement |

---

### 7.7 Groups Statement (doc 7.7)

| Aspect | Status | Notes |
|--------|--------|-------|
| Per-group ledger summary | Built | — |
| Optional transactions detail | Built | — |
| Download | Built | — |

---

### 7.7.1 Group Leaders Viewing transactions (doc 7.7.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Group leader access to finance | Built | Via privilege system — group leaders can see their group's ledger |

---

### 7.8 Gift Aid (doc 7.8)

| Aspect | Status | Notes |
|--------|--------|-------|
| Financial-year filtered view | Built | — |
| Row selection | Built | — |
| Download Excel (HMRC format) | Built | — |
| Mark as claimed | Built | — |
| Send email with GA tokens | Built | `#GIFTAID` and `#GIFTAIDLIST` tokens |
| Joint membership Gift Aid | Built | Member 2 gift aid amount and claiming supported; declaration UNION query returns separate rows per member slot |

---

### 7.9 Working with PayPal (doc 7.9)

| Aspect | Status | Notes |
|--------|--------|-------|
| PayPal integration | Partial | Stub functions with clear interfaces; actual PayPal REST API not yet connected |

---

### 7.9.1 Setting up Online Membership Payments (doc 7.9.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| PayPal payment setup | Partial | Online joining has PayPal payment stub; real integration deferred |

---

### 7.10 Financial Approaches (doc 7.10)

| Aspect | Status | Notes |
|--------|--------|-------|
| Financial approaches overview | Built | — |

---

### 7.10.1 Changing your Financial Year (doc 7.10.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Financial year configuration | Built | Calendar year approach |

---

### 7.10.2 Setting up Beacon Finance (doc 7.10.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Finance setup guidance | Built | Finance accounts CRUD, categories, balance b/f |

---

### 7.10.3 Resetting Finance after non-use (doc 7.10.3)

| Aspect | Status | Notes |
|--------|--------|-------|
| Finance reset guidance | Not started | No dedicated reset wizard; achievable through account/transaction management |

---

### 7.10.4 Resetting Finance if never used (doc 7.10.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| First-time finance setup | Not started | No dedicated wizard; achievable through account/transaction management |

---

### 7.10.5 Pending Transactions (doc 7.10.5)

| Aspect | Status | Notes |
|--------|--------|-------|
| Per-account pending config | Built | Disabled/optional/by_type modes |
| Auto-pending on creation | Built | — |
| Bulk confirm/make-pending | Built | From ledger |
| Excluded from running balance | Built | — |

---

### 7.10.6 Opening Balance for Groups (doc 7.10.6)

| Aspect | Status | Notes |
|--------|--------|-------|
| Group B/F tickbox on accounts | Built | — |
| Per-group B/F rows in ledger | Built | — |

---

### 7.10.7 Refunds (doc 7.10.7)

| Aspect | Status | Notes |
|--------|--------|-------|
| Per-account enable_refunds toggle | Built | — |
| Refund form with per-category amounts | Built | — |
| Reciprocal linking (refund_of_id / refunded_by_id) | Built | — |
| Financial statement nets refunds | Built | — |
| Ledger shows Refund column | Built | With linked transaction numbers; red rows |
| Date/year/cleared guards | Built | — |

---

## 8. Set-Up Operations (docs 8, 8.x)

| Aspect | Status | Notes |
|--------|--------|-------|
| Set-up module overview | Built | — |

---

### 8.1 The Site Administrator (doc 8.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| `is_site_admin` flag | Built | ALL privileges implicit; cannot be deleted |
| Shown prominently in user list | Built | — |

---

### 8.1a Suggestion for new sites re Existing Membership (doc 8.1a)

| Aspect | Status | Notes |
|--------|--------|-------|
| New site guidance | Not started | No dedicated onboarding wizard; data restore from Beacon format handles migration |

---

### 8.2 System Users (doc 8.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| User CRUD | Built | — |
| Role assignment | Built | — |
| User ↔ member link | Built | `member_id` FK; create user from member dropdown |
| Auto-generated temp password | Built | — |
| Set-temp-password per user | Built | — |
| User list columns | Built | Select/Full Name/Login User Name/Member/Site Admin/Date Created/Last Accessed/Roles |

---

### 8.2.1 Contact all Users (doc 8.2.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Send email to selected users | Built | — |

---

### 8.3 System Settings (doc 8.3)

| Aspect | Status | Notes |
|--------|--------|-------|
| All fields from Beacon doc 8.3 | Built | Stored and editable |
| public_phone, public_email, home_page | Partial | Stored but not yet displayed to members (portal, joining form) |
| email_cards | Partial | Stored but auto-attach logic not wired |
| gift_aid_online_renewals | Built | Controls Gift Aid checkboxes on portal renewal page |
| online_renew_email | Built | Shown on portal renewal page as contact email |

---

### 8.4 Roles and Privileges (doc 8.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Full privilege matrix | Built | — |
| Role CRUD | Built | — |

---

### 8.4.1 Privileges Map and default Privileges (doc 8.4.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Default privilege configuration | Built | Seeded on tenant creation; configurable per-u3a |

---

### 8.5 System Messages (doc 8.5)

| Aspect | Status | Notes |
|--------|--------|-------|
| Admin page for editing auto-sent email templates | Built | Token substitution support |

---

### 8.6 Finance Set-up (doc 8.6)

| Aspect | Status | Notes |
|--------|--------|-------|
| Finance accounts CRUD | Built | Locked protection, active toggle, balance b/f |
| Finance categories | Built | — |
| Group B/F tickbox | Built | — |
| **Beacon2 extra:** Membership Payment Method Defaults | Beacon2 extra | Default payment method and per-type default account (doc 8.6c); auto-populates renewals |
| **Beacon2 extra:** Refund enable per account | Beacon2 extra | Per-account `enable_refunds` toggle (doc 8.6e) |

---

### 8.7 Membership Set-up (doc 8.7)

| Aspect | Status | Notes |
|--------|--------|-------|
| Member classes CRUD | Built | Monthly fee grid when `fee_variation = 'varies_by_month'`; delete guard |
| Member statuses | Built | Inline rename |

---

### 8.8 Polls (doc 8.8)

| Aspect | Status | Notes |
|--------|--------|-------|
| Poll CRUD | Built | — |
| Member list filter by poll | Built | — |
| Bulk assign | Built | — |

---

### 8.9 Considerations when changing fees and membership years (doc 8.9)

| Aspect | Status | Notes |
|--------|--------|-------|
| Guidance on fee/year changes | Not started | No dedicated guidance page; functionality supports the changes described |

---

## 9. Miscellaneous Options (doc 9)

| Aspect | Status | Notes |
|--------|--------|-------|
| Misc module overview | Built | — |

---

### 9.1 Personal Preferences (doc 9.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Display preferences | Built | — |
| Change password | Built | — |
| Security Q&A | Built | — |
| Inactivity timeout | Built | — |

---

### 9.2 Audit Logs and Searches (doc 9.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Date-filtered audit view | Built | — |
| Delete-before-date | Built | — |
| Clickable When → Audit Record detail | Built | — |
| Clickable Record → entity view | Built | — |

---

### 9.3 u3a Officers (doc 9.3)

| Aspect | Status | Notes |
|--------|--------|-------|
| Officer CRUD | Built | — |
| Email sending | Built | — |
| Status-based styling | Built | — |

---

### 9.4 Public Links (doc 9.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| Online joining toggle | Built | — |
| Privacy policy URL | Built | — |
| Copyable member services URLs | Built | Join URL and Members Portal URL |
| Copyable public information URLs | Built | Groups list and Calendar URLs (public pages not yet built) |
| PayPal status indicator | Built | — |
| Members Portal feature toggles | Built | Configure renewals, groups, calendar, personal details, replacement card toggles (stored in `portal_config` JSONB; portal features themselves not yet built) |
| Group Information display options | Built | Grid of to-members/to-public toggles for status, venue, contact, detail, enquiries, join group (stored in `group_info_config` JSONB) |
| Calendar display options | Built | Grid of to-members/to-public toggles for venue, topic, enquiries, detail, download (stored in `calendar_config` JSONB) |

---

### 9.4.1 Setting up Online Joining/Renewal (doc 9.4.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Online joining setup guide | Built | Online joining works end-to-end |
| Joint membership online joining | Built | Shows second-person fields when joint class selected; creates both members linked at same address |
| Online renewal setup | Built | Portal renewal with Gift Aid, joint support, PayPal payment |

---

### 9.5 Data Export and Backup (doc 9.5)

| Aspect | Status | Notes |
|--------|--------|-------|
| 8 export types (Excel) | Built | — |
| Full restore (Beacon2 + Beacon format) | Built | — |

---

### 9.5.1 What to do with Beacon records when leaving (doc 9.5.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Data export guidance | Not started | Export functionality exists; no dedicated leaving-Beacon guide |

---

### 9.6 Recovering a forgotten Username or Password (doc 9.6)

| Aspect | Status | Notes |
|--------|--------|-------|
| Inline recovery on login page | Built | — |
| Identify by forename/surname/postcode/email | Built | Matched against linked member |
| Security Q&A verification | Built | Skipped if not set |
| Sends email with username + new temp password | Built | — |
| Blocked for site administrators | Built | — |

---

### 9.7 Temporary Passwords (doc 9.7)

| Aspect | Status | Notes |
|--------|--------|-------|
| `must_change_password` flag | Built | Enforced on login |
| Set automatically on user creation | Built | — |
| Set-temp-password per user | Built | — |

---

### 9.8 Setup Online Transactions (PayPal) (doc 9.8)

| Aspect | Status | Notes |
|--------|--------|-------|
| PayPal setup | Partial | Stub functions; real PayPal REST API integration deferred |

---

### 9.9 Officers Notification of people Joining Online (doc 9.9)

| Aspect | Status | Notes |
|--------|--------|-------|
| Officer notification emails on online join | Built | Via system messages |

---

## 10. Online Services (doc 10)

| Aspect | Status | Notes |
|--------|--------|-------|
| Online services overview | Built | Online joining, online renewals, Members Portal, and public pages (groups list, calendar) all built |

---

### 10.1 Online Joining (doc 10.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Public joining form | Built | Class selection, personal details, address, Gift Aid consent |
| PayPal payment | Partial | Stub — payment confirmation flow wired but PayPal API not connected |
| Creates member with Applicant status | Built | Promotes to Current on payment, clears payment token |
| Unpaid application handling | Built | JoinPending page with Pay Now, bookmarkable resume-payment link, email-me-this-link |
| Resume payment from link | Built | ResumePayment page via `/resume-payment/:token`, re-initiates PayPal |
| Payment link email | Built | `online_join_payment_link` system message with `#PAYMENTLINK` token |
| Admin Add Member without payment | Built | Auto-sets Applicant status + payment token; offers to email payment link |
| Admin cleanup of Applicants | Built | Filter Members List by Applicant status, delete individually via member editor |
| Finance transaction creation | Built | — |
| Confirmation email + officer notifications | Built | — |
| Joint membership joining | Not started | Deferred |

---

### 10.2 Members Portal (doc 10.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| Portal registration | Built | Identity verification (memno + name + postcode) |
| Portal login | Built | Separate auth on members table |
| Version number display | Built | All portal screens show app version top-right |
| Email verification flow | Built | — |
| Password reset flow | Built | — |
| Shared email address handling | Not started | Deferred |

---

### 10.2.1 Online Renewals (doc 10.2.1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Online renewals | Built | Gift Aid opt-in/out, joint renewal, PayPal payment, advance_renewals_weeks window |

---

### 10.2.2 Viewing your Interest Groups (doc 10.2.2)

| Aspect | Status | Notes |
|--------|--------|-------|
| View all active groups | Built | Accordion list with MEMBER/WAITING badges |
| Group details (When, Venue, Contact, Info) | Built | Controlled by group_info_config.members toggles |
| Join group with confirmation | Built | Includes waiting list support when group is full |
| Leave group with confirmation | Built | Confirmation dialog before removal |
| Group leader notification | Partial | Logic in place but email sending stubbed |

---

### 10.2.3 Viewing your Calendar (doc 10.2.3)

| Aspect | Status | Notes |
|--------|--------|-------|
| Calendar event list | Built | Events from now to end of year |
| Filter: All / Group / Own groups | Built | Radio buttons + group dropdown |
| Column visibility (Venue, Topic, Enquiries) | Built | Controlled by calendar_config.members toggles |
| Download PDF | Built | Controlled by calendar_config.download.members toggle |

---

### 10.2.4 Updating your Personal Details (doc 10.2.4)

| Aspect | Status | Notes |
|--------|--------|-------|
| View/edit personal details | Built | Title, name, known as, suffix, initials, mobile, email, emergency contact |
| View/edit address | Built | House no, street, add line, town, county, postcode, phone |
| Hide contact from group leaders | Built | Checkbox toggle |
| Change password | Built | Expandable section with validation |
| Email change triggers re-verification | Built | Logs out member after email change, must re-verify |
| Confirmation email | Built | Uses portal_details_updated system message template |
| Photo upload | Built | Upload/view/remove photo with drag-and-drop support; appears on membership card |

---

### 10.2.5 Ordering a new Membership Card (doc 10.2.5)

| Aspect | Status | Notes |
|--------|--------|-------|
| Request replacement card | Built | Validates Current status and within renewal period |
| Confirmation email | Partial | Uses card_replacement_confirm template, but PDF attachment not yet wired |
| Mark card as not printed | Built | Sets card_printed = false so admin knows to reprint |

---

## 12. Beacon for Networks and Regions (doc 12)

| Aspect | Status | Notes |
|--------|--------|-------|
| Network/region features | Not started | No network or region functionality exists in Beacon2 |

---

## Beacon2 Additions Not Covered by UG Sections

These are features or architectural aspects of Beacon2 that have no counterpart in the original Beacon User Guide.

| Feature | Description |
|---------|-------------|
| **System tier** | Separate system admin login, tenant CRUD, set-temp-password — manages multiple u3a instances from a single dashboard |
| **Auto-migration** | `migrateTenantSchemas()` re-runs idempotent DDL on every startup; no manual schema management |
| **JWT + refresh token auth** | Access token (15 min, in-memory only) + refresh token (30 days, httpOnly cookie); bcrypt 12 rounds (replaces Beacon's session-based auth) |
| **SiteWorks integration** | Tenant-wide toggle hides group scheduling/venue fields when SiteWorks manages events |
| **Open Meetings** | Calendar events not tied to any group; dedicated page with recurrence support |
| **Membership Payment Method Defaults** | Per-type default account and payment method; auto-populates member editor and renewals |
| **Refund system** | Per-account enable; dedicated refund form; reciprocal linking; statement netting; ledger column |
| **Credit batches** | Group incoming transactions into batches; appear as single rows in reconciliation |
| **Pending transactions** | Per-account config (disabled/optional/by_type); excluded from running balance and statements |
| **Gift Aid log** | Date-filtered view of Gift Aid consent given/withdrawn; member filter |
| **Validate member data** | Comprehensive data quality tool checking all members for issues; inline fix |
| **Context-sensitive help** | HelpWidget with Zendesk integration; route-mapped help links |
| **CI/CD** | GitHub Actions runs backend + frontend tests on every push; Playwright E2E against staging |
| **Data restore from Beacon format** | Full restore supports both Beacon2 and original Beacon data formats |

---

## Summary

### Coverage overview

| Status | Count | Description |
|--------|-------|-------------|
| **Built** | 244 | Feature broadly matches UG description |
| **Partial** | 12 | Feature exists but some aspects missing (PayPal stubs, system settings not yet wired, portal notification stubs) |
| **Not started** | 15 | Feature not yet implemented (public pages, guidance pages, networks/regions) |
| **Beacon2 extra** | 12 | New in Beacon2 (architecture, SiteWorks, open meetings, refunds, etc.) |

### Key gaps (Not started)

1. ~~Online renewals~~ — **Done** (v0.8.3)
2. ~~Public groups list and public calendar~~ — **Done** (v0.8.2)
3. ~~Joint membership online joining~~ — **Done** (v0.8.3)
4. **Real PayPal API integration** (docs 7.9, 9.8) — stub functions only
5. **System-wide hide address from group leaders** (doc 4.2.4b) — global setting not implemented
6. **Networks and Regions** (doc 12) — out of scope for current build
7. **Guidance pages** (docs 5, 6, 6.1.5, 7.10.3, 7.10.4, 8.1a, 8.9, 9.5.1) — no dedicated guidance/tips pages

### Key differences from Beacon

1. **Login**: Both use username-based login; Beacon2 adds email fallback for legacy users
2. **Hide address**: Beacon2 has both per-member `hide_contact` checkbox AND per-group `show_addresses` toggle (but `show_addresses` is stored, not yet wired into visibility logic — see KNOWN-ISSUES.md)
3. **Financial year**: Configurable via `year_start_month` / `year_start_day` (default January = calendar year); same concept as Beacon
4. **Architecture**: Both are multi-tenant; Beacon2 uses schema-per-tenant PostgreSQL; the UG describes a single tenant's view
5. **Auth**: JWT + refresh token (vs Beacon's session-based auth)
6. **Cookie consent**: Both have cookie consent dialogs; Beacon2's is GDPR-compliant with essential vs optional distinction

---

> **Maintenance:** Update this document whenever Beacon2 features are added, changed,
> or when a deeper comparison of a specific section is performed. Include the date
> of the update at the top of the file.
