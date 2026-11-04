#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
if [[ ! -f deploy/production.env ]]; then
  echo "Copy deploy/production.env.example to deploy/production.env and set GAME_DOMAIN." >&2
  exit 1
fi

compose=(docker compose --env-file deploy/production.env -f compose.production.yaml)
previous_container="$("${compose[@]}" ps -q game)"
previous_image=''
previous_dir=''
if [[ -n "$previous_container" ]]; then
  previous_image="$(docker inspect --format '{{.Image}}' "$previous_container")"
  previous_dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$previous_container")"
  if [[ "$(realpath "$previous_dir")" == "$project_dir" ]]; then
    echo 'Put updates in a new release directory so the running assets and rollback stay intact.' >&2; exit 1
  fi
  # Keep the old image reachable after the shared latest tag is replaced.
  # Some Docker image stores remove an untagged image when its container exits.
  docker image tag "$previous_image" "liftoff-game:rollback-${previous_image#sha256:}"
  printf '%s\n' "$previous_dir" "$previous_image" > deploy/previous-release.txt
fi

# Build the same generated content for the Caddy bind mounts and the game image.
docker run --rm --user "$(id -u):$(id -g)" -e npm_config_cache=/tmp/npm-cache \
  -v "$project_dir:/app" -w /app node:24-bookworm-slim \
  sh -c 'npm ci && npm run build && npm run content:check'
compose=(docker compose --env-file deploy/production.env -f compose.production.yaml)
if [[ "${DEPLOY_INCREMENTAL:-0}" == "1" ]]; then
  [[ -n "$previous_image" ]] || { echo 'Incremental build needs a retained running image.' >&2; exit 1; }
  bash deploy/build-incremental.sh "$previous_image"
else
  "${compose[@]}" build game
fi
if [[ -n "$previous_image" ]]; then docker image inspect "$previous_image" >/dev/null; fi
drained=0
resume_if_needed() {
  if [[ "$drained" == "1" ]]; then
    "${compose[@]}" exec -T game node -e "fetch('http://127.0.0.1:2567/api/internal/resume',{method:'POST'}).catch(()=>{})" || true
  fi
}
trap resume_if_needed EXIT

if [[ -n "$("${compose[@]}" ps -q game)" ]]; then
  "${compose[@]}" exec -T game node -e "fetch('http://127.0.0.1:2567/api/internal/drain',{method:'POST'}).then(r=>{if(!r.ok)process.exit(1)})"
  drained=1
  echo 'Waiting up to 12 minutes for active races to finish.'
  active=unknown
  for ((attempt=0; attempt<144; attempt++)); do
    active="$("${compose[@]}" exec -T game node -e "fetch('http://127.0.0.1:2567/api/internal/status').then(r=>r.json()).then(x=>console.log(x.activeRooms))")"
    if [[ "$active" == "0" ]]; then break; fi
    sleep 5
  done
  if [[ "$active" != "0" ]]; then
    echo 'Active races did not finish. Existing deployment remains online.' >&2
    exit 1
  fi
fi

if ! "${compose[@]}" up --no-build --force-recreate --wait --wait-timeout 120 -d; then
  if [[ -n "$previous_image" ]]; then bash deploy/rollback.sh "$previous_dir" "$previous_image"; fi
  exit 1
fi
drained=0
"${compose[@]}" ps
echo "Check https://<your GAME_DOMAIN>/api/health after DNS and HTTPS become ready."
