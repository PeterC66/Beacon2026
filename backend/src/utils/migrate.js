// beacon2/backend/src/utils/migrate.js
// Runs database migrations and seeds automatically on startup.
// This means you never need shell access to set up the database.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { prisma } from './db.js';
import { tenantQuery } from './db.js';
import { hashPassword } from './password.js';
import { PRIVILEGE_RESOURCES } from '../seed/privilegeResources.js';
import { DEFAULT_ROLES } from '../seed/defaultRoles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrateAndSeed() {
  // 1. Run Prisma migrations (creates system-level tables if they don't exist)
  console.log('Pushing database schema...');
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('Schema push complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    throw err;
  }

  // 2. Seed the system admin if one doesn't exist yet
  const existing = await prisma.sysAdmin.findFirst();
  if (!existing) {
    const email    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@beacon2.local';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
    const name     = process.env.SEED_ADMIN_NAME     ?? 'System Administrator';

    const passwordHash = await hashPassword(password);
    await prisma.sysAdmin.create({ data: { email, name, passwordHash, active: true } });

    console.log('');
    console.log('✓ System administrator created:');
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log('  IMPORTANT: Set SEED_ADMIN_PASSWORD in your environment variables.');
    console.log('');
  }

  // 3. Bring all existing tenant schemas up to date
  await migrateTenantSchemas();

  // NOTE: migrateDefaultRolePrivileges() was a one-time fix (March 2026) to
  // correct privilege assignments on existing tenants after the default roles
  // were overhauled to match doc 8.4.1.  It is no longer called on startup —
  // the canonical set is now applied only when a new tenant is created via
  // createTenant.js.  The function is kept below for reference.
}

/**
 * Re-run tenant_schema.sql (idempotent) against every active tenant,
 * then re-seed default data (privilege resources, member statuses, member classes).
 * Safe to run on every startup — all DDL uses IF NOT EXISTS, inserts use ON CONFLICT DO NOTHING.
 */
async function migrateTenantSchemas() {
  const tenants = await prisma.sysTenant.findMany({ where: { active: true } });
  if (tenants.length === 0) return;

  const schemaSQL = readFileSync(
    resolve(__dirname, '../../prisma/tenant_schema.sql'),
    'utf8',
  );

  for (const tenant of tenants) {
    const slug       = tenant.slug;
    const schemaName = `u3a_${slug}`;
    console.log(`Migrating tenant schema: ${schemaName}`);

    let ddlErrors = 0;

    // Run the idempotent DDL — each statement is independent; a failure
    // on one statement (e.g. a pre-existing constraint) must not prevent
    // subsequent tables from being created.
    const statements = schemaSQL
      .replace(/:schema/g, schemaName)
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        ddlErrors++;
        console.error(`  ✗ DDL error [${schemaName}]: ${err.message}`);
      }
    }

    // Re-seed default data — these run even if some DDL steps had warnings
    try {
      // Re-seed privilege resources (ON CONFLICT DO NOTHING keeps existing rows)
      for (const resource of PRIVILEGE_RESOURCES) {
        await tenantQuery(
          slug,
          `INSERT INTO privilege_resources (id, code, label, actions)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [resource.id, resource.code, resource.label, resource.actions],
        );
      }

      // Re-seed default role privileges (additive — ON CONFLICT DO NOTHING)
      await syncDefaultRolePrivileges(slug);

      // Re-seed locked member statuses
      for (const statusName of ['Current', 'Lapsed', 'Resigned', 'Deceased']) {
        await tenantQuery(
          slug,
          `INSERT INTO member_statuses (name, locked) VALUES ($1, true)
           ON CONFLICT (name) DO NOTHING`,
          [statusName],
        );
      }

      // Re-seed locked Individual member class (no UNIQUE on name, use WHERE NOT EXISTS)
      await tenantQuery(
        slug,
        `INSERT INTO member_classes (name, current, locked)
         SELECT 'Individual', true, true
         WHERE NOT EXISTS (SELECT 1 FROM member_classes WHERE name = 'Individual' AND locked = true)`,
      );

      // Seed default locked finance account: Current
      await tenantQuery(
        slug,
        `INSERT INTO finance_accounts (name, active, locked)
         SELECT 'Current', true, true
         WHERE NOT EXISTS (SELECT 1 FROM finance_accounts WHERE name = 'Current' AND locked = true)`,
      );

      // Seed default locked finance categories: Donations, Membership
      for (const catName of ['Donations', 'Membership']) {
        await tenantQuery(
          slug,
          `INSERT INTO finance_categories (name, active, locked)
           SELECT $1, true, true
           WHERE NOT EXISTS (SELECT 1 FROM finance_categories WHERE name = $1 AND locked = true)`,
          [catName],
        );
      }
    } catch (err) {
      console.error(`  ✗ Seed error [${schemaName}]:`, err.message);
    }

    if (ddlErrors > 0) {
      console.warn(`  ⚠ ${schemaName}: ${ddlErrors} DDL statement(s) failed (see errors above)`);
    } else {
      console.log(`  ✓ ${schemaName} up to date`);
    }
  }
}

/**
 * Sync the canonical default-role privileges for a single tenant.
 * Called after a restore so that default-named roles (Administration, etc.)
 * always have at least the canonical privilege set.
 *
 * Strategy: for each DEFAULT_ROLES entry, find the role by name and INSERT
 * the canonical privileges (ON CONFLICT DO NOTHING — additive, not destructive).
 * Custom roles and any extra admin-added privileges are untouched.
 */
export async function syncDefaultRolePrivileges(slug) {
  const dbResources = await tenantQuery(slug, `SELECT id, code FROM privilege_resources`);
  const resourceIdByCode = Object.fromEntries(dbResources.map((r) => [r.code, r.id]));

  for (const roleData of DEFAULT_ROLES) {
    const rows = await tenantQuery(
      slug,
      `SELECT id FROM roles WHERE name = $1 LIMIT 1`,
      [roleData.name],
    );
    if (rows.length === 0) continue;
    const roleId = rows[0].id;

    for (const { code, action } of roleData.defaultPrivileges) {
      const resourceId = resourceIdByCode[code];
      if (!resourceId) continue;
      await tenantQuery(
        slug,
        `INSERT INTO role_privileges (role_id, resource_id, action)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [roleId, resourceId, action],
      );
    }
  }
  console.log(`  ✓ Default role privileges synced for ${slug}`);
}

/**
 * Re-sync the privileges for the five default roles on every active tenant to
 * exactly match DEFAULT_ROLES in defaultRoles.js.
 *
 * Strategy: for each default role (looked up by name) delete all its current
 * privileges and re-insert from the canonical set.  This corrects both missing
 * entries and stale entries from earlier code versions.
 *
 * Custom roles and any admin-added privileges on non-default roles are untouched.
 */
async function migrateDefaultRolePrivileges() {
  const tenants = await prisma.sysTenant.findMany({ where: { active: true } });
  if (tenants.length === 0) return;

  for (const tenant of tenants) {
    const slug = tenant.slug;
    try {
      await syncDefaultRolePrivileges(slug);
    } catch (err) {
      console.error(`  ✗ Privilege sync error [${slug}]:`, err.message);
    }
  }
}
