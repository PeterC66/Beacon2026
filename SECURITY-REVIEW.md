# Security Review — Beacon2 Codebase

**Date:** 2026-04-15
**Status:** Initial audit complete — fixes pending

## Context

Full security audit of the Beacon2 multi-tenant SaaS application (Node.js/Express
backend + React frontend). The codebase is pre-production, deployed on Render. This
review identifies vulnerabilities, misconfigurations, and deviations from stated
architecture requirements, triaged by severity.

Each finding has a status field: `OPEN`, `IN PROGRESS`, or `FIXED`. Update status as
fixes are implemented.

---

## Findings by Severity

### CRITICAL

#### C1 — Hardcoded default admin credentials in seed — `FIXED`
- **File:** `backend/src/seed/index.js:9-11`
- **Issue:** Default password `ChangeMe123!` and email `admin@beacon2.local` used when
  `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_EMAIL` env vars are not set. The password is also
  logged to stdout (line 32).
- **Risk:** If seed runs without env vars in production, the system admin account has a
  well-known password. Anyone reading the source code knows it.
- **Fix:** Make `SEED_ADMIN_PASSWORD` and `SEED_ADMIN_EMAIL` required — throw an error
  if not set. Remove the `?? 'ChangeMe123!'` fallback. Redact password from console
  output.
- **Resolution:** Removed the `ChangeMe123!` and `admin@beacon2.local` fallbacks in
  `backend/src/seed/index.js` and `backend/src/utils/migrate.js` (same defaults were
  duplicated there and run on every startup). Both now throw / exit with an error if
  `SEED_ADMIN_EMAIL` or `SEED_ADMIN_PASSWORD` is missing when no sysadmin exists.
  Password is no longer echoed to stdout; only the email and a reminder to change the
  password on first login are logged.

#### C2 — Recovery temp password logged to console — `FIXED`
- **File:** `backend/src/routes/auth.js:332`
- **Issue:** `sendRecoveryEmail()` logs the temporary password in plaintext:
  `console.log('[Recovery] Would send email to ... — ...')`. This is a dev stub that
  exposes passwords in server logs.
- **Risk:** Anyone with access to server logs (Render dashboard, log drain) can see
  every user's temporary password.
- **Fix:** Remove the console.log, or at minimum redact the password. When SendGrid is
  configured, send via email only. When not configured, log a warning that recovery
  emails are disabled — never log the actual password.
- **Resolution:** `sendRecoveryEmail()` now sends the recovery email via SendGrid when
  `SENDGRID_API_KEY` is set. When unset, it logs a warning naming the recipient only
  (no password, no message body) so operators can see email delivery is disabled.
  Send failures are logged with `err.message` only — the email body is never logged.

#### C3 — Portal & system tokens stored in sessionStorage (architecture violation) — `FIXED`
- **Files:**
  - `frontend/src/pages/public/PortalLogin.jsx:27` — writes `portalToken`
  - `frontend/src/pages/system/SystemLogin.jsx:23` — writes `sysToken`
  - `frontend/src/lib/api/portal.js:8,22,87` — reads `portalToken`
  - `frontend/src/pages/system/SystemDashboard.jsx:81` — reads `sysToken`
- **Issue:** CLAUDE.md states "Frontend access token is stored in memory only — never
  localStorage or sessionStorage". The main auth token (in `core.js:6`) correctly uses
  a module-level variable, but the portal and system admin tokens use `sessionStorage`.
- **Risk:** XSS vulnerability anywhere on the page could exfiltrate these tokens.
  `sessionStorage` is accessible via DevTools on shared/public computers.
- **Fix:** Move both tokens to module-level variables (same pattern as `core.js`).
  Update the portal and system API modules to use in-memory token storage with
  getter/setter functions.
