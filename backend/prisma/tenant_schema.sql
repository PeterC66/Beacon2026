-- beacon2/backend/prisma/tenant_schema.sql
-- This SQL is executed for each new u3a tenant AND re-run against every
-- existing tenant on startup (to pick up new tables).
-- All statements are idempotent: CREATE TABLE IF NOT EXISTS, etc.
-- Replace :schema with the tenant slug, e.g. u3a_oxfordshire
--
-- Usage: called by src/seed/createTenant.js  and  src/utils/migrate.js

-- Create the schema
CREATE SCHEMA IF NOT EXISTS :schema;

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT,                        -- login username (lowercase, no spaces)
  password_hash TEXT,                        -- NULL = no login access
  name          TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login    TIMESTAMPTZ,
  member_id     TEXT                         -- future: link to members table
);

-- Add username to existing tenants (idempotent)
ALTER TABLE :schema.users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS :schema_idx_users_username ON :schema.users (username) WHERE username IS NOT NULL;

-- Site administrator flag (exactly one user per tenant)
ALTER TABLE :schema.users ADD COLUMN IF NOT EXISTS is_site_admin BOOLEAN NOT NULL DEFAULT false;

-- member_id FK (added after members table is created — see bottom of file)

-- ─────────────────────────────────────────────
-- ROLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.roles (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         TEXT NOT NULL,
  is_committee BOOLEAN NOT NULL DEFAULT false,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- USER ↔ ROLE ASSIGNMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.user_roles (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES :schema.users(id) ON DELETE CASCADE,
  role_id     TEXT NOT NULL REFERENCES :schema.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

-- ─────────────────────────────────────────────
-- PRIVILEGE RESOURCES  (system-seeded, not editable per tenant)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.privilege_resources (
  id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code    TEXT NOT NULL UNIQUE,             -- e.g. "finance:transactions"
  label   TEXT NOT NULL,                   -- e.g. "Finance: transactions"
  actions TEXT[] NOT NULL                  -- possible actions e.g. {view,create,change,delete}
);

-- ─────────────────────────────────────────────
-- ROLE ↔ PRIVILEGE ASSIGNMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.role_privileges (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  role_id     TEXT NOT NULL REFERENCES :schema.roles(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES :schema.privilege_resources(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,               -- "view"|"create"|"change"|"delete"|"download" etc.
  UNIQUE (role_id, resource_id, action)
);

-- ─────────────────────────────────────────────
-- REFRESH TOKENS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.refresh_tokens (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES :schema.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- MEMBERSHIP CLASSES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.member_classes (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         TEXT NOT NULL,
  current      BOOLEAN NOT NULL DEFAULT true,   -- may be used for new memberships
  explanation  TEXT,                            -- shown when joining online
  is_joint     BOOLEAN NOT NULL DEFAULT false,  -- 1 of 2 people at same address (HMRC family rule)
  is_associate BOOLEAN NOT NULL DEFAULT false,  -- full member of another u3a
  show_online  BOOLEAN NOT NULL DEFAULT false,  -- show to members joining online
  fee          NUMERIC(8,2),                    -- fee per person per year
  gift_aid_fee NUMERIC(8,2),                    -- gift aid eligible portion (≤ fee)
  locked       BOOLEAN NOT NULL DEFAULT false,  -- locked against deletion (e.g. Individual)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- CLASS MONTHLY FEES (used when fee_variation = 'varies_by_month')
-- month_index 1-12 = Jan-Dec, 13 = Renewals
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.class_monthly_fees (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id     TEXT NOT NULL REFERENCES :schema.member_classes(id) ON DELETE CASCADE,
  month_index  INTEGER NOT NULL CHECK (month_index BETWEEN 1 AND 13),
  fee          NUMERIC(8,2),
  gift_aid_fee NUMERIC(8,2),
  UNIQUE (class_id, month_index)
);
CREATE INDEX IF NOT EXISTS :schema_idx_class_monthly_fees_class ON :schema.class_monthly_fees (class_id);

-- ─────────────────────────────────────────────
-- MEMBER STATUSES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.member_statuses (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL UNIQUE,
  locked     BOOLEAN NOT NULL DEFAULT false,  -- locked system statuses cannot be edited/deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- MEMBERSHIP NUMBER SEQUENCE
-- ─────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS :schema.membership_number_seq START 1;

-- ─────────────────────────────────────────────
-- ADDRESSES  (may be shared between two members at the same address)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.addresses (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  house_no   TEXT,                -- house/flat number or name
  street     TEXT,
  add_line1  TEXT,                -- district / village (used for sorting)
  add_line2  TEXT,
  town       TEXT,
  county     TEXT,
  postcode   TEXT,
  telephone  TEXT,                -- home landline — shared between partners
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- MEMBERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.members (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  membership_number INTEGER NOT NULL UNIQUE
                    DEFAULT nextval(':schema.membership_number_seq'),
  title             TEXT,                              -- Mr, Mrs, Ms, Dr etc.
  forenames         TEXT NOT NULL,
  surname           TEXT NOT NULL,
  known_as          TEXT,                              -- preferred first name
  initials          TEXT,                              -- auto-derived from forenames
  suffix            TEXT,                              -- MBE, OBE etc.
  email             TEXT,
  mobile            TEXT,
  address_id        TEXT REFERENCES :schema.addresses(id),
  status_id         TEXT REFERENCES :schema.member_statuses(id),
  class_id          TEXT REFERENCES :schema.member_classes(id),
  joined_on         DATE,
  next_renewal      DATE,
  gift_aid_from     DATE,
  home_u3a          TEXT,                              -- for associate-class members
  notes             TEXT,
  hide_contact      BOOLEAN NOT NULL DEFAULT false,    -- hide from group leaders
  partner_id        TEXT REFERENCES :schema.members(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- FACULTIES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.faculties (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- GROUPS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.groups (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                 TEXT NOT NULL,
  faculty_id           TEXT REFERENCES :schema.faculties(id),
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'inactive')),
  when_text            TEXT,               -- e.g. "2nd Thursday at 2:00pm"
  start_time           TIME,               -- default start time for events
  end_time             TIME,               -- default end time for events
  venue                TEXT,
  enquiries            TEXT,               -- public contact info for enquirers
  max_members          INTEGER,
  allow_online_join    BOOLEAN NOT NULL DEFAULT false,
  enable_waiting_list  BOOLEAN NOT NULL DEFAULT false,
  notify_leader        BOOLEAN NOT NULL DEFAULT false,
  display_waiting_list BOOLEAN NOT NULL DEFAULT false,
  information          TEXT,               -- may be shown publicly
  notes                TEXT,               -- private notes
  show_addresses       BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- VENUES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.venues (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             TEXT NOT NULL,
  address1         TEXT,
  address2         TEXT,
  town             TEXT,
  county           TEXT,
  postcode         TEXT,
  telephone        TEXT,
  email            TEXT,
  website          TEXT,
  notes            TEXT,
  private_address  BOOLEAN NOT NULL DEFAULT false,
  accessible       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS :schema_idx_venues_name ON :schema.venues (name);

-- Add venue_id FK to groups (replaces free-text venue field in the UI)
ALTER TABLE :schema.groups ADD COLUMN IF NOT EXISTS venue_id TEXT REFERENCES :schema.venues(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- GROUP MEMBERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.group_members (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_id      TEXT NOT NULL REFERENCES :schema.groups(id) ON DELETE CASCADE,
  member_id     TEXT NOT NULL REFERENCES :schema.members(id) ON DELETE CASCADE,
  is_leader     BOOLEAN NOT NULL DEFAULT false,
  waiting_since DATE,                      -- non-null = member is on waiting list
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, member_id)
);

-- ─────────────────────────────────────────────
-- GROUP EVENTS  (schedule)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.group_events (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_id   TEXT REFERENCES :schema.groups(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time   TIME,
  venue_id   TEXT REFERENCES :schema.venues(id) ON DELETE SET NULL,
  contact    TEXT,
  details    TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow open meetings (group_id = NULL)
ALTER TABLE :schema.group_events ALTER COLUMN group_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS :schema_idx_group_events_group ON :schema.group_events (group_id);
CREATE INDEX IF NOT EXISTS :schema_idx_group_events_date  ON :schema.group_events (event_date);

ALTER TABLE :schema.group_events ADD COLUMN IF NOT EXISTS topic TEXT;

-- ─────────────────────────────────────────────
-- GROUP LEDGER ENTRIES  (doc 5.5 — separate from Finance Ledger)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.group_ledger_entries (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_id    TEXT NOT NULL REFERENCES :schema.groups(id) ON DELETE CASCADE,
  entry_date  DATE NOT NULL,
  payee       TEXT,
  detail      TEXT,
  money_in    NUMERIC(10,2),
  money_out   NUMERIC(10,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS :schema_idx_gle_group ON :schema.group_ledger_entries (group_id);
CREATE INDEX IF NOT EXISTS :schema_idx_gle_date  ON :schema.group_ledger_entries (entry_date);

-- ─────────────────────────────────────────────
-- TENANT SETTINGS  (single-row table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.tenant_settings (
  id                        TEXT PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  card_colour               TEXT NOT NULL DEFAULT '#0066cc',
  email_cards               BOOLEAN NOT NULL DEFAULT false,
  public_phone              TEXT,
  public_email              TEXT,
  home_page                 TEXT,
  online_join_email         TEXT,
  online_renew_email        TEXT,
  fee_variation             TEXT NOT NULL DEFAULT 'same_all_year'
                              CHECK (fee_variation IN ('same_all_year', 'varies_by_month')),
  extended_membership_month INTEGER,           -- 1-12, or NULL = not enabled
  advance_renewals_weeks    INTEGER NOT NULL DEFAULT 4,
  grace_lapse_weeks         INTEGER NOT NULL DEFAULT 4,
  deletion_years            INTEGER NOT NULL DEFAULT 7
                              CHECK (deletion_years >= 2 AND deletion_years <= 7),
  default_payment_method    TEXT NOT NULL DEFAULT 'Cheque',
  gift_aid_enabled          BOOLEAN NOT NULL DEFAULT false,
  gift_aid_online_renewals  BOOLEAN NOT NULL DEFAULT false,
  default_town              TEXT,
  default_county            TEXT,
  default_std_code          TEXT,
  paypal_email              TEXT,
  paypal_cancel_url         TEXT,
  shared_address_warning    BOOLEAN NOT NULL DEFAULT false,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add membership year start columns idempotently
ALTER TABLE :schema.tenant_settings ADD COLUMN IF NOT EXISTS year_start_month INTEGER NOT NULL DEFAULT 1;
ALTER TABLE :schema.tenant_settings ADD COLUMN IF NOT EXISTS year_start_day   INTEGER NOT NULL DEFAULT 1;

-- Ensure every tenant has exactly one settings row
INSERT INTO :schema.tenant_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- FINANCE ACCOUNTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.finance_accounts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  locked          BOOLEAN NOT NULL DEFAULT false,   -- locked accounts cannot be deleted/renamed
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- Configure Account settings (doc 8.6 sections c–e)
  pending_config  TEXT NOT NULL DEFAULT 'disabled',  -- 'disabled' | 'optional' | 'by_type'
  pending_types   TEXT[] NOT NULL DEFAULT '{}',       -- payment types auto-pending when by_type
  enable_refunds  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Backfill configure columns on existing tenants (DEFAULT handles all rows, safe to re-run)
ALTER TABLE :schema.finance_accounts ADD COLUMN IF NOT EXISTS pending_config TEXT NOT NULL DEFAULT 'disabled';
ALTER TABLE :schema.finance_accounts ADD COLUMN IF NOT EXISTS pending_types  TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE :schema.finance_accounts ADD COLUMN IF NOT EXISTS enable_refunds BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────
-- PAYMENT METHOD DEFAULTS (doc 8.6c)
-- Stores default account per payment method and the overall default method.
-- The special key '_default_method' stores the default membership payment method
-- in the account_id column (abused as a plain text value).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.payment_method_defaults (
  payment_method TEXT PRIMARY KEY,
  account_id     TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- FINANCE CATEGORIES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.finance_categories (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  locked     BOOLEAN NOT NULL DEFAULT false,   -- locked categories cannot be deleted/renamed
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TRANSACTION NUMBER SEQUENCE
-- ─────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS :schema.transaction_number_seq START 1;

-- ─────────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.transactions (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  transaction_number INTEGER NOT NULL UNIQUE
                     DEFAULT nextval(':schema.transaction_number_seq'),
  account_id         TEXT NOT NULL REFERENCES :schema.finance_accounts(id),
  date               DATE NOT NULL DEFAULT CURRENT_DATE,
  type               TEXT NOT NULL CHECK (type IN ('in', 'out')),
  from_to            TEXT,                     -- person/body received from or paid to
  amount             NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  payment_method     TEXT,
  payment_ref        TEXT,                     -- cheque number or other reference
  detail             TEXT,                     -- concise description shown in ledger
  remarks            TEXT,                     -- additional notes
  member_id_1        TEXT REFERENCES :schema.members(id) ON DELETE SET NULL,
  member_id_2        TEXT REFERENCES :schema.members(id) ON DELETE SET NULL,
  group_id           TEXT REFERENCES :schema.groups(id) ON DELETE SET NULL,
  cleared_at         DATE,                     -- set by reconciliation
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relax amount constraint to allow zero-amount transactions (e.g. free memberships from Beacon)
ALTER TABLE :schema.transactions DROP CONSTRAINT IF EXISTS transactions_amount_check;
ALTER TABLE :schema.transactions ADD CONSTRAINT transactions_amount_check CHECK (amount >= 0);

-- Transfer money: links paired transactions (both share the same transfer_id UUID)
ALTER TABLE :schema.transactions ADD COLUMN IF NOT EXISTS transfer_id TEXT;

-- Pending transactions: promised but not yet received (e.g. awaited BACS)
ALTER TABLE :schema.transactions ADD COLUMN IF NOT EXISTS pending BOOLEAN NOT NULL DEFAULT false;

-- Gift Aid: eligible amount stored at transaction time, and claimed date
ALTER TABLE :schema.transactions ADD COLUMN IF NOT EXISTS gift_aid_amount NUMERIC(10,2);
ALTER TABLE :schema.transactions ADD COLUMN IF NOT EXISTS gift_aid_claimed_at DATE;

-- Balance brought forward per account (balance before Beacon2 started tracking)
ALTER TABLE :schema.finance_accounts ADD COLUMN IF NOT EXISTS balance_brought_forward NUMERIC(10,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────
-- CREDIT BATCHES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.credit_batches (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  batch_ref   TEXT NOT NULL,
  account_id  TEXT NOT NULL REFERENCES :schema.finance_accounts(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, batch_ref)
);

-- Link transactions to a credit batch
ALTER TABLE :schema.transactions ADD COLUMN IF NOT EXISTS batch_id TEXT
  REFERENCES :schema.credit_batches(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- TRANSACTION CATEGORY SPLITS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.transaction_categories (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  transaction_id TEXT NOT NULL REFERENCES :schema.transactions(id) ON DELETE CASCADE,
  category_id    TEXT NOT NULL REFERENCES :schema.finance_categories(id),
  amount         NUMERIC(10,2) NOT NULL,
  UNIQUE (transaction_id, category_id)
);

-- ─────────────────────────────────────────────
-- INDEXES  (named so IF NOT EXISTS works)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS :schema_idx_user_roles_user_id   ON :schema.user_roles (user_id);
CREATE INDEX IF NOT EXISTS :schema_idx_user_roles_role_id   ON :schema.user_roles (role_id);
CREATE INDEX IF NOT EXISTS :schema_idx_role_privs_role_id   ON :schema.role_privileges (role_id);
CREATE INDEX IF NOT EXISTS :schema_idx_refresh_tokens_user  ON :schema.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS :schema_idx_refresh_tokens_hash  ON :schema.refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS :schema_idx_members_name         ON :schema.members (surname, forenames);
CREATE INDEX IF NOT EXISTS :schema_idx_members_status       ON :schema.members (status_id);
CREATE INDEX IF NOT EXISTS :schema_idx_members_class        ON :schema.members (class_id);
CREATE INDEX IF NOT EXISTS :schema_idx_members_address      ON :schema.members (address_id);
CREATE INDEX IF NOT EXISTS :schema_idx_groups_faculty       ON :schema.groups (faculty_id);
CREATE INDEX IF NOT EXISTS :schema_idx_groups_status        ON :schema.groups (status);
CREATE INDEX IF NOT EXISTS :schema_idx_group_members_group  ON :schema.group_members (group_id);
CREATE INDEX IF NOT EXISTS :schema_idx_group_members_member ON :schema.group_members (member_id);
CREATE INDEX IF NOT EXISTS :schema_idx_transactions_account ON :schema.transactions (account_id);
CREATE INDEX IF NOT EXISTS :schema_idx_transactions_date    ON :schema.transactions (date);
CREATE INDEX IF NOT EXISTS :schema_idx_transactions_group   ON :schema.transactions (group_id);
CREATE INDEX IF NOT EXISTS :schema_idx_txn_cats_txn         ON :schema.transaction_categories (transaction_id);
CREATE INDEX IF NOT EXISTS :schema_idx_txn_cats_cat         ON :schema.transaction_categories (category_id);

-- ─── Polls ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS :schema.polls (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  member_can_set BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS :schema.poll_members (
  poll_id   TEXT NOT NULL REFERENCES :schema.polls(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES :schema.members(id) ON DELETE CASCADE,
  PRIMARY KEY (poll_id, member_id)
);

CREATE INDEX IF NOT EXISTS :schema_idx_poll_members_poll   ON :schema.poll_members (poll_id);
CREATE INDEX IF NOT EXISTS :schema_idx_poll_members_member ON :schema.poll_members (member_id);

-- ─── Audit log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS :schema.audit_log (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT,
  user_name   TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  entity_name TEXT,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS :schema_idx_audit_log_created ON :schema.audit_log (created_at);

-- ─── Offices ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS :schema.offices (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name               TEXT NOT NULL,
  member_id          TEXT REFERENCES :schema.members(id) ON DELETE SET NULL,
  office_email       TEXT,
  notify_online_join BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS :schema_idx_offices_member ON :schema.offices (member_id);

-- ─── Security Q&A on users ────────────────────────────────────────────────

ALTER TABLE :schema.users ADD COLUMN IF NOT EXISTS security_question TEXT;
ALTER TABLE :schema.users ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;

-- ─── Email batches + recipients ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS :schema.email_batches (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  from_email      TEXT NOT NULL,
  reply_to        TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS :schema_idx_email_batches_user_id ON :schema.email_batches (user_id);
CREATE INDEX IF NOT EXISTS :schema_idx_email_batches_sent_at ON :schema.email_batches (sent_at DESC);

CREATE TABLE IF NOT EXISTS :schema.email_recipients (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  batch_id            TEXT NOT NULL REFERENCES :schema.email_batches(id) ON DELETE CASCADE,
  member_id           TEXT,
  email_address       TEXT NOT NULL,
  display_name        TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'Despatched',
  sendgrid_message_id TEXT,
  error_message       TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS :schema_idx_email_recipients_batch ON :schema.email_recipients (batch_id);

-- ─── Standard email message templates ────────────────────────────────────

CREATE TABLE IF NOT EXISTS :schema.standard_messages (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS :schema_idx_standard_messages_name ON :schema.standard_messages (name);

-- ─── System messages (pre-defined auto-sent email templates) ────────────
-- Separate from standard_messages which are user-created templates.
-- System messages have well-known IDs and are seeded on tenant creation.

CREATE TABLE IF NOT EXISTS :schema.system_messages (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default system messages (idempotent)
INSERT INTO :schema.system_messages (id, name, subject, body) VALUES
  ('online_join_confirm', 'Online Joining Confirmation',
   'Welcome to #U3ANAME',
   'Dear #FORENAME,\n\nThank you for joining #U3ANAME. Your membership number is #MEMNO.\n\nYour membership class is #MEMCLASS.\n\nIf you have any questions, please contact us.\n\nKind regards,\n#U3ANAME')
ON CONFLICT (id) DO NOTHING;

INSERT INTO :schema.system_messages (id, name, subject, body) VALUES
  ('online_join_officer_notify', 'Online Joining Officer Notification',
   'New online member: #FORENAME #SURNAME',
   'A new member has joined online:\n\nName: #TITLE #FORENAME #SURNAME\nMembership Number: #MEMNO\nClass: #MEMCLASS\nEmail: #EMAIL')
ON CONFLICT (id) DO NOTHING;

INSERT INTO :schema.system_messages (id, name, subject, body) VALUES
  ('gift_aid_payment', 'Gift Aid Payment Confirmation',
   'Gift Aid confirmation from #U3ANAME',
   'Dear #FORENAME,\n\nThank you for consenting to Gift Aid. We can confirm that your payment has been received and recorded.\n\nMembership Number: #MEMNO\nMembership Class: #MEMCLASS\n\nGift Aid allows #U3ANAME to reclaim tax on your membership subscription at no extra cost to you. Thank you for your support.\n\nKind regards,\n#U3ANAME')
ON CONFLICT (id) DO NOTHING;

INSERT INTO :schema.system_messages (id, name, subject, body) VALUES
  ('online_renewal_confirm', 'Online Renewal Confirmation',
   'Membership renewal confirmation from #U3ANAME',
   'Dear #FORENAME,\n\nThank you for renewing your membership of #U3ANAME.\n\nMembership Number: #MEMNO\nMembership Class: #MEMCLASS\n\nWe look forward to seeing you at our events and groups.\n\nKind regards,\n#U3ANAME')
ON CONFLICT (id) DO NOTHING;

INSERT INTO :schema.system_messages (id, name, subject, body) VALUES
  ('card_replacement_confirm', 'Membership Card Replacement Confirmation',
   'Replacement membership card from #U3ANAME',
   'Dear #FORENAME,\n\nYour request for a replacement membership card has been received.\n\nMembership Number: #MEMNO\nName: #TITLE #FORENAME #SURNAME\n\nYour new card will be sent to you in due course.\n\nKind regards,\n#U3ANAME')
ON CONFLICT (id) DO NOTHING;

INSERT INTO :schema.system_messages (id, name, subject, body) VALUES
  ('home_page_notice', 'Home Page Notice',
   '',
   'Welcome to #U3ANAME Beacon. Please check the calendar for upcoming events and activities.')
ON CONFLICT (id) DO NOTHING;

-- ─── Public Links settings on tenant_settings ──────────────────────────

ALTER TABLE :schema.tenant_settings ADD COLUMN IF NOT EXISTS online_joining_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE :schema.tenant_settings ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT;

-- ─── Portal auth columns on members ─────────────────────────────────────

ALTER TABLE :schema.members ADD COLUMN IF NOT EXISTS portal_email TEXT;
ALTER TABLE :schema.members ADD COLUMN IF NOT EXISTS portal_password_hash TEXT;
ALTER TABLE :schema.members ADD COLUMN IF NOT EXISTS portal_email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE :schema.members ADD COLUMN IF NOT EXISTS portal_verification_token TEXT;
ALTER TABLE :schema.members ADD COLUMN IF NOT EXISTS portal_verification_expires TIMESTAMPTZ;
ALTER TABLE :schema.members ADD COLUMN IF NOT EXISTS portal_reset_token TEXT;
ALTER TABLE :schema.members ADD COLUMN IF NOT EXISTS portal_reset_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS :schema_idx_members_portal_email ON :schema.members (portal_email) WHERE portal_email IS NOT NULL;

-- ─── Seed Applicant status (for online joining) ─────────────────────────

INSERT INTO :schema.member_statuses (name) VALUES ('Applicant')
ON CONFLICT (name) DO NOTHING;

-- ─── Membership card tracking ────────────────────────────────────────
ALTER TABLE :schema.members ADD COLUMN IF NOT EXISTS card_printed BOOLEAN NOT NULL DEFAULT false;

-- ─── Standard letter templates ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS :schema.standard_letters (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS :schema_idx_standard_letters_name ON :schema.standard_letters (name);

-- ─── Group Brought Forward setting ────────────────────────────────────
ALTER TABLE :schema.tenant_settings ADD COLUMN IF NOT EXISTS group_bf_enabled BOOLEAN NOT NULL DEFAULT false;

-- ─── Refund transaction linking (doc 7.10.7) ──────────────────────────
ALTER TABLE :schema.transactions ADD COLUMN IF NOT EXISTS refund_of_id  TEXT REFERENCES :schema.transactions(id);
ALTER TABLE :schema.transactions ADD COLUMN IF NOT EXISTS refunded_by_id TEXT REFERENCES :schema.transactions(id);

-- ─── Users → Members FK (doc 8.2) ──────────────────────────────────────
-- Activate the member_id column as a proper FK to members table.
-- Using CREATE INDEX pattern since ALTER TABLE ADD CONSTRAINT IF NOT EXISTS is PG 17+.
-- We put the FK inline in a helper table approach -- actually we just
-- rely on the migration runner's try/catch per statement.
ALTER TABLE :schema.users ADD CONSTRAINT users_member_id_fkey FOREIGN KEY (member_id) REFERENCES :schema.members(id) ON DELETE SET NULL
