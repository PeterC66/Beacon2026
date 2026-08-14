#!/usr/bin/env bash
# beacon2026 — production deploy script. Run on the VPS from /srv/beacon2026.
#
# Order matters: back up BEFORE building, because migrate.js runs
# `prisma db push --accept-data-loss` on every backend boot — a destructive
# schema resolution takes the data with it, so a dump must exist first.
# See beacon2026-ovhcloud-vps-recommendation.md §5, §10.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Backing up database before deploy..."
docker compose -f compose.prod.yaml --profile backup run --rm backup

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building images..."
docker compose -f compose.prod.yaml build

echo "==> Starting backend/postgres/redis..."
docker compose -f compose.prod.yaml up -d postgres redis backend

echo "==> Building frontend into /srv/beacon2026/dist..."
mkdir -p /srv/beacon2026/dist
docker compose -f compose.prod.yaml run --rm frontend-build

echo "==> Reloading Caddy (picks up any static-file changes)..."
sudo systemctl reload caddy

echo "==> Waiting for backend health..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    echo "==> Backend healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "!! Backend did not become healthy in time." >&2
    exit 1
  fi
  sleep 2
done

echo "==> Verifying https://beacon2026.u3abeacon2.uk/api/health ..."
curl -fsS https://beacon2026.u3abeacon2.uk/api/health
echo
echo "==> Deploy complete."
