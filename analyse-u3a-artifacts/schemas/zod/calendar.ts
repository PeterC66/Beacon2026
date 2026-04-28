import { z } from "zod";
import {
  zString,
  zStringNullable,
  zBool,
  zTimeNullable,
} from "./_coerce.js";

/**
 * Row of the `Calendar` sheet.
 *
 * The `date/time` column has a slash in its name — access as
 * `row['date/time']`. It contains a combined date+time. Parse it on read.
 *
 * Per-event attendance is NOT in legacy Beacon backups.
 */
export const calendarRow = z.object({
  ckey: zString,
  "date/time": zString,
  end_time: zTimeNullable,
  gkey: zStringNullable,
  group: zStringNullable,
  gvkey: zStringNullable,
  venue: zStringNullable,
  topic: zStringNullable,
  detail: zStringNullable,
  enquiries: zStringNullable,
  exclude_public: zBool,
});

export type CalendarRow = z.infer<typeof calendarRow>;
