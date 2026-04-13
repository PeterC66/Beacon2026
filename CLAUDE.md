# Beacon2 — Claude Code Instructions

## Documentation structure

| File | Purpose | When to read |
|------|---------|--------------|
| **This file (`CLAUDE.md`)** | Session setup, workflow rules, key conventions | Every session (auto-loaded) |
| **`CLAUDE-STANDARDS.md`** | Cross-cutting checklist for all new code | Before starting any implementation |
| **`CLAUDE-REFERENCE.md`** | Detailed implementation notes by module | When working on a specific module |
| **`CLAUDE-E2E.md`** | E2E test architecture, patterns, and gotchas | When writing or debugging E2E tests |
| **`Beacon2 Project Definition.md`** | What has been built and what remains | Every session — living document |
| **`docs/BeaconUG-Comparison.md`** | Beacon2 vs Beacon User Guide comparison | When building/changing features — update after each change |
| **`docs/Beacon2UG/index.md`** | Beacon2 User Guide (64 sections) | When writing user-facing help or verifying feature descriptions |
| **`CHANGELOG.md`** | User-facing changelog of all notable changes | Update at end of every session |

---

## Session startup

At the start of every session, run:

```bash
git fetch origin main
git merge origin/main --no-edit
```

This ensures that any files uploaded directly to `main` (design docs, prompts,
reference material in `docs/`) are present in the working branch before starting work.

Read `Beacon2 Project Definition.md` at the start of every session.

## If a document is not in your branch

If the user refers to a document you cannot find, run `git fetch origin main` and
`git merge origin/main --no-edit` first. If still missing, ask the user.

---

## Development branch

All work goes on a branch whose name starts with `claude/`. Never push directly to `main`.

---

## Key conventions

- **Challenge the user's approach** if an implementation would be difficult, fragile,
  or over-engineered. Ask whether a simpler alternative would meet the requirement
  before building something complex — the user welcomes being pushed back on.
- Always spell **u3a** in lowercase
- The system is called **Beacon2**; the original system is **Beacon**
- Use ES modules (`import`/`export`) throughout — never `require()`
- Frontend access token is stored **in memory only** — never localStorage or sessionStorage
- All tenant database queries must go through `tenantQuery()` or `withTenant()` in `backend/src/utils/db.js`
- Validate all request bodies with **Zod** before processing
- Never construct SQL with string concatenation — always use parameterised queries
- Always, before you start, ask any questions one by one, until you are 95% certain that you can carry out this task
- **Large file creation** — never write a file over ~400 lines in a single tool call.
  Break it into a skeleton first, then add each section in a separate edit. This avoids
  stream idle timeouts that lose the entire response.
- **Lock files** — `package-lock.json` files are tracked in git. When bumping a version
  in `package.json`, run `npm install` in that package directory and commit the updated
  `package-lock.json` in the same commit.

---

## Never define component functions inside other components

Defining a React component inside another component causes remount on every render
(losing state, jumping focus). Instead:
- Use a plain render function: `renderRow(key)` called as `{renderRow(key)}`
- Or extract to a top-level component outside the parent function

---

## Privileges for new functionality

**Every new page must use a proper named privilege resource — never reuse `settings:view`.**

1. Add resource to `backend/src/seed/privilegeResources.js`
2. Grant to roles in `backend/src/seed/defaultRoles.js` (Administration always gets it)
3. Add to `ALL_PRIVS` in `backend/src/__tests__/helpers.js`
4. Use `requirePrivilege` on backend route, `can` in frontend guard

The migration system auto-seeds privileges on every startup.

---

## Reference documentation

### User Guide — `docs/BeaconUG/`

Beacon User Guide transcribed to Markdown. **Before using any folder**, check for
unconverted PDFs — warn the user if found. If docs for a feature don't exist, ask.

**Naming note:** Section 8 index = "Set-Up Operations" (folder `8. System settings`),
not the System Settings screen (doc `8.3`).

**Truncated images** Some .png images within the md folders are truncated to the right.
For these there is a .jpg with the same name that is a screenshot of the manual.
Make sure you look at the .jpg for the complete image.

**Unreadable images** If an image is too small or blurry to read, ask the user for a
clearer version rather than guessing at the content.

### Legacy Beacon source — `docs/FromBeacon/`

Selected files from the original codebase. Ask user to add missing files.

---

## Testing — run after every code change

```bash
cd backend && npm test    # vitest --run
cd frontend && npm test   # vitest --run
```

If tests fail: read the error, fix the cause, re-run. Do not report success until green.
See `CLAUDE-REFERENCE.md` §12 for test architecture and patterns.

**Docs-only changes do not need tests.** If a session only touches documentation files
(`*.md`, `docs/`, `CHANGELOG.md`, `KNOWN-ISSUES.md`, etc.) with no code changes, skip
running the test suites.

---

## Deferred items

Any time work is deferred or descoped, add it to `KNOWN-ISSUES.md` with enough context
to pick it up later (what, why deferred, relevant doc refs).

---

## Session wrap-up

**This step is mandatory and must be in your TodoWrite list from the start of every session.**

Add a todo item — "Update project docs if anything new was learned" — at session start
alongside your other planned tasks. Mark it complete only after explicitly checking.

At the end of every session:
1. Review what was built or fixed.
2. If anything new/non-obvious was encountered:
   - **Module-specific** implementation details → add to `CLAUDE-REFERENCE.md` under the
     appropriate section.
   - **Cross-cutting** rules or patterns → add to `CLAUDE-STANDARDS.md`.
   - **Workflow/session** changes → update this file (`CLAUDE.md`).
3. If any features were added, changed, or fixed, update `docs/BeaconUG-Comparison.md`
   to reflect the new status of the relevant UG section(s).
4. **Update `CHANGELOG.md`** — add bullet points under the current version for any
   features added, changed, or fixed during this session. Group entries under
   `### Added`, `### Changed`, or `### Fixed` headings. If the current version
   section doesn't exist yet, create it with today's date.
5. Commit and push the updated file(s) along with code changes.
6. **Tell the user** what was updated (or "No documentation update needed this session").

---

## Styling — see `CLAUDE-STANDARDS.md` and `CLAUDE-REFERENCE.md` §11

All frontend uses **Tailwind CSS v3** exclusively. Common patterns, shared components,
and the RoleEditor colour exception are documented in the reference file.

---

## Database, SQL, and migrations — see `CLAUDE-REFERENCE.md` §§1, 3

Key gotchas: idempotent DDL, explicit PostgreSQL casts (`::date`, `::time`, `::numeric`),
no semicolons in SQL comments. All detailed in the reference file.

