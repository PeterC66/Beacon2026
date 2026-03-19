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
  group_id   TEXT NOT NULL REFERENCES :schema.groups(id) ON DELETE CASCADE,
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
