// beacon2/backend/src/seed/index.js
// Run once after deployment to create the system administrator account.
// Usage: node src/seed/index.js

import 'dotenv/config';
import { prisma } from '../utils/db.js';
import { hashPassword } from '../utils/password.js';

const email    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@beacon2.local';
const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const name     = process.env.SEED_ADMIN_NAME     ?? 'System Administrator';

async function seed() {
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
  console.log(`  Password: ${password}`);
  console.log('');
  console.log('IMPORTANT: Change this password immediately after first login.');

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
