# Beacon2

Modern rebuild of the Beacon u3a management system.

## Structure

```
beacon2/
  backend/    Node.js + Express API
  frontend/   React UI (Vite)
```

## Quick start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Backend

```bash
cd backend
cp .env.example .env          # fill in your values
npm install
npx prisma migrate dev        # creates system-level tables
npm run db:seed               # creates first system admin (see seed/index.js)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at http://localhost:5173 and proxies API calls to http://localhost:3001.

## Creating a u3a tenant

Once the backend is running, use the system admin credentials to POST to `/system/tenants`:

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

This creates the database schema, seeds all privilege resources, seeds the 5 default roles, and creates the first admin user.

## Architecture notes

- **Multi-tenancy:** each u3a has its own PostgreSQL schema (`u3a_<slug>`). Isolation is enforced at the database level.
- **Auth:** short-lived JWT access tokens (15 min) in memory + long-lived refresh tokens in httpOnly cookies.
- **Privileges:** embedded in the JWT at login. When roles change, affected sessions are invalidated via Redis.
- **Roles:** fully configurable per u3a. Names, committee flag, and privilege sets can all be changed.

## Modules implemented so far

- [x] Authentication (login, logout, token refresh)
- [x] Users (CRUD, role assignment)
- [x] Roles (CRUD)
- [x] Privileges (full matrix, per-role)
- [x] System admin (tenant management)

## Next modules (in suggested order)

1. Members
2. Groups
3. Finance
4. Email
5. Data migration from Beacon
