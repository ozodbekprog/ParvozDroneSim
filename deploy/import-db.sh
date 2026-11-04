#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
source_file="${1:-}"
if [[ ! -f "$source_file" ]]; then echo 'Usage: ./deploy/import-db.sh /absolute/path/liftoff-migration.sqlite' >&2; exit 1; fi
source_file="$(realpath "$source_file")"
compose=(docker compose --env-file deploy/production.env -f compose.production.yaml)
"${compose[@]}" stop game
restart_game() { "${compose[@]}" up -d game; }
trap restart_game EXIT
"${compose[@]}" run --rm --no-deps --user 0 -v "$source_file:/tmp/liftoff-import.sqlite:ro" \
  --entrypoint sh game -c 'node tools/import-db.js /tmp/liftoff-import.sqlite --replace && chown -R node:node /data'
"${compose[@]}" up -d game
trap - EXIT
echo 'Check login and progress before sharing the public link.'
