// beacon2026/backend/src/server.js
// Entry point: migrate, seed, then start listening.
// app.js exports the pure Express app (importable without side-effects for tests).

import 'dotenv/config';
import { createRequire } from 'module';
import app from './app.js';
import { prisma } from './utils/db.js';
import { migrateAndSeed } from './utils/migrate.js';
import { logger } from './utils/logger.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const PORT = process.env.PORT ?? 3001;

migrateAndSeed()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`beacon2026 API v${version} running on port ${PORT}`, {
        env: process.env.NODE_ENV,
      });
    });
  })
  .catch((err) => {
    logger.error('Startup failed', { message: err.message, stack: err.stack });
    process.exit(1);
  });

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
