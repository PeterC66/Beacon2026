// beacon2/backend/src/routes/calendar/index.js
// Parent router for the calendar — the aggregated view of all group_events
// (including open meetings). Owns the shared middleware (requireAuth + the
// `events` feature gate), then mounts the concern-specific sub-routers. The
// events router defines its literal `/events/pdf`, `/events/excel`, and
// `/events/search` routes before `/events/:eventId`, so the param does not
// capture those segments.

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import eventsRouter from './events.js';
import openEventsRouter from './openEvents.js';
import eventMembersRouter from './eventMembers.js';

const router = Router();
router.use(requireAuth);
router.use(requireFeature('events'));

router.use('/', eventsRouter);
router.use('/', openEventsRouter);
router.use('/', eventMembersRouter);

export default router;
