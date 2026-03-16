# Beacon2 Project Definition

## What you are building

You are building **Beacon2**, a modern full-stack web application that replaces an existing
system called **Beacon** — a management platform used by u3a organisations in the UK.

A **u3a** (which used to be called university of the third age but we no longer use that phrase) is a community organisation for retired and
semi-retired people, offering learning and social activities. Each u3a has members,
groups (activity classes), a committee, finances, and so on.

Beacon2 is a ground-up rebuild of the existing Beacon system with the following goals:
- Modernise the codebase to make it easier to maintain and extend
- Improve the architecture, particularly around multi-tenancy and security
- Keep all the functionality of the existing system
- Make it suitable for a small development team to work on

---

## Critical terminology

- Always spell **u3a** in lowercase — never U3A
- The system is called **Beacon2**
- The original system is called **Beacon**

---

## Multi-tenancy — the most important architectural principle

Beacon2 serves **many independent u3a organisations**. Each u3a must feel as though
they are the only user of the system. Their data must be completely isolated from all others.

This is called **multi-tenancy**. It shapes every decision in the system.

**Implementation:** Use a **schema-per-tenant** approach in PostgreSQL.
- Each u3a gets its own PostgreSQL schema, named `u3a_{slug}` (e.g. `u3a_oxfordshire`)
- All of that u3a's tables live inside their schema
- A shared `public` schema holds system-level tables (tenant registry, system admins)
- The application sets `search_path` to the correct tenant schema at the start of each
  request, based on the tenant slug embedded in the user's JWT
- Every API endpoint must validate tenant scope — this must be enforced at middleware
  level, not left to individual route handlers

---

## Access tiers

There are three distinct tiers of access:

### 1. System tier
- Beacon2 platform operators only
- Can create, suspend, and delete u3a tenants
- Has access to cross-tenant diagnostics and system configuration
- Never exposed within a u3a's own interface
- Protected by both authentication and (in production) IP allowlist
- Separate login endpoint: `POST /auth/system/login`

### 2. u3a Admin tier
- Site Administrator within a single u3a
- Manages all users, roles, and privileges for their u3a
- Accesses all modules they hold privileges for
- Configures u3a-level settings

### 3. Member / Officer tier
- Any user within a u3a
- Can only access the parts of the system their assigned roles permit
- May hold one or more roles simultaneously

---

## Roles and Privileges model

This is core to how Beacon works and must be replicated faithfully.

**Roles** are essentially job titles (e.g. "Treasurer", "Group Leader").
**Privileges** determine what a user can see and do.
Privileges are assigned to Roles, not directly to people.

### Key rules:
- A user may hold **multiple roles** — their effective privileges are the **union** of all roles
- Roles are **fully configurable** per u3a — name, committee flag, and privilege set can all be changed
- A role can be flagged as a **committee role** (affects reporting, not functionality)
- The privilege to **view** a resource is a prerequisite for create, change, or delete
- Always assign the **minimum privileges necessary** (principle of least privilege)

### Group-scoped privileges:
Some privileges apply differently based on the user's relationship to a group:
- **all** — can access records for any group
- **as leader** — can only access groups where they are the leader
- **as member** — can only access groups where they are a participant

### Default roles (seeded when a new u3a is created):
| Role | Committee role |
|---|---|
| Administration | No |
| Group Leaders | No |
| Groups Coordinator | No |
| Membership Secretary | Yes |
| Treasurer | Yes |

These are defaults only — all are fully editable by the u3a administrator.

### Complete privilege resource list:
Each resource has a set of possible actions: view, create, change, delete, and/or "other"
actions (download, send, reconcile, etc.)

