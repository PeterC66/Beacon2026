import { z } from "zod";
import { zString, zBool } from "./_coerce.js";

/** Row of the `Finance Accounts` sheet. */
export const financeAccountRow = z.object({
  acckey: zString,
  name: zString,
  status: zBool,
  locked: zBool,
});

export type FinanceAccountRow = z.infer<typeof financeAccountRow>;
