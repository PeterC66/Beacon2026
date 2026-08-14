# beacon2026 — Deployment Guide (Proof of Concept)

> **This is not what production runs on.** Since 2026-08-14, production runs on a
> dedicated OVHcloud VPS — see [`docs/DEPLOY-VPS.md`](docs/DEPLOY-VPS.md). This guide
> is kept as a documented no-command-line fallback path for u3a volunteers without
> server access.

This guide gets beacon2026 live on the internet using free hosting.
No command line or server knowledge needed — everything is done through websites.

---

## What you'll use

| Purpose               | Service | Cost |
|-----------------------|---------|------|
| Backend & database    | Render  | Free |
| Frontend (UI)         | Vercel  | Free |

---

## Before you start — prepare three secret values

You'll need these during setup. Get them ready now.

**JWT_ACCESS_SECRET and JWT_REFRESH_SECRET**
1. Go to **generate-secret.vercel.app/64** in your browser
2. Copy the string shown — this is your `JWT_ACCESS_SECRET`
3. Refresh the page to get a new string — this is your `JWT_REFRESH_SECRET`
4. Keep both somewhere safe (e.g. a text file) — you'll paste them into Render shortly

**SEED_ADMIN_PASSWORD**
This is the password you'll use to log in to beacon2026 for the first time.
Choose something secure and make a note of it.

---

## Step 1 — Push the code to GitHub

If you haven't already:

1. Go to github.com and create a new repository called `beacon2026` (private is fine)
2. Upload the beacon2026 code into it
3. Make sure `render.yaml` is in the root of the repo and `vercel.json` is inside the `frontend` folder

---

## Step 2 — Deploy the backend and database (Render)

1. Go to **render.com** and sign up with your GitHub account
2. Click **New → Blueprint**
3. Connect your `beacon2026` GitHub repository
4. Render will find the `render.yaml` file and show you a list of environment variables to fill in
5. Fill in the following — leave anything else as-is:

   | Variable | Value |
   |---|---|
   | `JWT_ACCESS_SECRET` | Paste the first secret from "Before you start" |
   | `JWT_REFRESH_SECRET` | Paste the second secret from "Before you start" |
   | `SEED_ADMIN_EMAIL` | The email address you want to log in with |
   | `SEED_ADMIN_PASSWORD` | The password you chose in "Before you start" |
   | `CORS_ORIGIN` | Leave blank for now — you'll fill this in after Step 4 |

6. Click **Apply** — Render will now build and start your backend (takes 3–5 minutes)

> **Optional settings:** everything above is all you need for the POC. The backend
> also accepts a number of optional variables (all with sensible defaults) — for
> example `LOG_LEVEL` to control log verbosity and `PORTAL_AUTH_RATE_LIMIT_MAX` to
> tune the members-portal rate limit. The full, commented list is in
> [`backend/.env.example`](backend/.env.example).

**What happens automatically on first start:**
- The database tables are created
- Your admin account is created using the email and password you provided above
- The app starts and is ready to use

7. Once it shows as **Live**, click on the `beacon2026-backend` service and copy the URL at the top
   (it looks like `https://beacon2026-backend-xxxx.onrender.com`)

---

## Step 3 — Deploy the frontend (Vercel)

1. Go to **vercel.com** and sign up with your GitHub account
2. Click **Add New → Project**
3. Find your `beacon2026` repository and click **Import**
4. Under **Root Directory**, click Edit and type: `frontend`
5. Under **Environment Variables**, add one entry:
   - Name: `VITE_API_URL`
   - Value: paste the Render backend URL you copied in Step 2
6. Click **Deploy** — takes about 1 minute
7. Once done, copy the Vercel URL (looks like `https://beacon2026-xxxx.vercel.app`)

---

## Step 4 — Tell the backend about the frontend

This step allows the backend to accept requests from the frontend.

1. Go back to **Render**, open the `beacon2026-backend` service
2. Click **Environment** in the left menu
3. Find `CORS_ORIGIN` and paste your Vercel URL from Step 3
4. Click **Save Changes** — the backend restarts automatically (takes about a minute)

---

## Step 5 — Test it

Open your Vercel URL in a browser. You should see the beacon2026 login screen.

Log in using the email and password you set in Step 2.

---

## Limitations of the free POC setup

These are all fine for a proof of concept — just be aware:

