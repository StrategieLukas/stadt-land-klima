#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"
if [ -f src/directus/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source src/directus/.env
  set +a
fi

: "${DB_USER:?DB_USER is required}"
: "${DB_DATABASE:?DB_DATABASE is required}"
DB_PORT="${DB_PORT:-5432}"

docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec -T db pg_dump --clean -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" "$@"
