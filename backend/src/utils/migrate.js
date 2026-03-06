// beacon2/backend/src/utils/migrate.js
// Runs database migrations and seeds automatically on startup.
// This means you never need shell access to set up the database.

import { execSync } from 'child_process';
import { prisma } from './db.js';
import { hashPassword } from './password.js';

export async function migrateAndSeed() {
  // 1. Run Prisma migrations (creates system-level tables if they don't exist)
  console.log('Running database migrations...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    throw err;
  }

  // 2. Seed the system admin if one doesn't exist yet
  const existing = await prisma.sysAdmin.findFirst();
  if (existing) {
    console.log('Database already seeded — skipping.');
    return;
  }

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
