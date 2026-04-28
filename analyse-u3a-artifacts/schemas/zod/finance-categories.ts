import { z } from "zod";
import { zString, zBool } from "./_coerce.js";

/** Row of the `Finance Categories` sheet. */
export const financeCategoryRow = z.object({
  catkey: zString,
  name: zString,
  status: zBool,
  locked: zBool,
});

export type FinanceCategoryRow = z.infer<typeof financeCategoryRow>;

/** Default heuristic: which categories likely represent renewal income. */
export const RENEWAL_CATEGORY_REGEX = /subscr|renew|member.*fee/i;
