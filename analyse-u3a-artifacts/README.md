# `analyse-u3a-artifacts/`

Generated reference material for the **Analyse u3a** project — a separate,
local-only desktop app that consumes the same `.xlsx` backup format that
Beacon2 imports from the original Beacon system.

This folder is produced **inside the Beacon2 repo** so it can be reviewed and
revised here, but its **only purpose is to be copied wholesale into the new
Analyse u3a repo**. None of the files in this folder are read by Beacon2 at
runtime.

---

## How to use

1. Create the new repo (recommended name: `analyse-u3a`).
2. Copy the **contents** of this folder into the new repo's root, so the
   layout in the new repo becomes:
   ```
   analyse-u3a/
   ├── CLAUDE.md
   ├── BEACON-DATA-STRUCTURE.md
   ├── BEACON-DATA-MEMBERS.md
   ├── BEACON-DATA-GROUPS.md
   ├── BEACON-DATA-FINANCE.md
   ├── BEACON-DATA-CONTACTS.md
   └── schemas/
       ├── json/
       └── zod/
   ```
3. In the new repo, set up `package.json` with `zod` and (recommended)
   `exceljs` as dependencies. The Zod schemas import `zod` and use ESM
   `.js` extensions in their import paths — leave `"type": "module"` in the
   new `package.json` and `"moduleResolution": "node16"` (or `"nodenext"`)
   in `tsconfig.json`.
4. Open the new repo with Claude Code or Codex; the AI agent should read
   `CLAUDE.md` first, which links to everything else.

---

## What's inside

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Primer for the AI agent in the new repo. Tech stack, conventions, ingestion pipeline. |
| `BEACON-DATA-STRUCTURE.md` | Top-level reference: sheet list, conventions, Mermaid ER diagram, recommended ingestion order. |
| `BEACON-DATA-MEMBERS.md` | Per-column reference for `Members`, `Member Statuses`, `Membership Classes`, `Membership Fees`. |
| `BEACON-DATA-GROUPS.md` | Per-column reference for `Groups`, `Faculties`, `Venues`, `Group members`, `Group Ledgers`, `Calendar`. |
| `BEACON-DATA-FINANCE.md` | Per-column reference for `Finance Accounts`, `Finance Categories`, `Ledger`, `Detail` — including the renewal-payment recipe. |
| `BEACON-DATA-CONTACTS.md` | Per-column reference for `u3a Officers`. |
| `schemas/json/*.schema.json` | JSON Schema (Draft 2020-12) per sheet — runtime validation contracts. |
| `schemas/zod/*.ts` | Zod schemas + inferred TypeScript types per sheet. |
| `schemas/zod/_coerce.ts` | Shared coercion helpers (date / time / bool / decimal) used by every Zod row schema. |
| `schemas/zod/index.ts` | Re-exports everything; provides `SHEET_SCHEMAS`, `parseSheet`, and the `BeaconBackup` aggregate type. |

---

## Source of truth

These files were reverse-engineered from
`backend/src/routes/backup.js` (the `restoreBeacon` function) in the Beacon2
repository, and verified against the real backup
`docs/FromBeacon/202603170140_St Ives Cambridge Demo24 u3abackup.xlsx`.

If a future change to Beacon (the legacy PHP system) alters the backup file
format, these artifacts will need updating. The way to find out: try loading
a newer backup; the Zod parser will throw on unexpected columns or types.

---

## Scope reminder

Only **15 of the 23 sheets** present in a Beacon backup are documented and
schematised here. The omitted sheets — `Roles`, `Privileges`, `System Users`,
`Polls`, `Poll assignments`, `System Messages`, `Site Settings 1`,
`Site Settings 2` — are not relevant to the planned analyses (membership
patterns, group popularity, attendance, churn, renewal payments). If a future
analysis needs them, follow the patterns established in this folder to add
them.