- **Resolution:** Added module-level `portalToken` in `frontend/src/lib/api/portal.js`
  and `sysToken` in `frontend/src/lib/api/system.js`, each with
  `set…Token / clear…Token / get…Token / has…Token` exports, mirroring the pattern
  used by the main `core.js` access token. Updated `PortalLogin`, `PortalHome`,
  `PortalRenewal`, `PortalPersonalDetails`, `SystemLogin`, and `SystemDashboard` to
  use the new helpers instead of reading/writing `sessionStorage`. Non-secret portal
  state (`portalMember`, `portalSlug`) remains in sessionStorage. Reloading the page
  now clears the portal/system session — the user must log in again.

---

### HIGH

#### H1 — Refresh token tenant slug not validated against JWT payload — `FIXED`
- **File:** `backend/src/routes/auth.js:78`, `backend/src/services/authService.js:96-103`
- **Issue:** The `/auth/refresh` endpoint takes `tenantSlug` from the `x-tenant-slug`
  header (client-controlled). `refreshTokens()` verifies the JWT and gets
  `payload.tenantSlug` from it but never checks that it matches the provided
  `tenantSlug`.
- **Mitigation:** The token hash lookup happens in the provided tenant's schema, so a
  hash stored in tenant A won't be found in tenant B. This makes exploitation
  extremely unlikely.
- **Fix:** Add `if (payload.tenantSlug !== tenantSlug) throw AppError(...)` after
  line 99 in `authService.js` as defense-in-depth.
- **Resolution:** `refreshTokens()` now compares `payload.tenantSlug` against the
  caller-supplied `tenantSlug` immediately after JWT verification and rejects with
  `401 Invalid refresh token` on mismatch — before any DB lookup. Covered by a unit
  test in `backend/src/__tests__/authService.test.js` that asserts no
  `tenantQuery()` call is made when the slugs differ.

#### H2 — No account lockout after failed login attempts — `FIXED`
- **Files:** `backend/src/services/authService.js:21-49`,
  `backend/src/routes/auth.js:34-48`
- **Issue:** Failed login attempts are not tracked. The only protection is the rate
  limiter (100 requests per 15 minutes on `/auth` routes), which is IP-based.
- **Risk:** Credential stuffing / brute force attacks. Behind a shared proxy, the rate
  limiter counts all users together.
- **Fix:** Track failed attempts per (tenantSlug, username) in Redis or DB. Lock
  account temporarily after N failures (e.g., 5). Log failed attempts to audit log.
- **Resolution:** Added `failed_login_count` and `locked_until` columns to
  `:schema.users` (idempotent ALTER, picked up on every startup). `loginUser()` now:
  (1) refuses to authenticate while `locked_until > now()` — even on a correct
  password — without leaking which condition failed; (2) increments
  `failed_login_count` on every wrong password; (3) once the count reaches
  `MAX_FAILED_LOGINS` (default 5) it sets `locked_until = now() + LOCKOUT_MINUTES`
  (default 15); (4) resets both columns on a successful login. Each failure and
  lockout is written to the tenant audit log via `logAudit`. Both env vars are
  tunable. Non-existent users still incur the dummy bcrypt comparison (timing) but
  no DB write. Covered by four unit tests in
  `backend/src/__tests__/authService.test.js`.

#### H3 — Session invalidation silently disabled without Redis — `FIXED`
- **File:** `backend/src/utils/redis.js:7,14,35-36`
- **Issue:** When `REDIS_URL` is not set, `isSessionInvalidated()` always returns
  `false`. This means role/privilege changes don't take effect until the access token
  expires (15 min), and `invalidateUserSessions()` is a no-op.
- **Risk:** A user whose role is revoked continues to have access for up to 15 minutes.
  In production this should be considered unacceptable.
- **Fix:** At minimum, log a startup WARNING that session invalidation is disabled.
  Require Redis for production (`NODE_ENV=production` without `REDIS_URL` should error).
- **Resolution:** `backend/src/utils/redis.js` now refuses to start in production
  when `REDIS_URL` is missing — unless the operator has explicitly opted out with
  `USE_REDIS=false`, in which case a loud startup WARNING is emitted naming the
  consequence (revoked roles remain effective until the access token expires).
  Dev/test runs without Redis behave as before.

