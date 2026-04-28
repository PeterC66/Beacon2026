import { z } from "zod";
import { zString, zBool } from "./_coerce.js";

/** Row of the `Member Statuses` sheet. */
export const memberStatusRow = z.object({
  stakey: zString,
  status: zString,
  locked: zBool,
});

export type MemberStatusRow = z.infer<typeof memberStatusRow>;
