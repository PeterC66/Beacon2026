// beacon2/backend/src/schemas/groups.js
// Group-specific schema extensions.

import { z } from 'zod';
import { patchMemberSchema, bulkMemberIdsSchema } from './common.js';

// Groups also allow promoting from waiting list
export const patchGroupMemberSchema = patchMemberSchema.extend({
  waitingSince: z.null().optional(),   // pass null to promote from waiting list
});

// Bulk-add members to another group
export const bulkAddToGroupSchema = bulkMemberIdsSchema.extend({
  targetGroupId: z.string().uuid(),
});
