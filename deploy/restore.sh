#!/usr/bin/env bash
# beacon2026 — restore a production database dump. Run on the VPS from
# /srv/beacon2026. DESTRUCTIVE: drops and recreates the beacon2026 database
# before restoring. Stops the backend first so nothing writes mid-restore.
#
# Usage: deploy/restore.sh /srv/beacon2026/backups/beacon2026-<timestamp>.dump

set -euo pipefail
cd "$(dirname "$0")/.."

DUMP_FILE="${1:?Usage: restore.sh <path-to-dump-file>}"
if [ ! -f "$DUMP_FILE" ]; then
  echo "!! Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

read -r -p "This will DROP and restore the beacon2026 database from $DUMP_FILE. Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo "==> Stopping backend..."
docker compose -f compose.prod.yaml stop backend

echo "==> Dropping and recreating database..."
docker compose -f compose.prod.yaml exec -T postgres psql -U beacon2026 -d postgres \
  -c "DROP DATABASE IF EXISTS beacon2026;" \
  -c "CREATE DATABASE beacon2026 OWNER beacon2026;"

echo "==> Restoring dump..."
docker compose -f compose.prod.yaml exec -T postgres pg_restore \
  -U beacon2026 -d beacon2026 --no-owner < "$DUMP_FILE"

echo "==> Restarting backend..."
docker compose -f compose.prod.yaml up -d backend

echo "==> Waiting for backend health..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    echo "==> Backend healthy after restore."
    break
  fi
  sleep 2
done

echo "==> Restore complete. Verify tenant/member counts manually before trusting this restore."
