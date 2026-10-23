#!/usr/bin/env bash
# Shared by startup and the explicit, backed-up data upgrade.
set -euo pipefail

core_compose() {
  local environment="$1"
  case "$environment" in
    production) CORE_COMPOSE=(docker compose -f docker-compose.yaml -f docker-compose.prod.yaml) ;;
    development) CORE_COMPOSE=(docker compose -f docker-compose.yaml -f docker-compose.dev.yaml) ;;
    mac) CORE_COMPOSE=(docker compose -f docker-compose.yaml -f docker-compose.dev-mac.yaml) ;;
    *) echo "Expected production, development or mac" >&2; return 2 ;;
  esac
  # Logical migrations select fresh named volumes only after verified restores.
  CORE_STORAGE_FILE="docker/core-storage/$environment.compose.json"
  CORE_DB_VOLUME=""; CORE_MEILI_VOLUME=""
  if [[ -f "$CORE_STORAGE_FILE" ]]; then
    read -r CORE_DB_VOLUME CORE_MEILI_VOLUME < "docker/core-storage/$environment.volumes"
    [[ "$CORE_DB_VOLUME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ && "$CORE_MEILI_VOLUME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ ]] || { echo 'Invalid migrated volume metadata' >&2; return 1; }
    CORE_COMPOSE+=(-f "$CORE_STORAGE_FILE")
  fi
  CORE_DB_IMAGE="$("${CORE_COMPOSE[@]}" config --images | awk '/^postgis\/postgis:/ { print; exit }')"
  CORE_MEILI_IMAGE="$("${CORE_COMPOSE[@]}" config --images | awk '/^getmeili\/meilisearch:/ { print; exit }')"
  [[ "$CORE_DB_IMAGE" =~ :([0-9]+)- ]] || return 1
  # shellcheck disable=SC2034 # Public outputs consumed by the sourcing scripts.
  CORE_DB_MAJOR="${BASH_REMATCH[1]}"
  # shellcheck disable=SC2034 # Public outputs consumed by the sourcing scripts.
  CORE_MEILI_VERSION="${CORE_MEILI_IMAGE##*:v}"
}

core_volume_version() {
  docker volume inspect "$1" >/dev/null # Never create an empty replacement silently.
  docker run --rm --network none --entrypoint sh --mount "type=volume,source=$1,target=/storage,readonly" "$CORE_DB_IMAGE" \
    -ec 'if [ -f "/storage/$1" ]; then cat "/storage/$1"; fi' sh "$2"
}

core_mount() {
  local container="$1" destination="$2"
  docker inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "'"$destination"'"}}{{.Type}}|{{.Source}}|{{.Name}}{{end}}{{end}}'
}

core_read_version() {
  local container="$1" destination="$2" filename="$3" mount_type source volume
  IFS='|' read -r mount_type source volume <<< "$(core_mount "$container" "$destination")"
  local mount
  case "$mount_type" in
    bind) mount="type=bind,source=$source,target=/storage,readonly" ;;
    volume) mount="type=volume,source=$volume,target=/storage,readonly" ;;
    *) echo "Unsupported data mount for $container" >&2; return 1 ;;
  esac
  docker run --rm --network none --entrypoint sh --mount "$mount" "$CORE_DB_IMAGE" \
    -ec 'if [ -f "/storage/$1" ]; then cat "/storage/$1"; fi' sh "$filename"
}
