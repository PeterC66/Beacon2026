// beacon2/backend/src/app.js
// Main application entry point

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import privilegeRoutes from './routes/privileges.js';
import systemRoutes from './routes/system.js';
import { errorHandler } from './middleware/errorHandler.js';
import { prisma } from './utils/db.js';

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,   // required for httpOnly cookie refresh tokens
}));

// ─── Body parsing ─────────────────────────────────────────────────────────
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────────────
// Tighter limit on auth endpoints to slow down brute-force attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  message: { error: 'Too many attempts, please try again later.' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

app.use(generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/auth', authLimiter, authRoutes);
app.use('/users', userRoutes);
app.use('/roles', roleRoutes);
app.use('/privileges', privilegeRoutes);
app.use('/system', systemRoutes);  // system-tier — protected by IP allowlist in production

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Error handler (must be last) ─────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Beacon2 API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
