import { z } from "zod";
import { zString, zStringNullable } from "./_coerce.js";

/** Row of the `u3a Officers` sheet. */
export const officerRow = z.object({
  ofkey: zString,
  office: zString,
  mkey: zStringNullable,
  forename: zStringNullable,
  surname: zStringNullable,
  "e-mail": zStringNullable,
  notes: zStringNullable,
});

export type OfficerRow = z.infer<typeof officerRow>;
