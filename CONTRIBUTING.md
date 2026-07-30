# Contributing to beacon2026

Thanks for your interest in beacon2026. This guide covers how to get set up, the
conventions the codebase follows, and how changes are reviewed.

> **Note:** Much of beacon2026's development is carried out through Claude Code
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
- Spell **u3a** in lowercase. The new system is **beacon2026**; the original is
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

## Linting & formatting

- Both packages use ESLint 9 (flat config) and Prettier. Before opening a PR:
  ```bash
  cd backend  && npm run lint && npm run format:check
  cd frontend && npm run lint && npm run format:check
  ```
- `npm run lint:fix` and `npm run format` auto-fix most issues. CI runs `lint`
  and `format:check` for both packages, so they must pass.
- Lint must be error-free. `react-hooks/exhaustive-deps` is configured as a
  warning; fix it where practical.

## New pages & privileges

Every new page must use its own named privilege resource — never reuse
`settings:view`. The four steps are:

1. Add the resource to `backend/src/seed/privilegeResources.js`.
2. Grant it to roles in `backend/src/seed/defaultRoles.js` (Administration always
   gets it).
3. Add it to `ALL_PRIVS` in `backend/src/__tests__/helpers.js`.
4. Enforce it: `requirePrivilege` on the backend route, `can` in the frontend
   guard.

Privileges are auto-seeded on every startup, so no manual migration step is
needed.

## Documentation

beacon2026 keeps several living documents up to date alongside code:

- `CHANGELOG.md` — add an entry under the current version for any user-facing
  change (`### Added` / `### Changed` / `### Fixed`).
- `KNOWN-ISSUES.md` — record anything deferred, with enough context to pick it
  up later. Items carry a `[OPEN]` / `[ACCEPTED]` / `[DEFERRED]` status tag.
- `docs/BeaconUG-Comparison.md` — update when a feature changes.

## Licensing

This project is **proprietary** — see the root [`LICENSE`](LICENSE). The code is
**all rights reserved** by the project owner; do not reuse it outside this
project without prior written consent.

Original Beacon reference material under [`docs/FromBeacon/`](docs/FromBeacon/)
is third-party copyright and is included for reference only — see
[`docs/FromBeacon/README.md`](docs/FromBeacon/README.md). To report a security
issue, see [`SECURITY.md`](SECURITY.md).
