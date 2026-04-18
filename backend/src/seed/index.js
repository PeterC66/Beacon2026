// beacon2/backend/src/seed/index.js
// Run once after deployment to create the system administrator account.
// Usage: node src/seed/index.js
//
// SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required — the seed
// refuses to run without them so that no system admin account is ever
// created with a well-known credential pair.

import 'dotenv/config';
import { prisma } from '../utils/db.js';
import { hashPassword } from '../utils/password.js';

const email    = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const name     = process.env.SEED_ADMIN_NAME ?? 'System Administrator';

async function seed() {
  if (!email || !password) {
    console.error('Seed failed: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set.');
    process.exit(1);
  }

  console.log('Seeding system administrator...');

  const existing = await prisma.sysAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log(`System admin already exists: ${email}`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.sysAdmin.create({
    data: { email, name, passwordHash, active: true },
  });

  console.log('');
  console.log('✓ System administrator created:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: (set via SEED_ADMIN_PASSWORD env var)`);
  console.log('');
  console.log('IMPORTANT: Change this password immediately after first login.');

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
