// beacon2/backend/src/app.js

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

import authRoutes          from './routes/auth.js';
import userRoutes          from './routes/users.js';
import roleRoutes          from './routes/roles.js';
import privilegeRoutes     from './routes/privileges.js';
import systemRoutes        from './routes/system.js';
import memberClassRoutes   from './routes/memberClasses.js';
import memberStatusRoutes  from './routes/memberStatuses.js';
import memberRoutes        from './routes/members.js';
import facultyRoutes       from './routes/faculties.js';
import groupRoutes         from './routes/groups.js';
import settingsRoutes      from './routes/settings.js';
import financeRoutes       from './routes/finance.js';
import pollRoutes          from './routes/polls.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', 1); // trust Render's load balancer

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  message: { error: 'Too many attempts, please try again later.' } });
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(generalLimiter);

app.use('/auth',            authLimiter, authRoutes);
app.use('/users',           userRoutes);
app.use('/roles',           roleRoutes);
app.use('/privileges',      privilegeRoutes);
app.use('/system',          systemRoutes);
app.use('/member-classes',  memberClassRoutes);
app.use('/member-statuses', memberStatusRoutes);
app.use('/members',         memberRoutes);
app.use('/faculties',       facultyRoutes);
app.use('/groups',          groupRoutes);
app.use('/settings',        settingsRoutes);
app.use('/finance',         financeRoutes);
app.use('/polls',           pollRoutes);

app.get('/health', (_req, res) => res.json({
  status:  'ok',
  version,
  env:     process.env.NODE_ENV ?? 'development',
  uptime:  Math.floor(process.uptime()),
}));

app.use(errorHandler);

export default app;