- **Render free tier sleeps** after 15 minutes of inactivity. The first request after a quiet
  period can take 20–30 seconds to wake up. This is fine for a POC but would be
  resolved by upgrading to Render's Starter plan (~£6/month).
- **Redis is disabled** — session invalidation falls back to the Postgres
  `session_invalidations` table, so a role/password change is still picked up on
  the user's next request. Redis is only needed for scale (it avoids one
  indexed lookup per request); fine to leave off for a POC.
- **Database size** is limited to 1GB on the free tier — more than enough for a POC.
- **No automated backups** on the free tier — see "Replacing the database" below for the
  manual `pg_dump`/`pg_restore` procedure. The Starter plan adds automated backups.
- **Content-Security-Policy is in report-only mode** (`frontend/vercel.json`). The policy
  is published but not enforced, so a violation is logged rather than blocked. See
  "[Enforcing the Content-Security-Policy](#enforcing-the-content-security-policy)" below
  for the step-by-step flip once a clean report window confirms nothing legitimate breaks.

### Running locally without a deployment

You don't need Render or Vercel to try beacon2026 or to run the E2E suite — the repo
root has a `docker-compose.yml` that runs Postgres, Redis, the backend, and the
frontend together on your machine (`docker compose up --build`). See `README.md`
and `e2e/.env.example` for details. It is a development convenience only and is
never used for a real deployment.

---

## Troubleshooting

**The deploy failed on Render**
Click on the `beacon2026-backend` service, then click the **Logs** tab. The error message
will be shown there. Copy it and share it — it will point directly to the problem.

**I can't log in**
Check that `CORS_ORIGIN` in Render exactly matches your Vercel URL — no trailing slash.
Also check that `VITE_API_URL` in Vercel exactly matches your Render backend URL.

**I've forgotten my admin password**
In Render, go to Environment, change `SEED_ADMIN_PASSWORD` to a new value, and save.
Then go to the `beacon2026-backend` service and click **Manual Deploy → Deploy latest commit**.
The app will restart and, if no admin exists, create a new one. If one already exists,
delete the user record from the database first via Render's database dashboard.

**Render build fails with `COPY backend/ ./backend/: ... not found` (or similar for `shared/`)**
This means the service was set up as a **Docker** environment instead of **Node**, most
likely because it was created via Render's "New Web Service" wizard (which auto-detects
[`backend/Dockerfile`](backend/Dockerfile) and defaults to Docker) rather than via
**New → Blueprint** pointing at `render.yaml` (see Step 2 — this is the supported path
and always creates a correctly-configured Node service). `backend/Dockerfile` is for local
dev/E2E only and expects a repo-root build context; a wizard-created Docker service
normally has its Root Directory set to `backend`, which breaks that Dockerfile's `COPY`
paths.

Render does not let you switch an existing service's environment (Docker ↔ Node) after
creation. Two ways out, without needing to recreate the service and re-link the database:
- In **Settings → Build & Deploy**, set **Dockerfile Path** to `backend/Dockerfile` and
  **Docker Build Context Directory** to `.` (repo root) — this makes the existing Docker
  service build correctly instead of switching it to Node.
- Or recreate the service via **New → Blueprint** (the Step 2 path) if you're able to
  re-link to the existing database (`beacon2_a89s`) cleanly — riskier, only do this if the
  Docker-context fix above doesn't work.

(This happened once, 2026-08-01, after renaming the Render service — see CHANGELOG.)

---

## Replacing the database (e.g. free tier expiry)

Render's free PostgreSQL databases are deleted after 90 days. When this happens
you need to create a new one and point the backend at it.

1. In Render, click **New → PostgreSQL**
   - Region: **Frankfurt** (same as the backend)
   - Database name: `beacon2026`, User: `beacon2026`
   - Plan: choose as needed (free = another 90 days; Starter = $7/month, no expiry)

2. Once the new database is ready, copy its **Internal Database URL**
   (it starts with `postgresql://beacon2026:…`)

3. Go to the `beacon2026-backend` service → **Environment**
   - Replace the `DATABASE_URL` value with the new Internal Database URL
   - Click **Save Changes** — the backend restarts automatically

4. **That's it.** On restart the backend automatically creates all tables and
   seeds your admin account. No manual migration needed.

5. The **frontend needs no changes** — it talks to the backend URL, which hasn't changed.

