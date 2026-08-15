#!/usr/bin/env bash
# beacon2026 — staging deploy script (Phase 8). Run on the VPS from
# /srv/beacon2026-staging. Meant to be run from any feature branch, not
# main — that is the point of staging. Mirrors deploy.sh's shape, including
# taking a dump first on the same --accept-data-loss reasoning.

set -euo pipefail
cd "$(dirname "$0")/.."

# --env-file is required on every invocation: compose.staging.yaml's
# ${POSTGRES_PASSWORD} substitution is resolved by Compose itself (not by
# the backend service's `env_file: .env.staging`), and Compose only reads a
# file named `.env` by default — which does not exist in this directory.
COMPOSE="docker compose --env-file .env.staging -p beacon2026-staging -f compose.staging.yaml"

echo "==> Backing up staging database before deploy..."
$COMPOSE --profile backup run --rm backup

echo "==> Pulling latest code on current branch: $(git branch --show-current)"
git pull

echo "==> Building images..."
$COMPOSE build

echo "==> Starting backend/postgres/redis..."
$COMPOSE up -d postgres redis backend

echo "==> Building frontend into /srv/beacon2026-staging/dist..."
mkdir -p /srv/beacon2026-staging/dist
$COMPOSE run --rm frontend-build

echo "==> Reloading Caddy..."
sudo systemctl reload caddy

echo "==> Verifying https://staging.u3abeacon2.uk/api/health ..."
curl -fsS https://staging.u3abeacon2.uk/api/health
echo
echo "==> Staging deploy complete."
