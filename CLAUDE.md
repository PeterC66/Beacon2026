# Beacon2 — Claude Code Instructions

## Session startup

At the start of every session, run:

```bash
git fetch origin main
git merge origin/main --no-edit
```

This ensures that any files uploaded directly to `main` (design docs, prompts,
reference material in `docs/`) are present in the working branch before starting work.

## Project task description

The full project brief is at `docs/FromBeacon/CLAUDE_CODE_PROMPT.md`. Read it at the
start of any session where you are unsure what to build next.

## Development branch

All work goes on a branch whose name starts with `claude/`. Never push directly to `main`.

## Key conventions

- Always spell **u3a** in lowercase
- The system is called **Beacon2**; the original system is **Beacon**
- Use ES modules (`import`/`export`) throughout — never `require()`
- Frontend access token is stored **in memory only** — never localStorage or sessionStorage
- All tenant database queries must go through `tenantQuery()` or `withTenant()` in `backend/src/utils/db.js`
- Validate all request bodies with **Zod** before processing
- Never construct SQL with string concatenation — always use parameterised queries
- Always, before you start, ask any questions one by one, until you are 95% certain that you can carry out this task.
