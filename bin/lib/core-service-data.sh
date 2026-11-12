#!/usr/bin/env bash
# Shared by startup and the explicit, backed-up data upgrade.
set -euo pipefail

core_compose() {
  local environment="$1" core_root
  core_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  [[ "$environment" != mac ]] || environment=development
  case "$environment" in production|development) ;; *) echo 'Expected production or development' >&2; return 2;; esac
  CORE_ENVIRONMENT="$environment"
  CORE_COMPOSE=("$core_root/bin/podman.sh" "$environment" compose)
  CORE_STORAGE_FILE="podman/core-storage/$environment.compose.json"
  CORE_DB_VOLUME=""; CORE_MEILI_VOLUME=""
  if [[ -f "$CORE_STORAGE_FILE" ]]; then
    read -r CORE_DB_VOLUME CORE_MEILI_VOLUME < "podman/core-storage/$environment.volumes"
    [[ "$CORE_DB_VOLUME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ && "$CORE_MEILI_VOLUME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ ]] || { echo 'Invalid migrated volume metadata' >&2; return 1; }
  fi
  CORE_DB_IMAGE="$(awk '$1 == "FROM" && $2 ~ /postgis\/postgis:/ {print $2; exit}' "$core_root/podman/database/Containerfile")"
  CORE_MEILI_IMAGE="$(awk '$1 == "FROM" && $2 ~ /getmeili\/meilisearch:/ {print $2; exit}' "$core_root/podman/meilisearch/Containerfile")"
  [[ "$CORE_DB_IMAGE" =~ :([0-9]+)- ]] || return 1
  CORE_DB_MAJOR="${BASH_REMATCH[1]}"
  CORE_MEILI_VERSION="${CORE_MEILI_IMAGE##*:v}"
}

core_volume_version() {
  podman volume inspect "$1" >/dev/null # Never create an empty replacement silently.
  podman run --rm --network none --entrypoint sh --mount "type=volume,source=$1,target=/storage,readonly" "$CORE_DB_IMAGE" \
    -ec 'if [ -f "/storage/$1" ]; then cat "/storage/$1"; fi' sh "$2"
}

core_mount() {
  local container="$1" destination="$2"
  podman inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "'"$destination"'"}}{{.Type}}|{{.Source}}|{{.Name}}{{end}}{{end}}'
}

core_configured_mount() {
  local core_root
  core_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  "${CORE_COMPOSE[@]}" config | node "$core_root/bin/lib/compose-mount.ts" "$1" "$2" "${SLK_PODMAN_PROJECT:-slk-podman-${CORE_ENVIRONMENT:-production}}"
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
      if ! podman volume inspect "$volume" >/dev/null 2>&1; then return 0; fi
      mount="type=volume,source=$volume,target=/storage,readonly" ;;
    *) echo "Unsupported data mount" >&2; return 1 ;;
  esac
  podman run --rm --network none --entrypoint sh --mount "$mount" "$CORE_DB_IMAGE" \
    -ec 'if [ -f "/storage/$1" ]; then cat "/storage/$1"; fi' sh "$filename"
}

# Old upgrade sources may predate the mounted-env launcher.
core_container_exec() {
  local container="$1"; shift
  if podman exec "$container" test -x /usr/local/bin/slk-env; then
    podman exec -i "$container" /usr/local/bin/slk-env "$@"
  else
    podman exec -i "$container" "$@"
  fi
}