| Resource | Actions |
|---|---|
| Address labels | view, download |
| Addresses export | view, download |
| Audit detail | view |
| Audit trail | view, delete |
| Calendar | view, download |
| Data export + backup | view, download |
| E-mail | view, send |
| E-mail addresses | download |
| E-mail delivery | view, all |
| E-mail standard messages | view, create, change, delete |
| Finance: accounts | view, create, change, delete |
| Finance: batches | view, create, delete |
| Finance: categories | view, create, change, delete |
| Finance: ledger | view, download |
| Finance: reconcile accounts | view, reconcile |
| Finance: statement | view, download |
| Finance: transactions | view, create, change, delete |
| Finance: transfer money | view, create, change, delete |
| Gift Aid declaration | view, download_and_mark |
| Group faculties | view, create, change, delete |
| Group leaders | view, email_labels |
| Group ledger (all) | view, create, change, delete, download |
| Group ledger (as leader) | view, create, change, delete, download |
| Group records (all) | view, create, change, delete, download_members |
| Group records (as leader) | view, change, delete, download_members |
| Group records (as member) | view, change |
| Group statement | view, download |
| Group venues | view, create, change, delete |
| Groups list | view, download |
| Groups: add members by name | change |
| Groups: add members by name (as leader) | change |
| Groups: add members by number | change |
| Groups: add members by number (as leader) | change |
| Letters | view, download |
| Letters: standard messages | view, create, change, delete |
| Meetings | view, create, change, delete |
| Member classes | view, create, change, delete |
| Member record | view, create, change, delete |
| Member statuses | view, create, change, delete |
| Members list | view, download |
| Members: delete expired | view, delete |
| Members: non-renewals | view, lapse |
| Members: recent | view, download |
| Membership cards | view, download_and_mark |
| Membership renewals | view, renew |
| Membership statistics | view, download |
| Offices | view, create, change, delete |
| Poll set up | view, create, change, delete |
| Public links | view |
| Role record | view, create, change, delete |
| Roles list | view |
| Settings | view, change |
| System messages | view, create, change |
| User record | view, create, change, delete |
| Users list | view |

---

## Technology stack

Use this stack throughout — do not deviate without good reason:

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite | Component-based, large ecosystem |
| UI styling | Tailwind CSS | Utility-first, consistent design |
| Backend | Node.js + Express | Stays in JavaScript throughout |
| Database | PostgreSQL | Schema-per-tenant multi-tenancy |
| ORM | Prisma | Type-safe, excellent migration tooling |
| Auth | JWT (access) + refresh tokens | Access token in memory, refresh in httpOnly cookie |
| Password hashing | bcrypt (12 rounds) | Industry standard |
| Session invalidation | Redis (optional for POC) | For instant role-change propagation |
| Testing | Vitest (unit) + Playwright (e2e) | Fast, modern |
| Containerisation | Docker | Environment consistency |

### Authentication specifics:
- **Access token:** JWT, 15 minutes, stored in memory on the frontend (never localStorage)
- **Refresh token:** opaque string, 30 days, stored as httpOnly cookie and hashed in DB
- **Privilege embedding:** the user's full effective privilege set is computed at login and
  embedded in the JWT as an array of `"resource:action"` strings (e.g. `"finance:transactions:create"`)
- **Session invalidation:** when roles change, affected users' sessions are invalidated via
  Redis so they must re-login. When Redis is disabled (POC mode), tokens remain valid
  until their natural 15-minute expiry.
- **Timing attack prevention:** always compare passwords even when user is not found

---

## Project structure

```
beacon2/
  backend/
    prisma/
      schema.prisma          # System-level tables (public schema)
      tenant_schema.sql      # Per-tenant schema — executed for each new u3a
    src/
      app.js                 # Express app entry point
      middleware/
        auth.js              # requireAuth, requireSysAdmin
        requirePrivilege.js  # requirePrivilege(resource, action)
        errorHandler.js      # Central error handler + AppError helper
      routes/
        auth.js              # POST /auth/login, /logout, /refresh, /system/login
        users.js             # CRUD /users + role assignment
        roles.js             # CRUD /roles + PUT /roles/:id/privileges
        privileges.js        # GET /privileges/resources
        system.js            # GET/POST/PATCH /system/tenants
      services/
        authService.js       # loginUser, refreshTokens, logoutUser, computePrivileges
      utils/
        db.js                # Prisma singleton + withTenant() + tenantQuery()
        jwt.js               # signAccessToken, signRefreshToken, verify*
        password.js          # hashPassword, verifyPassword, generateToken
        redis.js             # Redis client (optional), invalidateUserSessions
        migrate.js           # Auto-migrate + seed on startup
      seed/
        index.js             # Creates first system admin on startup
        createTenant.js      # Full tenant provisioning (schema + roles + admin user)
        privilegeResources.js # Complete list of all privilege resources
        defaultRoles.js      # 5 default roles with their default privilege sets
    package.json
    .env.example
  frontend/
    src/
      App.jsx                # Router + protected routes
      lib/
        api.js               # Central API client with auto token refresh
      context/
        AuthContext.jsx      # Global auth state + can(resource, action) helper
      pages/
        Login.jsx
        roles/
          RoleList.jsx
          RoleEditor.jsx     # Full privilege matrix UI
        users/
          UserList.jsx
          UserEditor.jsx
    vercel.json
    package.json
  render.yaml                # Render deployment config (free tier, Frankfurt region)
  .gitignore
  README.md
  DEPLOYMENT.md
  docs/
    design/
      auth.html              # Design document for auth module
```

