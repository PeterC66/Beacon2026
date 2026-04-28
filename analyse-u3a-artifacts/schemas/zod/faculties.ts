import { z } from "zod";
import { zString } from "./_coerce.js";

/** Row of the `Faculties` sheet. */
export const facultyRow = z.object({
  gfkey: zString,
  faculty: zString,
});

export type FacultyRow = z.infer<typeof facultyRow>;
