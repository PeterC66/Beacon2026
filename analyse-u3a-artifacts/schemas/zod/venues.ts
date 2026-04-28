import { z } from "zod";
import { zString, zStringNullable, zBool } from "./_coerce.js";

/** Row of the `Venues` sheet. */
export const venueRow = z.object({
  gvkey: zString,
  venue: zString,
  address: zStringNullable,
  postcode: zStringNullable,
  telephone: zStringNullable,
  contact: zStringNullable,
  email: zStringNullable,
  website: zStringNullable,
  private: zBool,
  accessible: zBool,
  notes: zStringNullable,
});

export type VenueRow = z.infer<typeof venueRow>;
