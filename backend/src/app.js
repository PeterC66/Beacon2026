// beacon2/backend/src/app.js

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

import authRoutes      from './routes/auth.js';
import userRoutes      from './routes/users.js';
import roleRoutes      from './routes/roles.js';
import privilegeRoutes from './routes/privileges.js';
import systemRoutes    from './routes/system.js';
import { errorHandler } from './middleware/errorHandler.js';
import { prisma }       from './utils/db.js';
import { migrateAndSeed } from './utils/migrate.js';

const app = express();

app.set('trust proxy', 1); // trust Render's load balancer

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  message: { error: 'Too many attempts, please try again later.' } });
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(generalLimiter);

app.use('/auth',       authLimiter, authRoutes);
app.use('/users',      userRoutes);
app.use('/roles',      roleRoutes);
app.use('/privileges', privilegeRoutes);
app.use('/system',     systemRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

// ── Start: migrate first, then listen ────────────────────────────────────
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

export default app;
