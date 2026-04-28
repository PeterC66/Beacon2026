import { z } from "zod";
import {
  zString,
  zStringNullable,
  zInt,
  zBool,
  zDateNullable,
} from "./_coerce.js";

/** Row of the `Group members` sheet. Composite key (gkey, mem_no). */
export const groupMemberRow = z.object({
  gkey: zString,
  group_name: zString,
  mem_no: zInt,
  forename: zString,
  surname: zString,
  added: zDateNullable,
  // `waiting` may be a date string OR the literal '0' OR null. We keep it as
  // a nullable string here; downstream code should treat '0' as "not waiting".
  waiting: zStringNullable,
  leader: zBool,
  member_status: zStringNullable,
});

export type GroupMemberRow = z.infer<typeof groupMemberRow>;

/** True if this row indicates an active waiting-list entry (not a full member). */
export function isWaiting(row: GroupMemberRow): boolean {
  return row.waiting != null && row.waiting !== "0";
}