#### H4 — npm audit vulnerabilities — `FIXED`
- **Issue:** `npm audit` reports 11 backend vulnerabilities (1 critical, 4 high,
  6 moderate) and 5 frontend vulnerabilities (1 high, 4 moderate).
- **Fix:** Run `npm audit fix` in both `backend/` and `frontend/`. For remaining
  issues, evaluate `npm audit fix --force` or pin specific package versions.
- **Resolution:** Applied in three passes. Both packages now report
  **0 vulnerabilities**. Test suites remain green (backend 386 / frontend 133).
  1. Ran `npm audit fix` (non-breaking) in both packages — fixed transitively:
     `axios`, `brace-expansion`, `follow-redirects`, `path-to-regexp`
     (backend); `picomatch` (frontend).
  2. Upgraded `bcrypt` 5 → 6 in `backend/package.json`. Cleared the
     remaining 3 highs (`bcrypt`, `@mapbox/node-pre-gyp`, `tar`). bcrypt's
     `hash`/`compare` API is unchanged; `backend/src/utils/password.js`
     needed no code change. bcrypt 6 drops Node 16 support — we already
     require Node ≥20.
  3. Upgraded `vitest` 1 → 4 in `backend/package.json`, and `vite` 5 → 8,
     `vitest` 1 → 4, and `@vitejs/plugin-react` to the latest in
     `frontend/package.json`. Cleared the remaining 4 moderate backend and
     4 moderate frontend advisories (`esbuild`, `vite`, `vite-node`,
     `vitest`). All affected dependencies are `devDependencies` — nothing
     ships to production. No source changes were required: test configs,
     setup files, and the `vi` mock API used by the existing suites are
     compatible with vitest 4. `vite build` still succeeds with vite 8.
  - **Backend** 11 → 0 vulnerabilities.
  - **Frontend** 5 → 0 vulnerabilities.

#### H5 — CORS_ORIGIN not validated at startup — `FIXED`
- **File:** `backend/src/app.js:51`
- **Issue:** `process.env.CORS_ORIGIN` is used directly in the cors middleware. If the
  env var is unset, origin will be `undefined`, which causes the cors middleware to not
  send CORS headers — breaking the frontend silently. There's no startup validation.
- **Fix:** Add a startup check: if `NODE_ENV === 'production'` and `CORS_ORIGIN` is not
  set, throw an error. Consider also validating it's a proper URL.
- **Resolution:** `backend/src/app.js` now throws at module load when
  `NODE_ENV === 'production'` and `CORS_ORIGIN` is unset, with a message naming the
  expected value (the frontend URL). Dev/test runs without `CORS_ORIGIN` are
  unaffected — the test environment supplies it via `vitest.config.js`.

---

### MEDIUM

#### M1 — SameSite=none on refresh cookie without additional CSRF protection — `OPEN`
- **File:** `backend/src/routes/auth.js:20`
- **Issue:** The refresh token cookie uses `sameSite: 'none'` (required for cross-origin
  Vercel→Render). This means the cookie is sent with all cross-origin requests.
- **Mitigation:** CORS origin checking prevents unauthorized origins from reading
  responses, and the `/auth/refresh` endpoint requires the `x-tenant-slug` header.
- **Risk:** A CSRF attack could trigger a token refresh if the attacker knows the tenant
  slug (which is often public). The attacker can't read the response (blocked by CORS),
  but the side effect (new token stored in DB, old one revoked) could be used for
  denial-of-service.
- **Fix:** Consider adding a CSRF token or using the Double Submit Cookie pattern for
  the refresh endpoint. Alternatively, document this as an accepted risk given the
  CORS + header requirement.

#### M2 — Zod validation errors expose field paths — `OPEN`
- **File:** `backend/src/middleware/errorHandler.js:20-23`
- **Issue:** Zod validation errors return `path` (e.g., `adminPassword`) and `message`
  to the client. This reveals the expected request schema.
