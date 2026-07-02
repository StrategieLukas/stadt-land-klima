#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAINTENANCE_META_FILE="$REPO_ROOT/docker/maintenance/maintenance-meta.js"

write_maintenance_meta() {
	local started_at
	started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

	cat > "$MAINTENANCE_META_FILE" <<EOF
window.__MAINTENANCE_STARTED_AT = "$started_at";
EOF
}

cd "$REPO_ROOT"

echo "[maintenance] Activating maintenance container"
write_maintenance_meta
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d maintenance

echo "[stack] Stopping production application services"
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml stop frontend directus meilisearch cache db
