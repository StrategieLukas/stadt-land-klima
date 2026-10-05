#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec -T directus /directus/cli/import-all.sh
