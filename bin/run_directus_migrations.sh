#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENT="${1:-production}"

cd "$REPO_ROOT"
source "$SCRIPT_DIR/lib/core-service-data.sh"
core_compose "$ENVIRONMENT"

if [ -f src/directus/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source src/directus/.env
  set +a
fi

: "${DB_DATABASE:?DB_DATABASE is required in src/directus/.env}"
DB_PORT="${DB_PORT:-5432}"

if ! "${CORE_COMPOSE[@]}" ps --status running --services | grep -qx directus; then
  echo "The Directus container is not running for the $ENVIRONMENT stack." >&2
  echo "Start the existing deployment before running this launcher." >&2
  exit 1
fi

if ! "${CORE_COMPOSE[@]}" ps --status running --services | grep -qx db; then
  echo "The database container is not running for the $ENVIRONMENT stack." >&2
  exit 1
fi

BACKUP_DIR="$(cd "$REPO_ROOT/.." && pwd)/backups"
BACKUP_FILE="$BACKUP_DIR/pre-directus-migrations-$(date +%Y%m%d-%H%M%S).sql"
BACKUP_PARTIAL="$BACKUP_FILE.partial"
mkdir -p "$BACKUP_DIR"

echo "[backup] Exporting the database to $BACKUP_FILE"
"${CORE_COMPOSE[@]}" exec -T db \
  sh -ec 'exec pg_dump --clean -p "$1" -U "$POSTGRES_USER" -d "$2"' sh "$DB_PORT" "$DB_DATABASE" \
  > "$BACKUP_PARTIAL"
mv "$BACKUP_PARTIAL" "$BACKUP_FILE"

echo "[schema] Importing the code-first Directus configuration"
"${CORE_COMPOSE[@]}" exec -T directus \
  /directus/cli/import-all.sh

echo "[migrations] Applying all pending Directus and custom migrations"
"${CORE_COMPOSE[@]}" exec -T -w /directus directus \
  node /directus/cli.js database migrate:latest

echo "[done] Directus migrations are up to date"
