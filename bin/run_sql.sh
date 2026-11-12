#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
DB_DATABASE="$(node bin/lib/environment-value.ts DB_DATABASE)"
DB_USER="$(node bin/lib/environment-value.ts DB_USER)"
DB_PORT="$(node bin/lib/environment-value.ts DB_PORT)"
exec "$SCRIPT_DIR/podman.sh" "${SLK_ENVIRONMENT:-production}" compose exec -T db psql -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" "$@"
