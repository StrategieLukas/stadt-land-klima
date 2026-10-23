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

core_configured_mount() {
  local node_image
  node_image="$(awk '$1 == "FROM" && $2 ~ /^node:/ {print $2; exit}' docker/frontend/Dockerfile)"
  [[ "$node_image" == node:* ]] || return 1
  # Pipe resolved secrets directly to the helper; print only mount metadata.
  "${CORE_COMPOSE[@]}" config --format json | docker run --rm -i --network none --entrypoint node "$node_image" -e '
    const config = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
    const mount = config.services[process.argv[1]].volumes.find(mount => mount.target === process.argv[2]);
    if (!mount) throw Error("Missing configured service storage");
    if (mount.type === "bind") process.stdout.write(`bind|${mount.source}|`);
    else if (mount.type === "volume") process.stdout.write(`volume||${config.volumes[mount.source].name}`);
    else throw Error("Unsupported storage type");
  ' "$1" "$2"
}

core_read_version() {
  core_storage_version "$(core_mount "$1" "$2")" "$3"
}

core_storage_version() {
  local filename="$2" mount_type source volume
  IFS='|' read -r mount_type source volume <<< "$1"
  local mount
  case "$mount_type" in
    bind) mount="type=bind,source=$source,target=/storage,readonly" ;;
    volume)
      # A missing external volume must never become an empty replacement.
      if ! docker volume inspect "$volume" >/dev/null 2>&1; then return 0; fi
      mount="type=volume,source=$volume,target=/storage,readonly" ;;
    *) echo "Unsupported data mount" >&2; return 1 ;;
  esac
  docker run --rm --network none --entrypoint sh --mount "$mount" "$CORE_DB_IMAGE" \
    -ec 'if [ -f "/storage/$1" ]; then cat "/storage/$1"; fi' sh "$filename"
}
