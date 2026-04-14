# Beacon2 Data Model

Generated 2026-04-14. Sources: `backend/prisma/schema.prisma` (public schema)
and `backend/prisma/tenant_schema.sql` (per-tenant schema).

---

## Architecture

Beacon2 uses a **multi-tenant PostgreSQL** design with schema-level isolation:

- **Public schema** — system-level tables shared across all tenants
- **Per-tenant schemas** (`u3a_<slug>`) — one complete set of tables per u3a

---

## Public Schema (system-level)

```
sys_tenants                sys_admins                 sys_settings
+--------------+           +--------------+           +--------------+
| id       PK  |           | id       PK  |           | id       PK  |
| name         |           | email    UQ  |           |   ("singleton")|
| slug     UQ  |           | password_hash|           | system_message |
| active       |           | name         |           | created_at   |
| created_at   |           | active       |           | updated_at   |
| updated_at   |           | created_at   |           +--------------+
+--------------+           | updated_at   |
                           | last_login   |
                           +--------------+
```

---

## Per-Tenant Schema

### Access Control

```
users                          roles                      privilege_resources
+-------------------+          +-------------------+      +-------------------+
| id            PK  |          | id            PK  |      | id            PK  |
| email         UQ  |          | name              |      | code          UQ  |
| username      UQ  |          | is_committee      |      | label             |
| password_hash     |          | notes             |      | actions      TEXT[]|
| name              |          | created_at        |      +-------------------+
| active            |          | updated_at        |
| is_site_admin     |          +-------------------+
| security_question |                  |
| security_answer_  |                  |
|   hash            |        user_roles              role_privileges
| must_change_      |        +----------------+      +-------------------+
|   password        |        | id         PK  |      | id            PK  |
| member_id    FK-->|--+     | user_id   FK-->|----->| role_id      FK-->|---->roles
| created_at        |  |     | role_id   FK-->|----->| resource_id  FK-->|---->privilege_resources
| updated_at        |  |     | assigned_at    |      | action            |
| last_login        |  |     | UQ(user,role)  |      | UQ(role,res,act)  |
+-------------------+  |     +----------------+      +-------------------+
                       |
                       |     refresh_tokens
                       |     +-------------------+
                       |     | id            PK  |
                       |     | user_id      FK-->|---->users
                       |     | token_hash    UQ  |
                       |     | expires_at        |
                       |     | revoked           |
                       |     | created_at        |
                       |     +-------------------+
                       |
                       v
```

### Members & Addresses

```
addresses                        members
+-------------------+            +-------------------------+
| id            PK  |<---+      | id                 PK   |
| house_no          |    |      | membership_number  UQ   |  (auto-seq)
| street            |    |      | title                   |
| add_line1         |    +------| address_id         FK   |
| add_line2         |           | forenames               |
| town              |           | surname                 |
| county            |           | known_as                |
| postcode          |           | initials                |
| telephone         |           | suffix                  |
| created_at        |           | email                   |
| updated_at        |           | mobile                  |
+-------------------+           | status_id         FK--->|---->member_statuses
                                | class_id          FK--->|---->member_classes
                                | joined_on          DATE |
                                | next_renewal       DATE |
                                | gift_aid_from      DATE |
                                | home_u3a                |
                                | notes                   |
                                | hide_contact            |
                                | partner_id        FK--->|---->members (self)
                                | custom_field_1..4       |
                                | emergency_contact       |
                                | photo_data         TEXT |
                                | photo_mime_type         |
                                | card_printed            |
                                | portal_email            |
                                | portal_password_hash    |
                                | portal_email_verified   |
                                | portal_verification_*   |
                                | portal_reset_*          |
                                | payment_token           |
                                | created_at              |
                                | updated_at              |
                                +-------------------------+

member_statuses                  member_classes
+-------------------+            +-------------------+
| id            PK  |            | id            PK  |
| name          UQ  |            | name              |
| locked            |            | current           |
| created_at        |            | explanation       |
| updated_at        |            | is_joint          |
+-------------------+            | is_associate      |
                                 | show_online       |
                                 | fee               |
                                 | gift_aid_fee      |
                                 | locked            |
                                 | created_at        |
                                 | updated_at        |
                                 +-------------------+
                                         |
                                 class_monthly_fees
                                 +-------------------+
                                 | id            PK  |
                                 | class_id     FK-->|---->member_classes
                                 | month_index  1-13 |
                                 | fee               |
                                 | gift_aid_fee      |
                                 | UQ(class,month)   |
                                 +-------------------+
```

### Groups & Events

