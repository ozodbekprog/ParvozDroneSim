#!/usr/bin/env bash
set -euo pipefail
# Called automatically on failed activation, or manually with the recorded directory/image.
previous_dir="$(realpath "${1:?Pass the previous release directory}")"
previous_image="${2:?Pass the previous local Docker image ID}"
[[ -f "$previous_dir/compose.production.yaml" && -f "$previous_dir/deploy/production.env" ]] || { echo 'Previous release is incomplete.' >&2; exit 1; }
[[ "$previous_image" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid previous image ID.' >&2; exit 1; }
docker image inspect "$previous_image" >/dev/null
override="$(mktemp)"
trap 'rm -f -- "$override"' EXIT
printf 'services:\n  game:\n    image: "%s"\n' "$previous_image" > "$override"
docker compose --project-name liftoff --project-directory "$previous_dir" --env-file "$previous_dir/deploy/production.env" \
  -f "$previous_dir/compose.production.yaml" -f "$override" up --no-build --force-recreate --wait --wait-timeout 120 -d
docker compose --project-name liftoff --env-file "$previous_dir/deploy/production.env" -f "$previous_dir/compose.production.yaml" \
  exec -T game node -e "fetch('http://127.0.0.1:2567/api/internal/resume',{method:'POST'}).then(r=>{if(!r.ok)process.exit(1)})"
echo 'Previous image and assets restored. Account database was preserved.'
