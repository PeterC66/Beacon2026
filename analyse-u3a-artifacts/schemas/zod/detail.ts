import { z } from "zod";
import { zString, zDecimal } from "./_coerce.js";

/** Row of the `Detail` sheet. Splits of a Ledger transaction by category. */
export const detailRow = z.object({
  tkey: zString,
  category: zString,
  amount: zDecimal,
});

export type DetailRow = z.infer<typeof detailRow>;
