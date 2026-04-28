# Analyse u3a — Project Primer

> **Drop this file into the new repo as `CLAUDE.md`.** It is the entry point for
> any AI agent (Claude, Codex) working on the project.

---

## What this app does

**Analyse u3a** is a **local-only desktop analysis tool** for the data managed by
the original u3a **Beacon** membership system. A u3a treasurer or membership
secretary periodically takes a "Beacon backup" — a single `.xlsx` file
containing every record in their u3a's Beacon database. This app loads that
file from a path on the user's local machine and produces analyses:

- **Membership patterns** — how membership has grown / shrunk; demographics by
  membership class
- **Group popularity** — which interest groups are over/undersubscribed; trends
- **Attendance patterns** — inferred from group membership over time and the
  Calendar sheet (note: legacy Beacon does **not** record per-event attendance)
- **Member churn** — joiners, leavers, lapsed renewals
- **Membership renewal payments** — total income, count, by year, by class

## Why local-only

The backup file contains **personal data of u3a members** (names, addresses,
phone numbers, emails). It must **never leave the user's machine.**

That means:

- **No cloud uploads.** No telemetry. No analytics SaaS. No remote LLM calls
  with member data in the prompt.
- **No external HTTP at runtime** (other than fetching static assets at build
  time, which doesn't see member data).
- **Run only on `localhost`.** Bind dev/prod servers to `127.0.0.1`, not `0.0.0.0`.
- The data file path is provided by the user via a file picker or CLI arg —
  never bundled with the app.

When in doubt, fail closed: refuse to start if a configured external endpoint
is reachable, rather than risk a leak.

---

## Data structure (read this first)

The `.xlsx` Beacon backup has 23 sheets; this app only needs 15 of them. The
columns, types, and foreign-key relationships are documented in:

- **`BEACON-DATA-STRUCTURE.md`** — start here. Top-level overview + Mermaid ER
  diagram + ingestion order.
- **`BEACON-DATA-MEMBERS.md`** — Members, Member Statuses, Membership Classes,
  Membership Fees
- **`BEACON-DATA-GROUPS.md`** — Groups, Faculties, Venues, Group members,
  Group Ledgers, Calendar
- **`BEACON-DATA-FINANCE.md`** — Finance Accounts, Finance Categories, Ledger,
  Detail (this is where renewal payments live)
- **`BEACON-DATA-CONTACTS.md`** — u3a Officers

Programmatic contracts:

- **`schemas/zod/index.ts`** — single import for all Zod schemas; exports
  `SHEET_SCHEMAS`, `parseSheet`, and the `BeaconBackup` aggregate type
- **`schemas/json/*.schema.json`** — JSON Schema (Draft 2020-12) per sheet,
  if a non-TS consumer ever needs them

**The Zod schemas are the source of truth at runtime.** Use them.

---

## Recommended tech stack

The artifacts assume **Node.js + TypeScript**, but nothing prevents you from
choosing differently. If you change stack, regenerate the schemas in the new
language (e.g. Pydantic for Python).

Suggested baseline:

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js (LTS) | Cross-platform, ships with `npm` |
| Language | TypeScript | Schemas already TS-native |
| xlsx parsing | `exceljs` | Same library Beacon2 uses; battle-tested |
| Validation | `zod` | Schemas already authored as Zod |
| UI | Vite + React | Fast dev loop; widely understood by AI agents |
| Charts | `recharts` or `chart.js` | Both work locally without external resources |
| Storage | In-memory (Map / arrays) **or** SQLite via `better-sqlite3` | SQLite if user wants to compare snapshots over time |
| Packaging (optional) | Electron, or just `npm start` opening `localhost:5173` | Keep it simple; Electron only if a "real exe" is needed |

The whole thing should run via `npm start` on a Windows machine with Node
installed. If the user is non-technical, package as an Electron app or use
`pkg` to produce a single `.exe`.

---

## Ingestion pipeline

```ts
import ExcelJS from "exceljs";
import { SHEET_SCHEMAS, parseSheet, type BeaconBackup, type SheetName } from "./schemas/zod/index.js";

/** Convert a worksheet to an array of objects keyed by header. */
function sheetToObjects(ws: ExcelJS.Worksheet): Record<string, unknown>[] {
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col - 1] = String(cell.value);
  });
  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (row.actualCellCount === 0) continue;
    const obj: Record<string, unknown> = {};
    for (let c = 1; c <= headers.length; c++) {
      const key = headers[c - 1];
      if (!key) continue;
      const v = row.getCell(c).value;
      // ExcelJS returns hyperlink/richtext objects — flatten to plain values
      obj[key] = (v && typeof v === "object" && "text" in v) ? (v as { text: unknown }).text
              : (v && typeof v === "object" && "result" in v) ? (v as { result: unknown }).result
              : v;
    }
    rows.push(obj);
  }
  return rows;
}

export async function loadBackup(path: string): Promise<BeaconBackup> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);

  const get = <N extends SheetName>(name: N) => {
    const ws = wb.getWorksheet(name);
    if (!ws) throw new Error(`Backup is missing sheet "${name}"`);
    return parseSheet(name, sheetToObjects(ws));
  };

  return {
    memberStatuses:    get("Member Statuses"),
    membershipClasses: get("Membership Classes"),
    membershipFees:    get("Membership Fees"),
    members:           get("Members"),
    faculties:         get("Faculties"),
    venues:            get("Venues"),
    groups:            get("Groups"),
    groupMembers:      get("Group members"),
    groupLedgers:      get("Group Ledgers"),
    calendar:          get("Calendar"),
    financeAccounts:   get("Finance Accounts"),
    financeCategories: get("Finance Categories"),
    ledger:            get("Ledger"),
    detail:            get("Detail"),
    officers:          get("u3a Officers"),
  };
}
```

After loading, build the lookup maps described in
`BEACON-DATA-STRUCTURE.md §5` (e.g. `memberByNo`, `groupByGkey`, `categoryByName`).

---

## Coding conventions

These mirror Beacon2's conventions where applicable.

- **ES modules** (`import` / `export`) — never `require()`.
- **TypeScript strict mode** on. No `any` unless commented why.
- **u3a is always lowercase** (the organisation's house style).
- **The original system is "Beacon"; the data structure docs reference
  "Beacon" not "Beacon2"** because the file format predates Beacon2.
- **No `localStorage` for member data.** In-memory only while the file is
  loaded. If you need persistence (e.g. saved analysis configs), store
  config-only — never member data.
- **Validate at the boundary.** Use Zod when the file is read; trust the
  parsed types everywhere else.
- **Date format internally:** `YYYY-MM-DD` strings. The Zod helpers already
  coerce to this.
- **No SQL string concatenation.** If you use SQLite, parameterise queries.
- **Don't add backwards-compat shims.** This is a fresh app.
- **Don't write comments that explain the WHAT.** Only comment WHY when
  non-obvious.

---

## What's NOT in the data

Things the user might ask for that are **not** in a legacy Beacon backup:

- **Per-event attendance** (who showed up to which group meeting). Not
  recorded. Don't fabricate it. You can show event programme (`Calendar`) and
  current group membership (`Group members`) — these are proxies at best.
- **Left-on date for members.** Inferred from `status` (lapsed/resigned) and
  `renew` (next renewal date in the past).
- **Email engagement.** Beacon does not track opens/clicks.
- **Login history.** Available in `System Users` only as the most recent
  login, and that sheet is out of scope.

Surface these limitations in the UI rather than silently producing
dubious-looking charts.

---

## Identifying renewal payments

Beacon does not have an `is_renewal` flag. Renewal income is identified by
**transaction category**. Specifically:

1. List `Finance Categories` (the user's own list).
2. Default heuristic: any category whose name matches
   `/subscr|renew|member.*fee/i` is treated as renewal income.
3. Always let the user **override** the selection — different u3as use
   different category names. Persist the choice as a config file (no member
   data inside).
4. For each `Detail` row in those categories, look up the parent `Ledger`
   row by `tkey` to get the `date`, `member_1`, `member_2`, `payment_method`.

See `BEACON-DATA-FINANCE.md` for the full recipe.

---

## Files in this primer kit

```
analyse-u3a-artifacts/
├── README.md                       — what this folder is, how to copy into the new repo
├── CLAUDE.md                       — this file
├── BEACON-DATA-STRUCTURE.md        — top-level data reference + Mermaid ER diagram
├── BEACON-DATA-MEMBERS.md          — member sheets reference
├── BEACON-DATA-GROUPS.md           — group sheets reference
├── BEACON-DATA-FINANCE.md          — finance sheets reference
├── BEACON-DATA-CONTACTS.md         — officers reference
└── schemas/
    ├── json/   — JSON Schema per sheet
    └── zod/    — Zod schemas + TypeScript types per sheet, plus index.ts
```

Copy the whole folder into the new repo (or the contents into the repo root).
The four `BEACON-DATA-*.md` files and the schemas should not need changes; the
`CLAUDE.md` file should be edited to add app-specific instructions as the
project develops.
