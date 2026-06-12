# Contributing to Beacon2

Thanks for your interest in Beacon2. This guide covers how to get set up, the
conventions the codebase follows, and how changes are reviewed.

> **Note:** Much of Beacon2's development is carried out through Claude Code
> sessions. `CLAUDE.md`, `CLAUDE-STANDARDS.md`, and `CLAUDE-REFERENCE.md` are
> tooling for those sessions — this file (and `README.md`) is the entry point
> for human contributors. The conventions below are the same ones the AI
> sessions follow.

## Getting started

1. See [`README.md`](README.md) for the quick-start (backend, frontend, tests).
2. Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` →
   `frontend/.env`, then fill in the values.
3. Run the test suites to confirm a clean baseline:
   ```bash
   cd backend  && npm test
   cd frontend && npm test
   ```

## Branching & commits

- All work goes on a branch — never push directly to `main`.
- AI-session branches start with `claude/`; human branches should be
  descriptive (`fix/email-tenant-scope`, `feature/portal-card-request`).
- Keep mechanical changes (e.g. a lint/format pass) in their own commit,
  separate from logic changes.
- Write clear, imperative commit messages describing the *why*.

## Coding conventions

- **ES modules** throughout (`import`/`export`) — never `require()`.
- **Validate every request body with [Zod](https://zod.dev)** before processing.
- **Never** build SQL with string concatenation — always parameterised queries.
- All tenant database access goes through `tenantQuery()` or `withTenant()` in
  `backend/src/utils/db.js`. On authenticated routes the tenant comes from
  `req.user.tenantSlug`.
- The frontend access token is held **in memory only** — never `localStorage`
  or `sessionStorage`.
- Frontend styling is **Tailwind CSS v3** exclusively.
- Never define a React component inside another component (it remounts on every
  render) — use a plain render function or a top-level component.
- Spell **u3a** in lowercase. The new system is **Beacon2**; the original is
  **Beacon**.

See [`CLAUDE-STANDARDS.md`](CLAUDE-STANDARDS.md) for the full cross-cutting
checklist and [`CLAUDE-REFERENCE.md`](CLAUDE-REFERENCE.md) for module-level
implementation notes.

## Tests

- Run `npm test` in both `backend/` and `frontend/` before opening a PR; both
  must be green.
- Backend tests mock Prisma, so SQL is not executed in CI — end-to-end SQL
  behaviour is covered by the Playwright suite in `e2e/`.
- Add a test for every new backend endpoint and for non-trivial frontend
  behaviour.
- Documentation-only changes (`*.md`, `docs/`) don't need the test suites.

## New pages & privileges

Every new page must use its own named privilege resource (never reuse
`settings:view`). The four-step process is documented in `CLAUDE.md` under
"Privileges for new functionality".

## Documentation

Beacon2 keeps several living documents up to date alongside code:

- `CHANGELOG.md` — add an entry under the current version for any user-facing
  change (`### Added` / `### Changed` / `### Fixed`).
- `KNOWN-ISSUES.md` — record anything deferred, with enough context to pick it
  up later. Items carry a `[OPEN]` / `[ACCEPTED]` / `[DEFERRED]` status tag.
- `docs/BeaconUG-Comparison.md` — update when a feature changes.

## Licensing

A repository LICENSE has not yet been finalised (see `KNOWN-ISSUES.md`). Until
one is added, treat the code as **all rights reserved** by the project owner and
check before reusing it outside this project.
