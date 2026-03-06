// beacon2/backend/src/utils/db.js
// Prisma client singleton + tenant-scoped query helpers

import { PrismaClient } from '@prisma/client';

// Singleton Prisma client — one instance shared across the app
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

/**
 * Set the PostgreSQL search_path to a tenant's schema for the duration of
 * a callback. This ensures all queries in the callback are scoped to that tenant.
 *
 * Usage:
 *   const users = await withTenant('oxfordshire', async (db) => {
 *     return db.$queryRaw`SELECT * FROM users`;
 *   });
 *
 * @param {string} tenantSlug - e.g. 'oxfordshire'
 * @param {(db: PrismaClient) => Promise<T>} callback
 */
export async function withTenant(tenantSlug, callback) {
  const schema = `u3a_${tenantSlug}`;

  // Validate slug to prevent SQL injection (slugs must be alphanumeric + underscores)
  if (!/^[a-z0-9_]+$/.test(tenantSlug)) {
    throw new Error(`Invalid tenant slug: ${tenantSlug}`);
  }

  return prisma.$transaction(async (tx) => {
    // Set schema for this transaction
    await tx.$executeRawUnsafe(`SET search_path TO ${schema}, public`);
    return callback(tx);
  });
}

/**
 * Raw query helper scoped to a tenant schema — for queries that don't
 * fit neatly into the ORM.
 *
 * @param {string} tenantSlug
 * @param {string} sql - parameterised SQL, use $1, $2 etc.
 * @param {any[]} params
 */
export async function tenantQuery(tenantSlug, sql, params = []) {
  const schema = `u3a_${tenantSlug}`;
  if (!/^[a-z0-9_]+$/.test(tenantSlug)) {
    throw new Error(`Invalid tenant slug: ${tenantSlug}`);
  }
  // Use a transaction to set search_path then run query
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET search_path TO ${schema}, public`);
    return tx.$queryRawUnsafe(sql, ...params);
  });
}