```
faculties                        groups
+-------------------+            +-------------------------+
| id            PK  |<----------| faculty_id         FK   |
| name          UQ  |           | id                 PK   |
| created_at        |           | name                    |
| updated_at        |           | short_name   (max 10)   |
+-------------------+           | type  ('group'|'team')  |
                                | status  (active/inactive)|
                                | when_text               |
                                | start_time         TIME |
                                | end_time           TIME |
                                | venue          (legacy) |
                                | venue_id        FK---->-|---->venues
                                | enquiries              |
                                | max_members            |
                                | allow_online_join      |
                                | enable_waiting_list    |
                                | notify_leader          |
                                | display_waiting_list   |
                                | information            |
                                | notes                  |
                                | show_addresses         |
                                | created_at             |
                                | updated_at             |
                                +-------------------------+
                                    |              |
          group_members             |     event_types
          +-------------------+     |     +-------------------+
          | id            PK  |     |     | id            PK  |
          | group_id     FK-->|-----+     | name          UQ  |
          | member_id    FK-->|---->members| description       |
          | is_leader         |           | is_default        |
          | waiting_since DATE|           | created_at        |
          | created_at        |           | updated_at        |
          | UQ(group,member)  |           +-------------------+
          +-------------------+                  |
                                          group_events
          group_ledger_entries            +---------------------+
          +-------------------+           | id              PK  |
          | id            PK  |           | group_id       FK-->|---->groups (nullable)
          | group_id     FK-->|---->groups | event_type_id  FK-->|---->event_types
          | entry_date   DATE |           | event_date     DATE |
          | payee             |           | start_time     TIME |
          | detail            |           | end_time       TIME |
          | money_in          |           | venue_id      FK--->|---->venues
          | money_out         |           | contact             |
          | created_at        |           | details             |
          | updated_at        |           | topic               |
          +-------------------+           | is_private          |
                                          | created_at          |
          event_members                   | updated_at          |
          +-------------------+           +---------------------+
          | id            PK  |
          | event_id     FK-->|---->group_events
          | member_id    FK-->|---->members
          | is_organiser      |
          | notes             |
          | created_at        |
          | UQ(event,member)  |
          +-------------------+
          | entry_date   DATE |
          | payee             |   venues
          | detail            |   +-------------------+
          | money_in          |   | id            PK  |
          | money_out         |   | name              |
          | created_at        |   | address           |
          | updated_at        |   | postcode          |
          +-------------------+   | telephone, email  |
                                  | website           |
                                  | contact           |
                                  | notes             |
                                  | private_address   |
                                  | accessible        |
                                  | created_at        |
                                  | updated_at        |
                                  +-------------------+
```

### Finance

```
finance_accounts                  finance_categories
+-------------------------+       +-------------------+
| id                 PK   |       | id            PK  |
| name                    |       | name              |
| active                  |       | active            |
| locked                  |       | locked            |
| sort_order              |       | sort_order        |
| pending_config          |       | created_at        |
| pending_types     TEXT[]|       | updated_at        |
| enable_refunds          |       +-------------------+
| balance_brought_forward |               |
| created_at              |               |
| updated_at              |               |
+-------------------------+               |
          |                               |
          |     transactions              |    transaction_categories
          |     +-------------------------+    +-------------------+
          +----<| account_id         FK   |    | id            PK  |
                | id                 PK   |--->| transaction_id FK |
                | transaction_number UQ   |    | category_id  FK-->|---->finance_categories
                | date              DATE  |    | amount            |
                | type        (in/out)    |    | UQ(txn,cat)       |
                | from_to                 |    +-------------------+
                | amount                  |
                | payment_method          |
                | payment_ref             |
                | detail                  |
                | remarks                 |
                | member_id_1       FK--->|---->members
                | member_id_2       FK--->|---->members
                | group_id          FK--->|---->groups
                | event_id          FK--->|---->group_events
                | cleared_at        DATE  |
                | transfer_id             |  (pairs transfer txns)
                | pending                 |
                | gift_aid_amount         |
                | gift_aid_claimed_at DATE|
                | gift_aid_amount_2       |  (Gift Aid member 2)
                | gift_aid_claimed_at_2   |
                | batch_id          FK--->|---->credit_batches
                | refund_of_id      FK--->|---->transactions (self)
                | refunded_by_id    FK--->|---->transactions (self)
                | created_at              |
                | updated_at              |
                +-------------------------+

credit_batches                    payment_method_defaults
+-------------------+             +-------------------+
| id            PK  |             | payment_method PK |
| batch_ref         |             | account_id        |
| account_id   FK-->|---->finance | updated_at        |
| description       |  _accounts  +-------------------+
| batch_date   DATE |
| created_at        |
| UQ(account,ref)   |
+-------------------+
```

### Polls, Communications & Audit

