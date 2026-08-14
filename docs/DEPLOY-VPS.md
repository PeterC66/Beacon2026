# beacon2026 — VPS Deployment Runbook (OVHcloud)

This is the "how do I get back in / how do I deploy" runbook for beacon2026's
production host, an OVHcloud VPS-1 UK (2 vCore / 4 GB / 40 GB, Erith),
following the pattern established for BusMaps.uk. The rationale for moving
here from Render/Vercel lives in
`../../beacon2026-ovhcloud-vps-recommendation.md` (outside this repo, in the
PDC notes folder) — read that first if you're asking "why".

For the free-hosting POC path (Render + Vercel), see [`DEPLOYMENT.md`](../DEPLOYMENT.md).
That path is kept in the repo as the documented fallback for u3a volunteers
without command-line access — it is not deleted by this move.

---

## 1. Architecture

```
                    Internet
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  Caddy  (on the host, :80 / :443) │   automatic TLS, Let's Encrypt
        │  beacon2026.u3abeacon2.uk          │   security headers, gzip/zstd
        └───────────────────────────────────┘
             │                          │
   handle_path /api/*            handle /*
   (prefix stripped)             (SPA, try_files → index.html)
             │                          │
             ▼                          ▼
    127.0.0.1:3001            /srv/beacon2026/dist   ← static build output
             │
  ┌──────────┴──────────────────────────────────────┐
  │  Docker Compose  (nothing else published)       │
  │                                                 │
  │   backend ──────▶ postgres:18-alpine  ──▶ named volume  beacon2026-db
  │      │        └─▶ redis:7-alpine                │
  │      │                                          │
  │   frontend-build  (one-shot: vite build → dist) │
  │   backup          (one-shot: pg_dump, via cron) │
  └─────────────────────────────────────────────────┘
```

Single origin: the browser only ever talks to `beacon2026.u3abeacon2.uk`.
Caddy's `handle_path /api/*` strips the `/api` prefix before proxying to the
backend, so the backend's root-mounted routes (`/auth`, `/members`, ...) need
no code change, and the frontend's own `/public/...` SPA routes never collide
with the backend's `/public` API router. See
`../../beacon2026-ovhcloud-vps-recommendation.md` §3 for the full reasoning.

---

## 2. Getting back in

- SSH key: `~/.ssh/beacon2026_vps` (dedicated to this host — **not** the
  BusMaps.uk key, so either can be revoked independently).
- Target: `<deploy-user>@<VPS-IP>:/srv/beacon2026`
- App directory: `/srv/beacon2026` (production), `/srv/beacon2026-staging`
  (staging, Phase 8).
- `ufw` allows only 22/80/443. Root login and password auth are disabled.

```bash
ssh -i ~/.ssh/beacon2026_vps <deploy-user>@<VPS-IP>
cd /srv/beacon2026
```

---

## 3. Deploying

```bash
ssh -i ~/.ssh/beacon2026_vps <deploy-user>@<VPS-IP> '/srv/beacon2026/deploy/deploy.sh'
```

`deploy/deploy.sh` (checked into the repo) does, in order:

1. `pg_dump` the current database (backup **before** build — see §5 below for
   why this order is non-negotiable).
2. `git pull origin main`.
3. `docker compose -f compose.prod.yaml build`.
4. `docker compose -f compose.prod.yaml up -d postgres redis backend`.
5. Rebuild the frontend into `/srv/beacon2026/dist` (one-shot container).
6. `systemctl reload caddy`.
7. Poll `/health` until the backend is up, then verify
   `https://beacon2026.u3abeacon2.uk/api/health` over the public URL.

There is no automatic deploy on push. This is deliberate at POC scale — see
the recommendation doc §5 for the trade-off against Render/Vercel's
push-to-deploy.

---

## 4. `.env` — what the VPS needs that Render/Vercel don't

The VPS `.env` (at `/srv/beacon2026/.env`, **never committed**) is a superset
of `backend/.env.example`, plus:

