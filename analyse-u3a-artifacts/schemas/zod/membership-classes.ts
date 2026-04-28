import { z } from "zod";
import { zString, zStringNullable, zBool, zDecimalNullable } from "./_coerce.js";

/** Row of the `Membership Classes` sheet. */
export const membershipClassRow = z.object({
  mckey: zString,
  class: zString,
  status: zBool,
  fee: zDecimalNullable,
  family: zBool,
  associate: zBool,
  info: zStringNullable,
  notes: zStringNullable,
  locked: zBool,
});

export type MembershipClassRow = z.infer<typeof membershipClassRow>;
