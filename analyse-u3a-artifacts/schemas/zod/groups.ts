import { z } from "zod";
import {
  zString,
  zStringNullable,
  zIntNullable,
  zBool,
  zTimeNullable,
} from "./_coerce.js";

/** Row of the `Groups` sheet. Several columns are denormalised aggregates. */
export const groupRow = z.object({
  gkey: zString,
  group_name: zString,
  faculty: zStringNullable,
  venue: zStringNullable,
  status: zString,
  info: zStringNullable,
  meets_when: zStringNullable,
  start_time: zTimeNullable,
  end_time: zTimeNullable,
  members: zIntNullable,
  max_members: zIntNullable,
  notes: zStringNullable,
  contact: zStringNullable,
  join_online: zBool,
  leave_online: zBool,
  waiting_list: zBool,
  notify_leader: zBool,
  leaders: zStringNullable,
  mkey: zStringNullable,
  mem_no: zIntNullable,
  leaders_count: zIntNullable,
  gvkey: zStringNullable,
  gfkey: zStringNullable,
});

export type GroupRow = z.infer<typeof groupRow>;
