#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

mkdir -p src/directus/uploads

./bin/check_core_service_data.sh development

env UID="$(id -u)" GID="$(id -g)" docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up --build --remove-orphans
