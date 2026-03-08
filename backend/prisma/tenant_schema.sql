-- beacon2/backend/prisma/tenant_schema.sql
-- This SQL is executed for each new u3a tenant.
-- Replace :schema with the tenant slug, e.g. u3a_oxfordshire
--
-- Usage: called by src/seed/createTenant.js

-- Create the schema
CREATE SCHEMA IF NOT EXISTS :schema;

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE :schema.users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                        -- NULL = no login access
  name          TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login    TIMESTAMPTZ,
  member_id     TEXT                         -- future: link to members table
);

-- ─────────────────────────────────────────────
-- ROLES
-- ─────────────────────────────────────────────
CREATE TABLE :schema.roles (
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
CREATE TABLE :schema.user_roles (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES :schema.users(id) ON DELETE CASCADE,
  role_id     TEXT NOT NULL REFERENCES :schema.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

-- ─────────────────────────────────────────────
-- PRIVILEGE RESOURCES  (system-seeded, not editable per tenant)
-- ─────────────────────────────────────────────
CREATE TABLE :schema.privilege_resources (
  id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code    TEXT NOT NULL UNIQUE,             -- e.g. "finance:transactions"
  label   TEXT NOT NULL,                   -- e.g. "Finance: transactions"
  actions TEXT[] NOT NULL                  -- possible actions e.g. {view,create,change,delete}
);

-- ─────────────────────────────────────────────
-- ROLE ↔ PRIVILEGE ASSIGNMENTS
-- ─────────────────────────────────────────────
CREATE TABLE :schema.role_privileges (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  role_id     TEXT NOT NULL REFERENCES :schema.roles(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES :schema.privilege_resources(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,               -- "view"|"create"|"change"|"delete"|"download" etc.
  UNIQUE (role_id, resource_id, action)
);

-- ─────────────────────────────────────────────
-- REFRESH TOKENS
-- ─────────────────────────────────────────────
CREATE TABLE :schema.refresh_tokens (
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
CREATE TABLE :schema.member_classes (
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
-- MEMBER STATUSES
-- ─────────────────────────────────────────────
CREATE TABLE :schema.member_statuses (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL UNIQUE,
  locked     BOOLEAN NOT NULL DEFAULT false,  -- locked system statuses cannot be edited/deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- MEMBERSHIP NUMBER SEQUENCE
-- ─────────────────────────────────────────────
CREATE SEQUENCE :schema.membership_number_seq START 1;

-- ─────────────────────────────────────────────
-- ADDRESSES  (may be shared between two members at the same address)
-- ─────────────────────────────────────────────
CREATE TABLE :schema.addresses (
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
CREATE TABLE :schema.members (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  membership_number INTEGER NOT NULL UNIQUE
                    DEFAULT nextval('membership_number_seq'),
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
CREATE TABLE :schema.faculties (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- GROUPS
-- ─────────────────────────────────────────────
CREATE TABLE :schema.groups (
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
-- GROUP MEMBERS
-- ─────────────────────────────────────────────
CREATE TABLE :schema.group_members (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_id      TEXT NOT NULL REFERENCES :schema.groups(id) ON DELETE CASCADE,
  member_id     TEXT NOT NULL REFERENCES :schema.members(id) ON DELETE CASCADE,
  is_leader     BOOLEAN NOT NULL DEFAULT false,
  waiting_since DATE,                      -- non-null = member is on waiting list
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, member_id)
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX ON :schema.user_roles (user_id);
CREATE INDEX ON :schema.user_roles (role_id);
CREATE INDEX ON :schema.role_privileges (role_id);
CREATE INDEX ON :schema.refresh_tokens (user_id);
CREATE INDEX ON :schema.refresh_tokens (token_hash);
CREATE INDEX ON :schema.members (surname, forenames);
CREATE INDEX ON :schema.members (status_id);
CREATE INDEX ON :schema.members (class_id);
CREATE INDEX ON :schema.members (address_id);
CREATE INDEX ON :schema.groups (faculty_id);
CREATE INDEX ON :schema.groups (status);
CREATE INDEX ON :schema.group_members (group_id);
CREATE INDEX ON :schema.group_members (member_id);
