#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
if [[ -f deploy/backup.env ]]; then set -a; source deploy/backup.env; set +a; fi
command -v node >/dev/null || { echo 'Node.js 24 is required on the backup host.' >&2; exit 1; }
command -v oci >/dev/null || { echo 'OCI CLI is required for off-VM backups.' >&2; exit 1; }
if [[ -z "${OCI_NAMESPACE:-}" || -z "${OCI_BACKUP_BUCKET:-}" ]]; then
  echo 'Configure deploy/backup.env with a private off-VM backup bucket.' >&2; exit 1
fi
exec 9>"$project_dir/backups.lock"
flock -n 9 || { echo 'A backup is already running.' >&2; exit 1; }
day="$(date -u +%F)"
mkdir -p backups
docker compose --env-file deploy/production.env -f compose.production.yaml exec -T game \
  node tools/backup-db.js "/data/backups/liftoff-$day.sqlite"
docker compose --env-file deploy/production.env -f compose.production.yaml cp \
  "game:/data/backups/liftoff-$day.sqlite" "backups/liftoff-$day.sqlite"

node tools/verify-backup.js "backups/liftoff-$day.sqlite"
node tools/backup-remote.js "backups/liftoff-$day.sqlite"
  docker compose --env-file deploy/production.env -f compose.production.yaml exec -T game \
    node -e "require('node:fs').unlinkSync('/data/backups/liftoff-$day.sqlite')"
