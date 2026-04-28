import { z } from "zod";
import { zString, zStringNullable, zInt, zDecimal } from "./_coerce.js";

/** Row of the `Membership Fees` sheet. */
export const membershipFeeRow = z.object({
  mckey: zString,
  class: zStringNullable,
  month: zInt,
  fee: zDecimal,
});

export type MembershipFeeRow = z.infer<typeof membershipFeeRow>;
