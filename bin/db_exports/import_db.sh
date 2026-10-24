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

: "${DB_DATABASE:?DB_DATABASE is required}"
DB_PORT="${DB_PORT:-5432}"

source "$SCRIPT_DIR/../lib/core-service-data.sh"
core_compose production
"${CORE_COMPOSE[@]}" exec -T db sh -ec '
  port=$1; database=$2; shift 2
  exec psql -v ON_ERROR_STOP=1 -p "$port" -U "$POSTGRES_USER" -d "$database" "$@"
' sh "$DB_PORT" "$DB_DATABASE" "$@"
