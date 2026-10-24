#!/usr/bin/env bash
# Explicit maintenance-only cutover. All credentials stay in private files.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "Usage: $0 production|development plan /absolute/private/plan.json new_role" >&2
  echo "       $0 production|development apply /absolute/private/plan.json" >&2
  exit 2
fi
environment="$1"; action="$2"; plan_file="$3"
[[ "$plan_file" == /* && "$plan_file" != *:* ]] || { echo 'Use an absolute plan path without colons' >&2; exit 2; }
case "$action:$#" in plan:4|apply:3) ;; *) echo 'Invalid action/arguments' >&2; exit 2 ;; esac
source "$SCRIPT_DIR/lib/core-service-data.sh"
core_compose "$environment"
plan_dir="$(dirname "$plan_file")"
[[ -d "$plan_dir" ]] || { echo 'Create a private plan directory (chmod 700) first' >&2; exit 1; }
if [[ "$action" == apply ]]; then
  running="$("${CORE_COMPOSE[@]}" ps --status running --services)"
  if [[ "$running" =~ (^|$'\n')(directus|frontend)($|$'\n') ]]; then
    echo 'Stop Directus and frontend before apply. Keep the database running.' >&2
    exit 1
  fi
fi
# Use the existing Directus DB_USER as the bootstrap operator. This intentionally
# does not read/alter docker/db/.env or replace a persisted PostgreSQL password.
"${CORE_COMPOSE[@]}" run --rm --no-deps --entrypoint node \
  --user "$(id -u):$(id -g)" \
  -v "$plan_dir:/security-plan" directus \
  /directus/cli/tasks/hardenDatabaseRole.ts "$action" "/security-plan/$(basename "$plan_file")" "${@:4}"
