#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
source "$SCRIPT_DIR/lib/core-service-data.sh"
core_compose production
node "$SCRIPT_DIR/lib/maintenance-meta.ts"
"${CORE_COMPOSE[@]}" --profile maintenance up -d --force-recreate maintenance
"${CORE_COMPOSE[@]}" stop frontend directus meilisearch cache db
