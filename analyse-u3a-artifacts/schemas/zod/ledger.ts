import { z } from "zod";
import {
  zString,
  zStringNullable,
  zInt,
  zIntNullable,
  zDate,
  zDateNullable,
  zDecimal,
} from "./_coerce.js";

/**
 * Row of the `Ledger` sheet.
 *
 * `amount` is SIGNED: positive = money in, negative = money out. Derive a
 * `type` ('in' | 'out') and use `Math.abs(amount)` when storing.
 */
export const ledgerRow = z.object({
  tkey: zString,
  trans_no: zInt,
  date: zDate,
  account: zString,
  amount: zDecimal,
  payee: zStringNullable,
  detail: zStringNullable,
  payment_method: zStringNullable,
  cheque: zStringNullable,
  notes: zStringNullable,
  cleared: zDateNullable,
  gift_aid: zStringNullable,
  claimed: zStringNullable,
  member_1: zIntNullable,
  member_2: zIntNullable,
  group: zStringNullable,
  c_name: zStringNullable,
});

export type LedgerRow = z.infer<typeof ledgerRow>;

/** 'in' for income, 'out' for expense — derived from the sign of amount. */
export function ledgerType(row: LedgerRow): "in" | "out" {
  return row.amount >= 0 ? "in" : "out";
}
