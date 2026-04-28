import { z } from "zod";
import { zString, zStringNullable, zDate, zDecimal } from "./_coerce.js";

/** Row of the `Group Ledgers` sheet. amount is SIGNED (+ in / − out). */
export const groupLedgerRow = z.object({
  gtkey: zString,
  gkey: zString,
  group: zStringNullable,
  date: zDate,
  payee: zStringNullable,
  amount: zDecimal,
  detail: zStringNullable,
});

export type GroupLedgerRow = z.infer<typeof groupLedgerRow>;
