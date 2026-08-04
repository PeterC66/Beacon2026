# beacon2026 — Claude Code Instructions

> **For humans:** this file and the other `CLAUDE-*.md` files are tooling for
> Claude Code sessions, not the project's primary documentation. If you are a
> human contributor, start with [`README.md`](README.md) and
> [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Documentation structure

| File | Purpose | When to read |
|------|---------|--------------|
| **This file (`CLAUDE.md`)** | Session setup, workflow rules, key conventions | Every session (auto-loaded) |
| **`CLAUDE-STANDARDS.md`** | Cross-cutting checklist for all new code | Before starting any implementation |
| **`CLAUDE-REFERENCE.md`** | Detailed implementation notes by module | When working on a specific module |
| **`CLAUDE-E2E.md`** | E2E test architecture, patterns, and gotchas | When writing or debugging E2E tests |
| **`beacon2026 Project Definition.md`** | What has been built and what remains | Every session — living document |
| **`docs/BeaconUG-Comparison.md`** | beacon2026 vs Beacon User Guide comparison | When building/changing features — update after each change |
| **`docs/beacon2026UG/index.md`** | beacon2026 User Guide (64 sections) | When writing user-facing help or verifying feature descriptions |
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

Read `beacon2026 Project Definition.md` at the start of every session.

## If a document is not in your branch

If the user refers to a document you cannot find, run `git fetch origin main` and
`git merge origin/main --no-edit` first. If still missing, ask the user.

---

## Development branch

All work goes on a branch whose name starts with `claude/`. Never push directly to `main`.

**Start every new task/PR from a fresh branch off current `origin/main`** —
never branch off an existing `claude/*` branch, and never keep adding new work
to a branch whose PR has already merged:

```bash
git fetch origin main
git checkout -b claude/short-task-name origin/main
```

PRs here are squash-merged, so a merged branch never shows as "merged" by SHA
ancestry — reusing it (or repeatedly merging `main` back into it) causes real
duplication: changes get silently re-applied or revert earlier fixes, not just
a cosmetic "ahead of main" count. (This happened for real on 2026-08-01 with
PRs #464/#465, which re-applied and dropped CHANGELOG content.)

After a PR merges, delete the branch both locally and on GitHub
(`git branch -D <branch>` / `gh pr merge --delete-branch`, or the "Delete
branch" button on the merged PR) before starting the next one.

**If PR B references a file added by unmerged PR A, merge A first.** Branching
fresh off `origin/main` (correctly) means B does not contain A's files, so any
link or code comment in B pointing at them dangles until A lands. This happened
on 2026-08-01: `docs/API-design.md` (#472) was referenced from ten places in the
phase-1 implementation (#473). Merging in order fixed it with no code change —
but merging B first would have shipped ten broken references, including two
Markdown links that 404 on GitHub. Check for cross-PR references before merging,
not after.

The "if a document is missing" flow below (`git merge origin/main --no-edit`)
is only for pulling newly-uploaded reference docs into the *current* branch
mid-task — it is not a substitute for starting the *next* task from a fresh
branch.

**Independent same-day PRs that each update a shared status doc (a work-plan
table, `CHANGELOG.md`) will conflict on merge even with zero overlapping code
files.** Each branch's diff inserts a new line at the same anchor point (the
next-blank-line in a status table, the next bullet under the same `###
Changed` heading) — pure independent insertions at the same location are a
textbook git merge conflict, not something `git merge`'s three-way algorithm
resolves silently. Expect this whenever multiple `claude/*` branches are
prepared from the same session's work-plan doc and merged back-to-back. Fix:
after merging the first PR, `git checkout` each remaining branch, `git merge
origin/main --no-edit`, resolve by keeping both sides' content (the doc
sections themselves — the "Built:" prose paragraphs — auto-merge fine; only
the table-row / bullet-insertion point conflicts), then push and merge as
normal. (Hit for real 2026-08-04 merging PRs #508/#509/#510, all editing
`docs/UX-Improvements-Plan-2026-08-04.md`'s status table and
`CHANGELOG.md`'s `### Changed` section.)

---

## Reviewing the codebase (lessons from past reviews)

When doing a full code/documentation review, **verify every subagent finding by
hand before reporting or acting on it.** Past reviews using Explore subagents
produced confident-sounding *false positives* — e.g. "function X is undefined →
runtime crash" (it was a hoisted declaration later in the same file) and "most
routes lack Zod validation" (they all validate; the schemas were just inline).
Grep for the symbol / read the file before trusting a "missing" or "broken"
claim. The codebase is more mature than a surface scan implies, so headline
alarms deserve extra scepticism. The most recent independent review and its
chunked work plan live in `docs/ImprovementPlan-2026-06-14.md`.

**Working through the open backlog** (not a fresh review — sequencing what's
already in `KNOWN-ISSUES.md`) is tracked in
`docs/Beacon2026-Tidying-Plan.md`. Check it at session start if picking up
backlog work; update its Status column as items land, and keep it in sync
with `KNOWN-ISSUES.md` (the plan sequences items, `KNOWN-ISSUES.md` remains
the source of truth for what each item actually is).

---

## Key conventions

- **Challenge the user's approach** if an implementation would be difficult, fragile,
  or over-engineered. Ask whether a simpler alternative would meet the requirement
  before building something complex — the user welcomes being pushed back on.
- Always spell **u3a** in lowercase
- The system is called **beacon2026**; the original system is **Beacon**
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

The migration system auto-seeds privileges on every startup. (This process is also
documented for human contributors in `CONTRIBUTING.md` → "New pages & privileges".)

### Gate access with privileges, not hard-coded role/flag checks

**Default to a privilege, granted by default to the appropriate role(s) —
never hard-code `req.user.isSiteAdmin` or a role-name string as the actual
access check for a new feature.** A privilege is inspectable (Roles and
Privileges screen), independently grantable to a custom role later, and
consistent with how every other feature in the app is gated. A hard-coded
check bypasses all of that silently.

- **Tenant-wide "manage everything" access** for a resource → a normal
  `resource:action` privilege granted to **Administration** by default
  (`defaultRoles.js`), exactly like any other privilege — not an
  `isSiteAdmin` check. (Standard Emails/Letters ownership, added
  2026-08-03, uses this: `email_standard_messages_all` /
  `letters_standard_messages_all`, granted to Administration.)
- **Access scoped to "groups/teams this specific user leads"** → the
  `*_as_leader` privilege pattern already established for the group/team
  Ledger tab (`backend/src/routes/groups/ledger.js` `hasLedgerAccess`):
  grant the `_as_leader` privilege to the **Group Leaders** / **Team
  Leaders** roles by default, then check it *plus* a runtime lookup
  (`users.member_id` → `group_members.is_leader` → the specific
  `group_id` in question) — never just the privilege alone, since the
  privilege only proves the role, not leadership of *that* group.

**The one existing exception is SQL Reports**
(`backend/src/routes/reports.js`, `requireSiteAdmin`): creating/editing/
deleting saved reports and running ad-hoc SQL are hard-gated on
`req.user.isSiteAdmin` rather than a delegable privilege, because the
person doing it is writing raw SQL against the tenant's own database — a
single mistake or a compromised low-privilege account could expose the
whole tenant. **Do not add another `isSiteAdmin`-gated feature without
asking the user first** — it's a deliberate, narrow carve-out, not a
precedent to extend by default.

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

## Linting & formatting — run before committing code

```bash
cd backend  && npm run lint && npm run format:check
cd frontend && npm run lint && npm run format:check
```

ESLint 9 (flat config, `eslint.config.js`) and Prettier (root `.prettierrc.json`)
are configured in both packages. CI (`ci.yml`) runs `lint` and `format:check` for
each, so both must pass. Use `npm run lint:fix` and `npm run format` to auto-fix.

### `format:check` on Windows reports ~146 false failures — do not "fix" them

`.prettierrc.json` sets `endOfLine: "lf"`, but a Windows checkout with
`core.autocrlf=true` has CRLF in the working tree. Prettier therefore flags
**every file it checks** (~146: `backend/src`, `frontend/src`, `shared`) on line
endings alone. It looks like the codebase is catastrophically unformatted. It is
not, and CI (Linux, LF) passes fine.

**Never run `npm run format` to clear it** — that rewrites ~146 untouched files
and buries your actual change in the diff.

To check only the files you touched, compare with line endings normalised on
**both** sides — prettier's own output is not reliably LF here either, and
normalising only the input produces false "differs" results:

```bash
diff <(tr -d '\r' < path/to/file.js) <(npx prettier path/to/file.js | tr -d '\r')
```

No output means the file is correctly formatted and differs only by line
endings. For files you created in this session (already LF), plain
`npx prettier --check <file>` works normally.

Note `format:check` globs only `src/**/*.js(x)` and `shared/**/*.js` — root
Markdown (`CLAUDE*.md`, `README.md`, `docs/`) is not checked by CI at all.
Lint must be **error-free**; `react-hooks/exhaustive-deps` is a warning only.
The frontend deliberately stays on `eslint-plugin-react-hooks` **v5** — do not
upgrade to v7 without budgeting for the refactors its new rules require (see
`KNOWN-ISSUES.md` → Linting & tooling).

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
   - Also update **`beacon2026 Project Definition.md`** if the change altered the
     module/route/page inventory. To bump the version, run
     `npm run bump-version -- <x.y.z>` from the repo root — it updates both
     `package.json` files, refreshes both `package-lock.json` files, and
     updates the version line in the Project Definition doc together.
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