- **Mitigation:** The frontend code is public anyway, so the schema is discoverable.
- **Fix:** Optionally, return generic "Validation failed" in production without field
  paths. Low priority given the frontend is a SPA with client-visible code.

#### M3 — Beacon migration default password — `OPEN`
- **File:** `backend/src/routes/backup.js:1110`
- **Issue:** `BEACON_DEFAULT_PASSWORD = 'Beacon2!'` is hardcoded and used for all
  migrated users during a Beacon-format restore.
- **Mitigation:** `must_change_password` is set to true, so users must change it on
  first login. The system admin can also use the set-temp-password endpoint.
- **Fix:** Document this clearly. Consider generating unique random passwords per user
  during migration and emailing them.

#### M4 — Open redirect in payment flows — `OPEN`
- **Files:**
  - `frontend/src/pages/public/ResumePayment.jsx:34`
  - `frontend/src/pages/public/PortalRenewal.jsx:101-102`
- **Issue:** `window.location.href = data.redirectUrl` where `redirectUrl` comes from
  the backend API response. If the backend is compromised, users could be redirected
  to a phishing site.
- **Mitigation:** The URL comes from the trusted backend, not from user input.
- **Fix:** Validate the redirect URL against a whitelist of allowed domains (e.g.,
  `paypal.com`) before redirecting.

#### M5 — set-temp-password endpoint sets same password for ALL tenant users — `OPEN`
- **File:** `backend/src/routes/system.js:98-113`
- **Issue:** This endpoint resets every user's password to the same value. While
  protected by `requireSysAdmin`, it's a powerful operation with no audit trail.
- **Fix:** Add audit logging for this endpoint. Consider whether this is the right
  design (perhaps reset only specific users).

#### M6 — Password reset token in URL parameter — `OPEN`
- **File:** `frontend/src/pages/public/PortalResetPassword.jsx:11`
- **Issue:** Password reset tokens appear in URL query parameters, which end up in
  browser history, server access logs, and Referer headers.
- **Mitigation:** Tokens should be single-use and short-lived (verify on backend).
- **Fix:** Low priority if tokens are properly validated on the backend.

---

### LOW

#### L1 — JWT algorithm not explicitly specified — `FIXED`
- **File:** `backend/src/utils/jwt.js:25,34,42,50`
- **Issue:** `jwt.sign()` and `jwt.verify()` don't specify `{ algorithms: ['HS256'] }`.
  The jsonwebtoken library defaults to HS256 for HMAC secrets, but explicit is better.
- **Fix:** Add `{ algorithms: ['HS256'] }` to `jwt.verify()` calls to prevent algorithm
  confusion attacks.
- **Resolution:** Pinned the algorithm to HS256 in all four call sites in
  `backend/src/utils/jwt.js`: both `jwt.sign()` calls now pass
  `{ algorithm: 'HS256', ... }` and both `jwt.verify()` calls pass
  `{ algorithms: ['HS256'] }`. This blocks the classic alg-confusion attack where
  an attacker sets `alg: none` or swaps to a public-key algorithm the server then
  validates against the HMAC secret.

#### L2 — LIKE wildcard not escaped in member search — `OPEN`
- **File:** `backend/src/routes/members.js:119-137`
- **Issue:** Search query `q` is used in ILIKE with `%${q}%`. PostgreSQL LIKE special
  characters (`%`, `_`) in user input aren't escaped.
- **Risk:** Users can craft searches that match more broadly than intended (e.g., `_`
  matches any single character). This is data disclosure, not injection.
- **Fix:** Escape `%` and `_` in the search term before interpolating into the LIKE
  pattern.

#### L3 — No explicit bcrypt max-length validation — `ALREADY HANDLED`
- **File:** `backend/src/routes/auth.js:115`
- **Issue:** Password max is 72 chars (Zod schema), matching bcrypt's limit.
- **Status:** The change-password Zod schema already enforces `.max(72)`. No fix needed.

#### L4 — Recovery endpoint returns userId — `ACCEPTED RISK`
- **File:** `backend/src/routes/auth.js:225`
- **Issue:** When a user has a security question, the response includes `userId`. This
  is needed for the step-2 verify flow.
