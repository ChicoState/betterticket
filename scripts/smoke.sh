#!/usr/bin/env bash
set -euo pipefail

project_name="betterticket-smoke-$$"
compose=(docker compose -p "$project_name" -f compose.yml)

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${compose[@]}" config --quiet
"${compose[@]}" up --detach postgres object-storage

for service in postgres object-storage; do
  for _ in $(seq 1 30); do
    container_id=$("${compose[@]}" ps --quiet "$service")
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")
    if [ "$status" = "healthy" ]; then
      break
    fi
    sleep 2
  done

  if [ "${status:-}" != "healthy" ]; then
    "${compose[@]}" logs "$service"
    echo "$service did not become healthy" >&2
    exit 1
  fi
done

"${compose[@]}" exec --no-TTY postgres psql -U betterticket -d betterticket -tAc 'SELECT 1' | grep -qx '1'
echo "Infrastructure smoke test passed."

