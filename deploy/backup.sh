#!/usr/bin/env bash
# beacon2026 — nightly backup, run from host cron.
# Crontab entry (production only; staging is exempt, see docs/DEPLOY-VPS.md §8):
#   0 3 * * * /srv/beacon2026/deploy/backup.sh >> /var/log/beacon2026-backup.log 2>&1

set -euo pipefail
cd "$(dirname "$0")/.."

docker compose -f compose.prod.yaml --profile backup run --rm backup

# 14-day retention.
find /srv/beacon2026/backups -name '*.dump' -mtime +14 -delete

echo "$(date -u +%FT%TZ) backup complete: $(ls -t /srv/beacon2026/backups/*.dump | head -1)"
