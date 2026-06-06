#!/usr/bin/env bash
# Export a sanitized production-sized database dump for staging/development.
# Usage: ./bin/db_exports/test_data_export.sh > sanitized_dump.sql

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SANITIZE_SQL="$SCRIPT_DIR/strip_personal_data.sql"

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

COMPOSE=(docker compose -f docker-compose.yaml)
if [ -f docker-compose.prod.yaml ]; then
  COMPOSE+=(-f docker-compose.prod.yaml)
fi

SANITIZED_DB="slk_sanitized_export_$$"

cleanup() {
  set +e
  "${COMPOSE[@]}" exec -T db psql -q -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$SANITIZED_DB' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1
  "${COMPOSE[@]}" exec -T db psql -q -U "$DB_USER" -d postgres -c \
    "DROP DATABASE IF EXISTS \"$SANITIZED_DB\";" \
    >/dev/null 2>&1
}
trap cleanup EXIT

echo "Creating temporary sanitized database $SANITIZED_DB from $DB_DATABASE..." >&2
"${COMPOSE[@]}" exec -T db psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d postgres -c \
  "CREATE DATABASE \"$SANITIZED_DB\" OWNER \"$DB_USER\";" \
  >/dev/null

echo "Copying source database into temporary database..." >&2
"${COMPOSE[@]}" exec -T db pg_dump \
  --no-owner \
  --no-privileges \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_DATABASE" \
  | "${COMPOSE[@]}" exec -T db psql \
      -v ON_ERROR_STOP=1 \
      -q \
      -U "$DB_USER" \
      -d "$SANITIZED_DB" \
      >/dev/null

echo "Removing personal data from temporary database..." >&2
"${COMPOSE[@]}" exec -T db psql \
  -v ON_ERROR_STOP=1 \
  -q \
  -U "$DB_USER" \
  -d "$SANITIZED_DB" \
  < "$SANITIZE_SQL" \
  >/dev/null

echo "Writing sanitized SQL dump to stdout..." >&2
"${COMPOSE[@]}" exec -T db pg_dump \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$SANITIZED_DB"
