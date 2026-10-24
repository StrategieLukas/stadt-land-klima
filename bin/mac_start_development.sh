#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
source "$SCRIPT_DIR/lib/core-service-data.sh"
core_compose mac

mkdir -p src/directus/uploads

./bin/check_core_service_data.sh mac

env UID="$(id -u)" GID="$(id -g)" "${CORE_COMPOSE[@]}" up --build --remove-orphans