- `POSTGRES_PASSWORD` — used by both `compose.prod.yaml`'s postgres service
  and the backend's `DATABASE_URL` (composed automatically in the compose
  file — don't set `DATABASE_URL` directly in `.env`).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — **fresh** values generated for
  the VPS, not the ones from the old Render setup (those have sat in a
  plaintext notes file and are considered burned).
- `CORS_ORIGIN=https://beacon2026.u3abeacon2.uk` — near-redundant now that
  frontend and backend share an origin, but the backend still refuses to
  start in production without it (`app.js`).
- `USE_REDIS=true` — Redis is free here, unlike Render, so there is no reason
  to leave it off.
- `SENDGRID_API_KEY` / `RECOVERY_FROM_ADDRESS` / `EMAIL_FROM_ADDRESS` — same
  as the Render setup, carried across.
- `PAYPAL_STUB_ALLOW` — **leave unset.** The stub refuses to run in
  production regardless of this value, so setting it does nothing useful.

---

## 5. The one thing that must never be skipped

`backend/src/utils/migrate.js` runs `prisma db push --accept-data-loss` on
**every** backend boot. On Render, a managed daily backup sits behind that.
On the VPS, there is nothing behind it except what this repo scripts —
which is why `deploy/deploy.sh` takes a `pg_dump` **before** it builds and
restarts the backend, and why `deploy/backup.sh` runs nightly from cron:

```cron
0 3 * * * /srv/beacon2026/deploy/backup.sh >> /var/log/beacon2026-backup.log 2>&1
```

14-day local retention (`deploy/backup.sh` prunes older dumps), plus a
scheduled off-box pull to the laptop (mirroring the existing BusMaps.uk
backup task). **A backup that has never been restored is not a backup** —
`deploy/restore.sh` exists and must actually be run at least once as a drill,
not just kept as a script (see `beacon2026-ovhcloud-vps-recommendation.md`
Phase 6).

Restoring:

```bash
ssh -i ~/.ssh/beacon2026_vps <deploy-user>@<VPS-IP>
cd /srv/beacon2026
./deploy/restore.sh /srv/beacon2026/backups/beacon2026-<timestamp>.dump
```

This stops the backend, drops and recreates the database, restores, and
restarts — confirm tenant/member counts afterwards.

---

## 6. Staging (Phase 8)

Same box, a second Compose project (`-p beacon2026-staging`), so volumes and
networks never collide with production:

```bash
cd /srv/beacon2026-staging
./deploy/deploy-staging.sh
```

`compose.staging.yaml` publishes the backend on `127.0.0.1:3002` (not 3001),
uses its own named volumes (`beacon2026-staging-db`, `beacon2026-staging-redis`),
its own `.env.staging`, and `CORS_ORIGIN=https://staging.u3abeacon2.uk`. The
Caddyfile's second server block routes `staging.u3abeacon2.uk` to port 3002
and a separate static root, reusing the same `handle_path /api/*` trick.

Seed staging from a **sanitised** copy of a production dump, or fresh demo
tenants — never a raw production dump. Staging is exempt from the nightly
off-box backup pull (it's disposable by design); `deploy-staging.sh` still
takes a local on-box dump before each deploy.

---

## 7. Troubleshooting

**Caddy reload fails after a fresh DNS cutover, but DNS looks right** — check
log-file ownership before assuming it's an ACME/DNS problem:
`journalctl -u caddy`. (Hit for real on the BusMaps.uk host: the log file was
`root:root 600` but Caddy runs as its own user.)

**A named Docker volume is `root:root` on first creation** but the container
inside runs unprivileged. The official `postgres`/`redis` images handle their
own ownership on first boot, so this shouldn't recur here — but if a volume
is ever recreated by hand, check ownership before assuming a crash loop is a
config bug.

**Deploy script can't reach `https://beacon2026.u3abeacon2.uk/api/health`**
— confirm Caddy actually reloaded (`systemctl status caddy`) and that the
Caddyfile's `beacon2026.u3abeacon2.uk` block matches the DNS record exactly
(no trailing dot / wrong record type).
