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
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX ON :schema.user_roles (user_id);
CREATE INDEX ON :schema.user_roles (role_id);
CREATE INDEX ON :schema.role_privileges (role_id);
CREATE INDEX ON :schema.refresh_tokens (user_id);
CREATE INDEX ON :schema.refresh_tokens (token_hash);
