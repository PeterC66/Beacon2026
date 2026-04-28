import { z } from "zod";
import {
  zString,
  zStringNullable,
  zInt,
  zBool,
  zDateNullable,
} from "./_coerce.js";

/**
 * Row of the `Members` sheet. Note `e-mail` (with hyphen) — access in code
 * via `row['e-mail']`.
 */
export const memberRow = z.object({
  mkey: zString,
  mem_no: zInt,
  status: zString,
  title: zStringNullable,
  forename: zString,
  surname: zString,
  suffix: zStringNullable,
  known_as: zStringNullable,
  initials: zStringNullable,
  spare: zStringNullable,
  mobile: zStringNullable,
  "e-mail": zStringNullable,
  affiliation: zStringNullable,
  custom1: zStringNullable,
  custom2: zStringNullable,
  custom3: zStringNullable,
  custom4: zStringNullable,
  joined: zDateNullable,
  renew: zDateNullable,
  gift_aid: zDateNullable,
  class: zString,
  mem_notes: zStringNullable,
  akey: zStringNullable,
  house: zStringNullable,
  address1: zStringNullable,
  address2: zStringNullable,
  address3: zStringNullable,
  town: zStringNullable,
  postcode: zStringNullable,
  county: zStringNullable,
  telephone: zStringNullable,
  add_notes: zStringNullable,
  emergency_contact: zStringNullable,
  enhanced_privacy: zBool,
  payment_type: zStringNullable,
});

export type MemberRow = z.infer<typeof memberRow>;