**Important — data:** The old database's data is lost unless you export it first.
Render emails you before deletion with a deadline. If you need to keep the data,
use the database dashboard's **PSQL** tab to run `pg_dump` before the deadline,
then `pg_restore` into the new database after creating it.

---

## When you're ready to move beyond POC

The POC setup above is deliberately minimal. Before running beacon2026 with **real
member data**, work through this checklist.

### Production-readiness checklist

- [ ] **Remove free-tier sleep & add backups** — upgrade the Render
      `beacon2026-backend` and `beacon2026-db` services to the **Starter** plan
      (~£6/month each). Starter adds automated daily database backups.
- [ ] **Enable Redis** — add **Upstash Redis** (free tier, EU region) and set
      `USE_REDIS=true` and `REDIS_URL` in Render. This makes role/password
      changes invalidate sessions immediately rather than on next request.
- [ ] **Custom domain & TLS** — buy a domain and point it at your Render and
      Vercel URLs. Both platforms issue and renew TLS certificates automatically.
      Update `CORS_ORIGIN` (Render) and `VITE_API_URL` (Vercel) to the new URLs.
- [ ] **Enforce the Content-Security-Policy** — follow
      "[Enforcing the Content-Security-Policy](#enforcing-the-content-security-policy)"
      after a clean report-only window.
- [ ] **Email sender reputation** — if sending member emails at volume, configure
      SPF/DKIM for your domain in SendGrid and set `EMAIL_FROM_ADDRESS`.
- [ ] **Data protection** — review GDPR obligations and put data-processing
      agreements in place with Render, Vercel, and SendGrid (see
      [SECURITY.md](SECURITY.md)).
- [ ] **Test a restore** — confirm you can restore from a backup *before* you
      rely on it (see "Replacing the database" above).

### Operating it day-to-day

- **Monitoring & logs** — use the Render dashboard for backend health and the
  **Logs** tab for errors; Vercel's dashboard covers the frontend. Set
  `LOG_LEVEL=info` (the production default) and raise to `debug` temporarily when
  diagnosing an issue.
- **Backups & recovery** — on the Starter plan Render takes automated daily
  backups you can download from the database dashboard. The manual
  `pg_dump`/`pg_restore` procedure under "Replacing the database" still applies
  for ad-hoc snapshots and migrations.
- **Updates** — Dependabot raises dependency-update PRs; merge them after CI is
  green. Schema changes apply automatically on deploy (the backend runs
  `prisma db push` on startup), so a normal deploy is just "Deploy latest commit".
- **Platform end-of-life** — watch for Render/Vercel notices about Node or
  PostgreSQL version end-of-life and plan upgrades in good time; the app targets
  Node 20+ and PostgreSQL 15+.

---

## Enforcing the Content-Security-Policy

The frontend ships its CSP in **report-only** mode (`frontend/vercel.json`): the
policy is published and violations are reported, but nothing is blocked. This is
deliberate — the "clean report window" can only be observed against the real
deployed frontend, so the policy is left non-enforcing until a live site confirms
nothing legitimate trips it. Flip it to enforcing like this:

1. **Deploy and use the site normally** for a representative window (a few days),
   exercising every area — login, members, groups, finance, email, exports,
   portal, online joining. Report-only CSP does not break anything, so this is
   safe to do in production.
2. **Collect violation reports.** Browsers log blocked-in-theory resources to the
   DevTools console as `[Report Only]` CSP messages. For durable collection, add
   a `report-uri`/`report-to` endpoint (e.g. a free report-collector service) to
   the policy value and watch what arrives.
3. **Resolve any genuine violations** by fixing the offending code (preferred) or,
   only if unavoidable, widening the relevant directive. Repeat until a full
   window passes with **no** legitimate violations.
4. **Tighten `connect-src`** from `'self' https:` to the concrete backend origin
   (e.g. `connect-src 'self' https://beacon2026-backend.onrender.com`) so the policy
   names exactly what the app talks to.
5. **Flip the header to enforcing.** In `frontend/vercel.json`, rename the header
   key from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
   (keep the same `value`). Commit and redeploy via Vercel.
6. **Verify enforcement.** Load the site and confirm in DevTools that the response
   carries `Content-Security-Policy` (not `…-Report-Only`) and that the app still
   works end-to-end.
7. **Rollback plan.** If something legitimate breaks under enforcement, rename the
   key back to `Content-Security-Policy-Report-Only` and redeploy — that instantly
   returns to non-blocking while you investigate.

