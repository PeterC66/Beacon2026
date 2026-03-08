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
│   │   ├── routes/            auth  users  roles  privileges  system
│   │   ├── middleware/        auth  requirePrivilege  errorHandler
│   │   ├── services/          authService
│   │   ├── utils/             db  jwt  password  redis  migrate
│   │   ├── seed/              system admin + per-tenant defaults
│   │   └── __tests__/        vitest + supertest (no real DB needed)
│   ├── prisma/                system-level schema (SysTenant, SysAdmin)
│   └── vitest.config.js
│
├── frontend/                  React 18 + Vite 5 + Tailwind CSS 3
│   ├── src/
│   │   ├── App.jsx            Route tree
│   │   ├── context/           AuthContext (in-memory token)
│   │   ├── lib/               api.js (auto token refresh)
│   │   ├── components/        PageHeader  NavBar  BeaconLogo
│   │   ├── pages/             Login  Home  users/*  roles/*  system/*
│   │   └── __tests__/        vitest + React Testing Library smoke tests
│   └── vite.config.js         also used as vitest config
│
├── docs/
│   ├── BeaconUG/              Beacon User Guide pages (Markdown + images)
│   └── FromBeacon/            Selected files from the original Beacon codebase
│
├── .github/workflows/ci.yml   Runs backend + frontend tests on every push
├── render.yaml                Render blueprint (backend + Postgres)
├── DEPLOYMENT.md              Step-by-step deployment guide (Render + Vercel)
└── CLAUDE.md                  Instructions for Claude Code
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
```

CI runs both suites automatically on every push to a `claude/**` branch via
`.github/workflows/ci.yml`.

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
| **Privileges** | Embedded in the JWT at login. Role changes invalidate affected sessions via Redis (or expire naturally after 15 min if Redis is disabled). |
| **Roles** | Fully configurable per u3a — names, committee flag, and privilege sets can all be edited. |
| **Validation** | All request bodies validated with Zod before any DB access. |
| **SQL** | Parameterised queries only — never string concatenation. |

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for a step-by-step guide to deploying on
Render (backend + Postgres) and Vercel (frontend) — no command-line knowledge needed.

## Modules implemented

- [x] Authentication (login, logout, token refresh)
- [x] System admin UI (tenant create / activate / deactivate)
- [x] Users (CRUD, role assignment)
- [x] Roles (CRUD, privilege matrix editor)
- [x] Privileges (full resource × action matrix, per role)

## Next modules (suggested order)

1. Members
2. Groups
3. Finance
4. Email
5. Data migration from Beacon
