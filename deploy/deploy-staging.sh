#!/usr/bin/env bash
# beacon2026 — staging deploy script (Phase 8). Run on the VPS from
# /srv/beacon2026-staging. Meant to be run from any feature branch, not
# main — that is the point of staging. Mirrors deploy.sh's shape, including
# taking a dump first on the same --accept-data-loss reasoning.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Backing up staging database before deploy..."
docker compose -p beacon2026-staging -f compose.staging.yaml --profile backup run --rm backup

echo "==> Pulling latest code on current branch: $(git branch --show-current)"
git pull

echo "==> Building images..."
docker compose -p beacon2026-staging -f compose.staging.yaml build

echo "==> Starting backend/postgres/redis..."
docker compose -p beacon2026-staging -f compose.staging.yaml up -d postgres redis backend

echo "==> Building frontend into /srv/beacon2026-staging/dist..."
mkdir -p /srv/beacon2026-staging/dist
docker compose -p beacon2026-staging -f compose.staging.yaml run --rm frontend-build

echo "==> Reloading Caddy..."
sudo systemctl reload caddy

echo "==> Verifying https://staging.u3abeacon2.uk/api/health ..."
curl -fsS https://staging.u3abeacon2.uk/api/health
echo
echo "==> Staging deploy complete."
