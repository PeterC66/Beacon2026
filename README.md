# Beacon2

Modern rebuild of the [Beacon](https://www.u3abeacon.org.uk/) u3a management system —
a multi-tenant web app for running u3a groups across the UK.

## Project structure

```
beacon2/
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
├── frontend/                  React 18 + Vite 5 + Tailwind CSS 3
│   ├── src/
│   │   ├── App.jsx            Route tree
│   │   ├── context/           AuthContext (in-memory token)
│   │   ├── lib/               api.js (auto token refresh)
│   │   ├── components/        PageHeader  NavBar  SortableHeader  DateInput
│   │   ├── hooks/             useSortedData  usePreferences  useUnsavedChanges
│   │   ├── pages/             Login  Home  members/*  groups/*  finance/*
│   │   │                      email/*  settings/*  admin/*  misc/*
│   │   │                      public/*  calendar/*  ...
│   │   └── __tests__/        vitest + React Testing Library smoke tests
│   └── vite.config.js         also used as vitest config
│
├── e2e/                       Playwright end-to-end tests
│
├── docs/
│   ├── Beacon2UG/             Beacon2 User Guide (64 sections, Markdown)
│   ├── BeaconUG/              Beacon User Guide pages (Markdown + images)
│   └── FromBeacon/            Selected files from the original Beacon codebase
│
├── .github/workflows/ci.yml   Runs backend + frontend tests on every push
├── render.yaml                Render blueprint (backend + Postgres)
├── DEPLOYMENT.md              Step-by-step deployment guide (Render + Vercel)
├── CLAUDE.md                  Instructions for Claude Code (session workflow)
├── CLAUDE-STANDARDS.md        Cross-cutting development checklist
└── CLAUDE-REFERENCE.md        Detailed implementation notes by module
```

## Quick start (local development)

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+ *(optional — only needed if `USE_REDIS=true`)*

### Backend

```bash
cd backend
cp .env.example .env          # fill in your values
npm install
npx prisma migrate dev        # creates system-level tables
npm run db:seed               # creates first system admin
npm run dev                   # starts on http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # starts on http://localhost:5173
```

The frontend expects the API at `VITE_API_URL` (defaults to `http://localhost:3001`).

## Tests

```bash
cd backend  && npm test   # vitest — no real DB required (fully mocked)
cd frontend && npm test   # vitest + React Testing Library smoke tests
cd e2e      && npm test   # Playwright against staging (needs .env)
```

CI runs backend + frontend tests automatically on every push to a `claude/**` branch.

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

This creates the tenant's PostgreSQL schema (`u3a_oxfordshire`), seeds all privilege
resources, creates the five default roles, and sets up the first admin user.

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

See [DEPLOYMENT.md](DEPLOYMENT.md) for a step-by-step guide to deploying on
Render (backend + Postgres) and Vercel (frontend) — no command-line knowledge needed.

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
- [x] Data export & backup / restore (Beacon2 + legacy Beacon format)
- [x] Polls (setup, member assignment)
- [x] System settings
- [x] Feature configuration (per-u3a module and sub-feature toggles)
- [x] System messages (auto-sent email templates)
- [x] Public links (online joining toggle, portal URLs)
- [x] Public pages (groups list, calendar — unauthenticated)
- [x] Members Portal (self-service: login, groups, calendar, personal details, online renewal, card request)
