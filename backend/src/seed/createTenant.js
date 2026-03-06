// beacon2/backend/src/seed/createTenant.js
// Creates a new u3a tenant: DB schema + default roles + privilege resources + first admin user

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../utils/db.js';
import { tenantQuery } from '../utils/db.js';
import { hashPassword } from '../utils/password.js';
import { PRIVILEGE_RESOURCES } from './privilegeResources.js';
import { DEFAULT_ROLES } from './defaultRoles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create a new u3a tenant in full:
 *  1. Insert into sys_tenants
 *  2. Create the PostgreSQL schema
 *  3. Seed privilege resources
 *  4. Seed default roles with their default privileges
 *  5. Create the first admin user
 *
 * @param {{ name, slug, adminEmail, adminName, adminPassword }} params
 */
export async function createTenantSchema({ name, slug, adminEmail, adminName, adminPassword }) {
  // 1. Create the tenant record
  const tenant = await prisma.sysTenant.create({ data: { name, slug } });

  // 2. Execute the schema SQL (replace :schema placeholder)
  const schemaSQL = readFileSync(
    resolve(__dirname, '../../prisma/tenant_schema.sql'),
    'utf8',
  );
  const schemaName = `u3a_${slug}`;

  // We use $executeRawUnsafe because DDL cannot be parameterised
  // The slug has been validated as /^[a-z0-9_]+$/ before reaching here
  const statements = schemaSQL
    .replace(/:schema/g, schemaName)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }

  // 3. Seed privilege resources
  for (const resource of PRIVILEGE_RESOURCES) {
    await tenantQuery(
      slug,
      `INSERT INTO privilege_resources (id, code, label, actions)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [resource.id, resource.code, resource.label, resource.actions],
    );
  }

  // 4. Seed default roles + their privileges
  for (const roleData of DEFAULT_ROLES) {
    const [role] = await tenantQuery(
      slug,
      `INSERT INTO roles (name, is_committee, notes) VALUES ($1, $2, $3) RETURNING id`,
      [roleData.name, roleData.isCommittee, roleData.notes ?? null],
    );

    for (const { code, action } of roleData.defaultPrivileges) {
      const resource = PRIVILEGE_RESOURCES.find((r) => r.code === code);
      if (!resource) continue;
      await tenantQuery(
        slug,
        `INSERT INTO role_privileges (role_id, resource_id, action) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [role.id, resource.id, action],
      );
    }
  }

  // 5. Create first admin user (gets the Administration role)
  const passwordHash = await hashPassword(adminPassword);
  const [user] = await tenantQuery(
    slug,
    `INSERT INTO users (email, name, password_hash, active) VALUES ($1, $2, $3, true) RETURNING id`,
    [adminEmail.toLowerCase(), adminName, passwordHash],
  );

  // Find Administration role and assign it
  const [adminRole] = await tenantQuery(
    slug,
    `SELECT id FROM roles WHERE name = 'Administration' LIMIT 1`,
  );
  if (adminRole) {
    await tenantQuery(
      slug,
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, adminRole.id],
    );
  }

  console.log(`✓ Tenant created: ${name} (${schemaName})`);
  return tenant;
}
