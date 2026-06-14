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
import { logger } from '../utils/logger.js';

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME ?? 'System Administrator';

async function seed() {
  if (!email || !password) {
    logger.error('Seed failed: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set.');
    process.exit(1);
  }

  logger.info('Seeding system administrator...');

  const existing = await prisma.sysAdmin.findUnique({ where: { email } });
  if (existing) {
    logger.info('System admin already exists — nothing to seed.');
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.sysAdmin.create({
    data: { email, name, passwordHash, active: true },
  });

  logger.info(
    '✓ System administrator created (credentials set via SEED_ADMIN env vars). ' +
      'IMPORTANT: change this password immediately after first login.',
  );

  await prisma.$disconnect();
}

seed().catch((err) => {
  logger.error('Seed failed', { message: err.message, stack: err.stack });
  process.exit(1);
});
