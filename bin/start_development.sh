#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

source ./bin/lib/core-service-data.sh
core_compose development

mkdir -p src/directus/uploads

./bin/check_core_service_data.sh development

env UID="$(id -u)" GID="$(id -g)" "${CORE_COMPOSE[@]}" up --build --remove-orphans
