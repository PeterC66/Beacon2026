// beacon2/backend/src/server.js
// Entry point: migrate, seed, then start listening.
// app.js exports the pure Express app (importable without side-effects for tests).

import 'dotenv/config';
import app from './app.js';
import { prisma } from './utils/db.js';
import { migrateAndSeed } from './utils/migrate.js';

const PORT = process.env.PORT ?? 3001;

migrateAndSeed()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Beacon2 API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
