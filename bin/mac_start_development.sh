#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

mkdir -p src/directus/uploads

./bin/check_core_service_data.sh mac

env UID="$(id -u)" GID="$(id -g)" docker compose -f docker-compose.yaml -f docker-compose.dev-mac.yaml up --build --remove-orphans