---

## Deployment target (POC)

- **Backend:** Render (free tier, Frankfurt region for GDPR)
- **Frontend:** Vercel (free tier)
- **Database:** Render PostgreSQL (free tier, Frankfurt region)
- **Redis:** Disabled for POC (`USE_REDIS=false`)

### Key deployment requirements:
- The app must **auto-migrate and auto-seed on startup** — no shell access is available
  on the free tier. `migrateAndSeed()` is called before `app.listen()` in `app.js`.
- Build command: `npm install && npm run build` (where build runs `prisma generate`)
- The `render.yaml` blueprint file handles all infrastructure setup automatically
- `CORS_ORIGIN` must match the Vercel frontend URL exactly (no trailing slash)

### Environment variables required:
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Auto-injected by Render from the database service |
| `JWT_ACCESS_SECRET` | 64-character random hex string |
| `JWT_REFRESH_SECRET` | Different 64-character random hex string |
| `SEED_ADMIN_EMAIL` | Email for the first system admin account |
| `SEED_ADMIN_PASSWORD` | Password for the first system admin account |
| `CORS_ORIGIN` | Vercel frontend URL |
| `USE_REDIS` | Set to `"false"` for POC |
| `NODE_ENV` | `"production"` on Render |
| `PORT` | `"3001"` |
| `BCRYPT_ROUNDS` | `"12"` |

---

## Data migration

A migration path from the original Beacon system must be built. Key considerations:

- **Passwords cannot be migrated** — Beacon's hashing algorithm is not available.
  All users must be forced to reset their password on first login to Beacon2.
- **Roles and privilege assignments** can be migrated by mapping Beacon's configuration
  to Beacon2's privilege resource codes.
- **User–role assignments** can be migrated directly once roles are in place.
- The migration tool should be a standalone script that reads a Beacon data export and
  populates the correct tenant schema in Beacon2.

---

## Modules to build (in suggested order)

1. **Auth** — Users, Roles, Privileges, Login ✅ *(already designed and coded)*
2. **Members** — Member records, classes, statuses, renewals
3. **Groups** — Group records, venues, faculties, membership
4. **Finance** — Accounts, transactions, ledger, reconciliation
5. **Email** — Sending, delivery tracking, standard messages
6. **Calendar & Meetings**
7. **Letters & Documents**
8. **Reporting** — Statistics, exports, audit trail
9. **Settings** — u3a configuration, system messages
10. **Data migration tool** — Import from Beacon

---

## Coding standards

- Use **ES modules** throughout (`import`/`export`) — never `require()`
- **No top-level `await`** in module files — wrap in functions to avoid compatibility issues
- All routes use **async/await** with try/catch passing errors to `next(err)`
- Validate all request bodies with **Zod** before processing
- All database queries touching tenant data must go through `tenantQuery()` or `withTenant()`
- Never construct SQL with string concatenation — always use parameterised queries
- Tenant slugs must be validated as `/^[a-z0-9_]+$/` before use in `SET search_path`
- Frontend stores access token **in memory only** — never in localStorage or sessionStorage
- Always prevent self-deletion (a user cannot delete their own account)
- When changing a user's password or roles, call `invalidateUserSessions()` to force re-login

---

## Open questions (decisions still to be made)

1. Should Beacon2 support login via email magic link in addition to password?
2. What is the password policy — minimum length, complexity, expiry?
3. Can a user belong to more than one u3a (same email in two tenants)?
4. Is two-factor authentication required, particularly for the Administration role?
5. What additional system-tier functions are needed beyond tenant management?
6. Should audit trail entries be immutable (cannot be deleted even by Administration)?

