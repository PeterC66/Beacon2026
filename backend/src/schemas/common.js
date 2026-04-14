// beacon2/backend/src/schemas/common.js
// Shared Zod schemas used by both groups and teams routes.

import { z } from 'zod';

// Add a single member by ID or membership number
export const addMemberSchema = z.union([
  z.object({ memberId: z.string().min(1) }),
  z.object({ membershipNumber: z.coerce.number().int().positive() }),
]);

// Bulk-add members (non-UUID string IDs)
export const bulkAddMembersSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1),
});

// Shared base: array of member UUIDs (used by bulk-remove and extended by bulk-add-to)
export const bulkMemberIdsSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
});

// Patch a group/team member — base fields shared by both entities
export const patchMemberSchema = z.object({
  isLeader: z.boolean().optional(),
});

// Event creation with optional recurrence
export const eventSchema = z.object({
  eventDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:    z.string().nullable().optional(),
  endTime:      z.string().nullable().optional(),
  venueId:      z.string().nullable().optional(),
  topic:        z.string().nullable().optional(),
  contact:      z.string().nullable().optional(),
  details:      z.string().nullable().optional(),
  isPrivate:    z.boolean().default(false),
  repeatEvery:  z.number().int().positive().nullable().optional(),
  repeatUnit:   z.enum(['days', 'weeks', 'months']).optional(),
  repeatUntil:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

// Event partial update (no recurrence fields)
export const updateEventSchema = z.object({
  eventDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime:  z.string().nullable().optional(),
  endTime:    z.string().nullable().optional(),
  venueId:    z.string().nullable().optional(),
  topic:      z.string().nullable().optional(),
  contact:    z.string().nullable().optional(),
  details:    z.string().nullable().optional(),
  isPrivate:  z.boolean().optional(),
});

// Bulk-delete events by ID array
export const bulkDeleteIdsSchema = z.object({
  ids: z.array(z.string()).min(1),
});

// Ledger entry (shared by group and team finance)
export const ledgerEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payee:     z.string().max(200).nullable().optional(),
  detail:    z.string().max(500).nullable().optional(),
  moneyIn:   z.number().nonnegative().nullable().optional(),
  moneyOut:  z.number().nonnegative().nullable().optional(),
});
