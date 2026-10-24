#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

source "$SCRIPT_DIR/lib/core-service-data.sh"
core_compose production
"${CORE_COMPOSE[@]}" exec -T directus /directus/cli/import-all.sh
