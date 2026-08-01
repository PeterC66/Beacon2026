// beacon2026/backend/src/app.js

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import privilegeRoutes from './routes/privileges.js';
import systemRoutes from './routes/system.js';
import memberClassRoutes from './routes/memberClasses.js';
import memberStatusRoutes from './routes/memberStatuses.js';
import memberRoutes from './routes/members/index.js';
import facultyRoutes from './routes/faculties.js';
import venueRoutes from './routes/venues.js';
import groupRoutes from './routes/groups/index.js';
import teamRoutes from './routes/teams/index.js';
import settingsRoutes from './routes/settings.js';
import financeRoutes from './routes/finance/index.js';
import pollRoutes from './routes/polls.js';
import auditRoutes from './routes/audit.js';
import officeRoutes from './routes/offices.js';
import backupRoutes from './routes/backup/index.js';
import addressExportRoutes from './routes/addressExport.js';
import emailRoutes from './routes/email.js';
import giftAidRoutes from './routes/giftAid.js';
import systemMessageRoutes from './routes/systemMessages.js';
import publicLinksRoutes from './routes/publicLinks.js';
import publicRoutes from './routes/public/index.js';
import calendarRoutes from './routes/calendar/index.js';
import eventTypeRoutes from './routes/eventTypes.js';
import membershipCardRoutes from './routes/membershipCards.js';
import letterRoutes from './routes/letters.js';
import customFieldRoutes from './routes/customFields.js';
import reportRoutes from './routes/reports.js';
import apiV1Routes from './routes/api/index.js';
import { errorHandler } from './middleware/errorHandler.js';

// Refuse to start in production without CORS_ORIGIN — otherwise the cors
// middleware silently sends no headers and the frontend breaks with no clue
// why. In dev/test we allow it to be unset so local runs Just Work.
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  throw new Error(
    'CORS_ORIGIN must be set in production. Configure it to the frontend URL ' +
      '(e.g. https://beacon2026.vercel.app).',
  );
}

const app = express();

app.set('trust proxy', 1); // trust Render's load balancer

// ─── Public read API (/api/v1) ────────────────────────────────────────────
// Mounted BEFORE the app-wide helmet/cors/rate-limit middleware, because it
// needs different values for all three and whichever runs first wins:
//
//  • CORS — `cors({ origin: CORS_ORIGIN })` echoes that one configured origin
//    to every caller rather than matching it against the request, so a u3a's
//    own website would be refused. This API is public and needs `*`.
//  • Helmet — the default `Cross-Origin-Resource-Policy: same-origin` blocks
//    cross-origin reads even when CORS is correct, which fails in a way that
//    looks like a CORS bug and is not.
//  • Rate limit — `generalLimiter` is per-IP and shared with the frontend. A
//    u3a website is a single IP, so without its own bucket a busy site could
//    exhaust the allowance and take the frontend down with it.
//
// No `express.json()` either: v1 is read-only and parses no bodies.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX || '600', 10),
  message: { error: { code: 'rate_limited', message: 'Too many requests, please slow down.' } },
});

app.use(
  '/api/v1',
  helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }),
  cors({ origin: '*' }),
  apiLimiter,
  apiV1Routes,
);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  }),
);
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '100', 10),
  message: { error: 'Too many attempts, please try again later.' },
});
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(generalLimiter);

app.use('/auth', authLimiter, authRoutes);
app.use('/users', userRoutes);
app.use('/roles', roleRoutes);
app.use('/privileges', privilegeRoutes);
app.use('/system', systemRoutes);
app.use('/member-classes', memberClassRoutes);
app.use('/member-statuses', memberStatusRoutes);
app.use('/members', memberRoutes);
app.use('/faculties', facultyRoutes);
app.use('/venues', venueRoutes);
app.use('/groups', groupRoutes);
app.use('/teams', teamRoutes);
app.use('/settings', settingsRoutes);
app.use('/finance', financeRoutes);
app.use('/polls', pollRoutes);
app.use('/audit', auditRoutes);
app.use('/offices', officeRoutes);
app.use('/backup', backupRoutes);
app.use('/address-export', addressExportRoutes);
app.use('/email', emailRoutes);
app.use('/gift-aid', giftAidRoutes);
app.use('/system-messages', systemMessageRoutes);
app.use('/public-links', publicLinksRoutes);
app.use('/public', publicRoutes);
app.use('/calendar', calendarRoutes);
app.use('/event-types', eventTypeRoutes);
app.use('/membership-cards', membershipCardRoutes);
app.use('/letters', letterRoutes);
app.use('/custom-fields', customFieldRoutes);
app.use('/reports', reportRoutes);

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    version,
    env: process.env.NODE_ENV ?? 'development',
    uptime: Math.floor(process.uptime()),
  }),
);

app.use(errorHandler);

export default app;