- **Mitigation:** The attacker must already know forename, surname, postcode, and email
  to reach this point.
- **Status:** Accepted risk — needed for the flow.

---

## Positive Security Findings

The codebase demonstrates strong security practices in several areas:

- **Main auth token in memory only** (`frontend/src/lib/api/core.js:6`)
- **No XSS vectors** — no `dangerouslySetInnerHTML`, `eval()`, or `document.write()`
- **Timing attack prevention** — dummy bcrypt hash on user-not-found
  (`authService.js:43-44`)
- **Refresh token rotation with reuse detection** (`authService.js:113-118`)
- **Parameterised SQL throughout** — no string concatenation for user input
- **Tenant slug validation** — strict `^[a-z0-9_]+$` regex before use in SQL
- **Helmet security headers** enabled
- **Rate limiting** on auth and general endpoints
- **httpOnly + secure cookies** for refresh tokens
- **Bcrypt with 12 rounds** for password hashing
- **Token hash (not raw token) stored in DB** (`authService.js:70`)
- **Privilege-based access control** with session invalidation on role changes
- **Error handler hides details in production** (`errorHandler.js:27-29`)
- **JWT secrets required at startup** (`jwt.js:10-12`)

---

## Recommended Fix Plan (Priority Order)

### Phase 1 — Immediate (security patches)
1. **C1** — Remove hardcoded seed credentials fallback; require env vars
2. **C2** — Remove console.log of temp passwords in recovery flow
3. **C3** — Move portal/system tokens from sessionStorage to memory
4. **H1** — Add tenant slug validation in refreshTokens()
5. **L1** — Specify JWT algorithm explicitly

### Phase 2 — High priority
6. **H4** — Run npm audit fix in both packages
7. **H5** — Validate CORS_ORIGIN at startup in production
8. **H3** — Require Redis in production or add DB-based fallback
9. **H2** — Implement account lockout after N failed attempts

### Phase 3 — Medium priority (hardening)
10. **M1** — Evaluate CSRF protection for refresh endpoint
11. **M4** — Add redirect URL whitelist for payment flows
12. **M5** — Add audit logging to set-temp-password endpoint
13. **L2** — Escape LIKE wildcards in member search
14. **M2** — Consider redacting Zod error paths in production

### Items to document / accept
- **M3** — Beacon migration default password (document clearly, accepted for migration)
- **M6** — Password reset tokens in URLs (standard practice, ensure single-use)
- **L4** — Recovery userId exposure (needed for flow, protected by 4-field lookup)

---

## Verification

After implementing fixes:
1. Run `cd backend && npm test` and `cd frontend && npm test`
2. Run `npm audit` in both directories — verify no critical/high vulnerabilities
3. Manual test: attempt login without SEED_ADMIN_PASSWORD set — should error
4. Manual test: trigger password recovery — verify no password in logs
5. Manual test: check browser DevTools storage — verify no tokens in sessionStorage
6. Manual test: send refresh request with wrong x-tenant-slug — should be rejected

---

## Files Requiring Changes

| File | Fix |
|------|-----|
| `backend/src/seed/index.js` | C1 — require env vars, redact password |
| `backend/src/routes/auth.js` | C2 — remove temp password logging |
| `backend/src/services/authService.js` | H1 — validate tenant in refreshTokens |
| `backend/src/utils/jwt.js` | L1 — explicit algorithm |
| `backend/src/app.js` | H5 — validate CORS_ORIGIN |
| `backend/src/utils/redis.js` | H3 — warn/error without Redis in prod |
| `frontend/src/pages/public/PortalLogin.jsx` | C3 — memory token storage |
| `frontend/src/pages/system/SystemLogin.jsx` | C3 — memory token storage |
| `frontend/src/lib/api/portal.js` | C3 — read token from memory |
| `frontend/src/pages/system/SystemDashboard.jsx` | C3 — read token from memory |
