/**
 * Beacon backup xlsx — Zod schemas, one per sheet.
 *
 * Re-exports every per-sheet schema and provides:
 *   - SHEET_SCHEMAS: a map from xlsx sheet name (verbatim) → Zod row schema
 *   - parseSheet(name, rows): convenience parser that validates an array of rows
 *   - BeaconBackup: aggregate type for a fully parsed workbook
 *
 * Usage:
 *
 *   import ExcelJS from 'exceljs';
 *   import { SHEET_SCHEMAS, parseSheet } from './schemas/zod/index.js';
 *
 *   const wb = new ExcelJS.Workbook();
 *   await wb.xlsx.readFile(path);
 *   const ws = wb.getWorksheet('Members');
 *   const rows = sheetToObjects(ws); // your helper, see CLAUDE.md
 *   const members = parseSheet('Members', rows);
 */

import { z } from "zod";

import { memberStatusRow, type MemberStatusRow } from "./member-statuses.js";
import { membershipClassRow, type MembershipClassRow } from "./membership-classes.js";
import { membershipFeeRow, type MembershipFeeRow } from "./membership-fees.js";
import { memberRow, type MemberRow } from "./members.js";
import { facultyRow, type FacultyRow } from "./faculties.js";
import { venueRow, type VenueRow } from "./venues.js";
import { groupRow, type GroupRow } from "./groups.js";
import { groupMemberRow, type GroupMemberRow } from "./group-members.js";
import { groupLedgerRow, type GroupLedgerRow } from "./group-ledgers.js";
import { calendarRow, type CalendarRow } from "./calendar.js";
import { financeAccountRow, type FinanceAccountRow } from "./finance-accounts.js";
import { financeCategoryRow, type FinanceCategoryRow } from "./finance-categories.js";
import { ledgerRow, type LedgerRow } from "./ledger.js";
import { detailRow, type DetailRow } from "./detail.js";
import { officerRow, type OfficerRow } from "./u3a-officers.js";

export {
  memberStatusRow,
  membershipClassRow,
  membershipFeeRow,
  memberRow,
  facultyRow,
  venueRow,
  groupRow,
  groupMemberRow,
  groupLedgerRow,
  calendarRow,
  financeAccountRow,
  financeCategoryRow,
  ledgerRow,
  detailRow,
  officerRow,
};

export type {
  MemberStatusRow,
  MembershipClassRow,
  MembershipFeeRow,
  MemberRow,
  FacultyRow,
  VenueRow,
  GroupRow,
  GroupMemberRow,
  GroupLedgerRow,
  CalendarRow,
  FinanceAccountRow,
  FinanceCategoryRow,
  LedgerRow,
  DetailRow,
  OfficerRow,
};

/**
 * Map from xlsx sheet name (verbatim, including spaces and capitalisation)
 * to Zod row schema. Use this to drive sheet-by-sheet parsing.
 */
export const SHEET_SCHEMAS = {
  "Member Statuses":     memberStatusRow,
  "Membership Classes":  membershipClassRow,
  "Membership Fees":     membershipFeeRow,
  "Members":             memberRow,
  "Faculties":           facultyRow,
  "Venues":              venueRow,
  "Groups":              groupRow,
  "Group members":       groupMemberRow,
  "Group Ledgers":       groupLedgerRow,
  "Calendar":            calendarRow,
  "Finance Accounts":    financeAccountRow,
  "Finance Categories":  financeCategoryRow,
  "Ledger":              ledgerRow,
  "Detail":              detailRow,
  "u3a Officers":        officerRow,
} as const;

export type SheetName = keyof typeof SHEET_SCHEMAS;
export type SheetRow<N extends SheetName> = z.infer<typeof SHEET_SCHEMAS[N]>;

/**
 * Validate and coerce an array of raw row objects against the schema for the
 * given sheet. Throws on invalid data — wrap in safeParse if you want to
 * collect errors instead.
 */
export function parseSheet<N extends SheetName>(
  name: N,
  rows: unknown[],
): SheetRow<N>[] {
  const schema = SHEET_SCHEMAS[name];
  return rows.map((r, i) => {
    const result = schema.safeParse(r);
    if (!result.success) {
      throw new Error(
        `Sheet "${name}" row ${i + 2}: ${result.error.message}`,
      );
    }
    return result.data as SheetRow<N>;
  });
}

/**
 * Aggregate type representing a fully parsed Beacon backup. Each property is
 * the array of rows from the corresponding sheet.
 */
export interface BeaconBackup {
  memberStatuses: MemberStatusRow[];
  membershipClasses: MembershipClassRow[];
  membershipFees: MembershipFeeRow[];
  members: MemberRow[];
  faculties: FacultyRow[];
  venues: VenueRow[];
  groups: GroupRow[];
  groupMembers: GroupMemberRow[];
  groupLedgers: GroupLedgerRow[];
  calendar: CalendarRow[];
  financeAccounts: FinanceAccountRow[];
  financeCategories: FinanceCategoryRow[];
  ledger: LedgerRow[];
  detail: DetailRow[];
  officers: OfficerRow[];
}