```
polls                            poll_members
+-------------------+            +-------------------+
| id            PK  |<----------| poll_id       FK   |
| name              |           | member_id     FK-->|---->members
| description       |           | PK(poll,member)    |
| member_can_set    |           +-------------------+
| created_at        |
| updated_at        |
+-------------------+

email_batches                    email_recipients
+-------------------+            +-------------------+
| id            PK  |<----------| batch_id      FK   |
| user_id           |           | id            PK   |
| subject           |           | member_id          |
| body              |           | email_address      |
| from_email        |           | display_name       |
| reply_to          |           | status             |
| recipient_count   |           | sendgrid_message_id|
| sent_at           |           | error_message      |
+-------------------+           | updated_at         |
                                +-------------------+

standard_messages                standard_letters
+-------------------+            +-------------------+
| id            PK  |            | id            PK  |
| name          UQ  |            | name          UQ  |
| subject           |            | body              |
| body              |            | created_at        |
| created_at        |            | updated_at        |
| updated_at        |            +-------------------+
+-------------------+

system_messages                  offices
+-------------------+            +-------------------+
| id            PK  |            | id            PK  |
| name              |            | name              |
| subject           |            | member_id    FK-->|---->members
| body              |            | office_email      |
| updated_at        |            | notify_online_join|
+-------------------+            | created_at        |
  (seeded IDs:                   | updated_at        |
   online_join_confirm,          +-------------------+
   online_join_officer_notify,
   gift_aid_payment,
   online_renewal_confirm,
   card_replacement_confirm,
   portal_details_updated,
   home_page_notice,
   online_join_payment_link)

audit_log
+-------------------+
| id            PK  |
| user_id           |
| user_name         |
| action            |
| entity_type       |
| entity_id         |
| entity_name       |
| detail            |
| created_at        |
+-------------------+
```

### Tenant Settings (singleton)

```
tenant_settings
+------------------------------------+
| id  PK  ("singleton")             |
|                                    |
| -- Appearance                      |
| card_colour                        |
| email_cards                        |
|                                    |
| -- Contact                         |
| public_phone                       |
| public_email                       |
| home_page                          |
|                                    |
| -- Email triggers                  |
| online_join_email                  |
| online_renew_email                 |
|                                    |
| -- Membership year & fees          |
| year_start_month                   |
| year_start_day                     |
| fee_variation                      |
| extended_membership_month          |
| advance_renewals_weeks             |
| grace_lapse_weeks                  |
| deletion_years                     |
| default_payment_method             |
|                                    |
| -- Gift Aid                        |
| gift_aid_enabled                   |
| gift_aid_online_renewals           |
|                                    |
| -- Defaults                        |
| default_town                       |
| default_county                     |
| default_std_code                   |
|                                    |
| -- PayPal                          |
| paypal_email                       |
| paypal_cancel_url                  |
|                                    |
| -- Features                        |
| shared_address_warning             |
| online_joining_enabled             |
| privacy_policy_url                 |
| group_bf_enabled                   |
| siteworks_activated                |
|                                    |
| -- Custom field labels             |
| custom_field_label_1..4            |
|                                    |
| -- Public links config (JSONB)     |
| portal_config                      |
| group_info_config                  |
| calendar_config                    |
|                                    |
| -- Feature toggles (JSONB)        |
| feature_config                     |
|                                    |
| updated_at                         |
+------------------------------------+
```

---

## Key Relationships Summary

| From | To | Cardinality | Via |
|------|----|-------------|-----|
| users | roles | M:N | user_roles |
| roles | privilege_resources | M:N (per action) | role_privileges |
| users | members | 1:1 optional | users.member_id |
| members | addresses | N:1 | members.address_id |
| members | members | 1:1 optional | members.partner_id (self-ref) |
| members | member_statuses | N:1 | members.status_id |
| members | member_classes | N:1 | members.class_id |
| members | groups | M:N | group_members |
| members | polls | M:N | poll_members |
| members | offices | 1:N | offices.member_id |
| groups | faculties | N:1 | groups.faculty_id |
| groups | venues | N:1 | groups.venue_id |
| group_events | groups | N:1 (nullable) | group_events.group_id |
| group_events | event_types | N:1 (nullable) | group_events.event_type_id |
| group_events | venues | N:1 | group_events.venue_id |
| event_members | group_events | N:1 | event_members.event_id |
| event_members | members | N:1 | event_members.member_id |
| transactions | finance_accounts | N:1 | transactions.account_id |
| transactions | finance_categories | M:N | transaction_categories |
| transactions | members | N:1 (x2) | member_id_1, member_id_2 |
| transactions | groups | N:1 | transactions.group_id |
| transactions | group_events | N:1 (nullable) | transactions.event_id |
| transactions | credit_batches | N:1 | transactions.batch_id |
| transactions | transactions | 1:1 | refund_of_id / refunded_by_id |
| member_classes | class_monthly_fees | 1:N | class_monthly_fees.class_id |
| email_batches | email_recipients | 1:N | email_recipients.batch_id |
