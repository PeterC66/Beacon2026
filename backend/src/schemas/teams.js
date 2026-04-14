// beacon2/backend/src/schemas/teams.js
// Team-specific schema extensions.

import { z } from 'zod';
import { bulkMemberIdsSchema } from './common.js';

// Bulk-add members to another team
export const bulkAddToTeamSchema = bulkMemberIdsSchema.extend({
  targetTeamId: z.string().uuid(),
});
