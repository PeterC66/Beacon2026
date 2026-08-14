# beacon2026

Modern rebuild of the [Beacon](https://www.u3abeacon.org.uk/) u3a management system — a multi-tenant web app for running u3a groups across the UK.

> **For human contributors:** this `README.md` and [`CONTRIBUTING.md`](CONTRIBUTING.md) are the entry points for people. The `CLAUDE*.md` files (`CLAUDE.md`, `CLAUDE-STANDARDS.md`, `CLAUDE-REFERENCE.md`, `CLAUDE-E2E.md`) are tooling for Claude Code sessions, not primary documentation — read them only if you want to understand how the AI-assisted workflow operates.

## What beacon2026 is (plain-language overview)

beacon2026 is a web application that u3a organisations use to run their membership, groups, finances, and communications. Each u3a gets its own private, isolated area within one shared system ("multi-tenant"), so many u3as can be hosted together at low cost.

- **Who uses it:** a u3a's own volunteers — membership secretary, treasurer, group coordinators — through an ordinary web browser. There is nothing to install. Members themselves can join and renew online through a self-service portal.
- **Where it runs / what it costs:** it deploys to low-cost cloud hosting. A proof-of-concept runs on free tiers; a stable production setup is roughly £12/month plus an optional domain name. See [DEPLOYMENT.md](DEPLOYMENT.md).
- **Status:** feature-complete against the original Beacon and working end-to-end, but currently a demonstration/proof-of-concept — see the table below and [SECURITY.md](SECURITY.md) before putting real member data into it.

### Status at a glance

| Area | Status |
|------|--------|
| Membership, Groups, Finance, Email & Letters | Built |
| Online joining, Members Portal, online renewals | Built |
| Administration: roles & privileges, audit log, backup/restore | Built |
| **Production readiness** | Proof-of-concept — works end-to-end; review [DEPLOYMENT.md](DEPLOYMENT.md) before real data |
| **Independent security audit / penetration test** | Not yet done (see [SECURITY.md](SECURITY.md)) |
| **User-guide screenshots** | Outstanding — guide text is complete |

For the authoritative feature inventory, see [`beacon2026 Project Definition.md`](beacon2026%20Project%20Definition.md).

## Project structure

```
beacon2026/
├── backend/                   Node.js 20 + Express 4 API
│   ├── src/
│   │   ├── server.js          Entry point (migrate → seed → listen)
│   │   ├── app.js             Pure Express app (imported by tests)
│   │   ├── routes/            auth  users  roles  members  groups  finance
│   │   │                      settings  polls  backup  email  venues  ...
│   │   ├── middleware/        auth  requirePrivilege  errorHandler
│   │   ├── services/          authService
│   │   ├── utils/             db  jwt  password  redis  migrate  audit
│   │   ├── seed/              system admin + per-tenant defaults
│   │   └── __tests__/        vitest + supertest (no real DB needed)
│   ├── prisma/                system schema + tenant DDL
│   └── vitest.config.js
│
├── frontend/                  React 18 + Vite + Tailwind CSS 3
│   ├── src/
│   │   ├── App.jsx            Route tree
│   │   ├── context/           AuthContext (in-memory token)
│   │   ├── lib/               api.js (auto token refresh)
│   │   ├── components/        PageHeader  NavBar  SortableHeader  DateInput
│   │   ├── hooks/             useSortedData  usePreferences  useUnsavedChanges
│   │   ├── pages/             Login  Home  members/*  groups/*  finance/*
│   │   │                      email/*  settings/*  admin/*  audit/*
│   │   │                      officers/*  public/*  calendar/*  ...
│   │   └── __tests__/        vitest + React Testing Library smoke tests
│   └── vite.config.js         also used as vitest config
│
├── e2e/                       Playwright end-to-end tests
│
├── docs/
│   ├── beacon2026UG/             beacon2026 User Guide (64 sections, Markdown)
│   ├── BeaconUG/              Beacon User Guide pages (Markdown + images)
│   ├── FromBeacon/            Selected files from the original Beacon codebase
│   └── history/              Archived 2026-06 review docs (read-only)
│
├── docker-compose.yml         Local full-stack (Postgres + Redis + apps)
├── compose.prod.yaml          Production VPS stack (see docs/DEPLOY-VPS.md)
├── .github/workflows/ci.yml   Runs backend + frontend lint, format, tests
├── render.yaml                Render blueprint — POC/fallback path, not production
├── DEPLOYMENT.md              Step-by-step no-CLI deployment guide (Render + Vercel POC)
├── CLAUDE.md                  Instructions for Claude Code (session workflow)
├── CLAUDE-STANDARDS.md        Cross-cutting development checklist
└── CLAUDE-REFERENCE.md        Detailed implementation notes by module
```

> For the full module/route/page inventory, see [`beacon2026 Project Definition.md`](beacon2026%20Project%20Definition.md) — this tree is a quick orientation map; that document is the authoritative detail.

## Quick start (local development)

### Prerequisites

- Node.js 20+ *(CI builds and tests on Node 22)*
- PostgreSQL 15+
- Redis 7+ *(optional — only needed if `USE_REDIS=true`)*

### Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL, JWT secrets, SEED_ADMIN_*
npm install
npm run build                 # prisma generate — creates the Prisma client
npm run dev                   # pushes schema + seeds first admin, then serves on :3001
```

On startup the server runs `prisma db push` and seeds the first system admin automatically (from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) — no separate migrate/seed step is needed. To run those manually instead, use `npm run db:migrate` and `npm run db:seed`.

### Frontend

```bash
cd frontend
cp .env.example .env          # optional — VITE_API_URL defaults to :3001
npm install
npm run dev                   # starts on http://localhost:5173
```

The frontend expects the API at `VITE_API_URL` (defaults to `http://localhost:3001`).

### Run the whole stack with Docker (optional)

Instead of installing Postgres/Redis and running each service by hand, the repo ships a `docker-compose.yml` that brings up Postgres, Redis, the backend, and the frontend together — handy for a quick demo or for running the E2E suite locally:

```bash
docker compose up --build       # http://localhost:5173 (frontend), :3001 (API)
docker compose down -v          # stop and wipe the database volume
```

All credentials in `docker-compose.yml` are throwaway local-only values; the stack is for development only and is never used to deploy a real instance.

## Tests

```bash
cd backend  && npm test            # vitest — no real DB required (fully mocked)
cd frontend && npm test            # vitest + React Testing Library smoke tests
cd e2e      && npm test            # Playwright (staging, or the local docker stack)
```

Add coverage with `npm run test:coverage` in `backend/` or `frontend/` — it writes an HTML report to `coverage/` and prints a summary. The E2E suite can target staging or the local docker stack above (see `e2e/.env.example`).

CI runs backend + frontend lint, format check, and tests (with coverage uploaded as an artifact) on every push to a `claude/**` branch and on PRs to `main`.

## Creating a u3a tenant

Log in to the system admin UI at `/system/login`, or POST directly:

```bash
curl -X POST http://localhost:3001/system/tenants \
  -H "Authorization: Bearer <sys_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Oxfordshire u3a",
    "slug": "oxfordshire",
    "adminEmail": "admin@oxfordshireu3a.org",
    "adminUsername": "admin",
    "adminName": "Site Administrator",
    "adminPassword": "change-me-immediately"
  }'
```

This creates the tenant's PostgreSQL schema (`u3a_oxfordshire`), seeds all privilege resources, creates the five default roles, and sets up the first admin user.

## Architecture

| Concern | Approach |
|---|---|
| **Multi-tenancy** | Each u3a gets its own PostgreSQL schema (`u3a_<slug>`). All tenant queries go through `tenantQuery()` in `utils/db.js`. |
| **Auth** | Short-lived JWT access tokens (15 min, in memory) + long-lived refresh tokens in httpOnly cookies. |
| **Privileges** | Embedded in the JWT at login. Role changes invalidate affected sessions via Redis (or expire naturally). |
| **Roles** | Fully configurable per u3a — names, committee flag, and privilege sets can all be edited. |
| **Validation** | All request bodies validated with Zod before any DB access. |
| **SQL** | Parameterised queries only — never string concatenation. |
| **Email** | SendGrid — token substitution, attachments, delivery tracking. |
| **Export** | ExcelJS (spreadsheets), PDFKit (labels/reports). |

## Deployment

**Production** runs on a dedicated OVHcloud VPS (single origin behind Caddy) — see
[`docs/DEPLOY-VPS.md`](docs/DEPLOY-VPS.md) for the runbook and
[`beacon2026-ovhcloud-vps-recommendation.md`](../beacon2026-ovhcloud-vps-recommendation.md)
(PDC notes folder, outside this repo) for the migration rationale.

For a free, no-command-line POC deployment (Render + Vercel), see
[DEPLOYMENT.md](DEPLOYMENT.md) — kept in the repo as a documented fallback path for
u3a volunteers without server access, not what production actually runs on.

## Modules implemented

- [x] Authentication (username login, token refresh, inactivity timeout)
- [x] System admin UI (tenant CRUD, restore from backup with venues + group ledger, set-temp-password with forced password change)
- [x] Users (CRUD, role assignment, username-based)
- [x] Roles (CRUD, privilege matrix editor)
- [x] Privileges (full resource × action matrix, per role)
- [x] Members (list, record, add, partner/address sharing, validation)
- [x] Member classes and statuses (CRUD, monthly fee grid)
- [x] Membership renewals and non-renewals (bulk operations)
- [x] Membership cards (PDF generation, email, mark-as-printed)
- [x] Recent members and statistics
- [x] Addresses export and label printing
- [x] Groups (list, record, members, schedule, ledger, venues, faculties)
- [x] Teams (list, record, members, schedule, ledger)
- [x] Calendar, event types, event attendance, and event financials
- [x] Finance (accounts, categories, ledger, transactions, transfers, reconciliation, gift aid on transactions)
- [x] Credit batches (with batch date, description, detailed transaction management)
- [x] Financial statement and groups statement
- [x] Gift Aid (declaration + log)
- [x] Email (compose, templates, delivery tracking, unblocker)
- [x] Letters & documents (compose, standard templates, PDF download)
- [x] Audit log
- [x] u3a Officers
- [x] Personal preferences (display, password, security Q&A)
- [x] Data export & backup / restore (beacon2026 + legacy Beacon format)
- [x] Polls (setup, member assignment)
- [x] System settings
- [x] Feature configuration (per-u3a module and sub-feature toggles)
- [x] System messages (auto-sent email templates)
- [x] Public links (online joining toggle, portal URLs)
- [x] Public pages (groups list, calendar — unauthenticated)
- [x] Members Portal (self-service: login, groups, calendar, personal details, online renewal, card request)

