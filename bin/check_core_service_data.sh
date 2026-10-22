#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
source "$SCRIPT_DIR/lib/core-service-data.sh"
core_compose "${1:-production}"
for service in db meilisearch; do
  container="$("${CORE_COMPOSE[@]}" ps --all --quiet "$service")"
  if [[ -n "$container" ]]; then
    if [[ "$service" == db ]]; then
      version="$(core_read_version "$container" /var/lib/postgresql/data PG_VERSION)"
      expected="$CORE_DB_MAJOR"
    else
      version="$(core_read_version "$container" /meili_data data.ms/VERSION)"
      expected="$CORE_MEILI_VERSION"
    fi
  else
    # Check Linux bind mounts even when the old container was removed.
    filename="db/PG_VERSION"
    expected="$CORE_DB_MAJOR"
    if [[ "$service" == meilisearch ]]; then filename="meilisearch/data.ms/VERSION"; expected="$CORE_MEILI_VERSION"; fi
    version=""
    if [[ -d docker/data && ( "$service" != db || "${1:-production}" != mac ) ]]; then
      version="$(docker run --rm --network none --entrypoint sh \
        --mount "type=bind,source=$PWD/docker/data,target=/storage,readonly" "$CORE_DB_IMAGE" \
        -ec 'if [ -f "/storage/$1" ]; then cat "/storage/$1"; fi' sh "$filename")"
    fi
  fi
  if [[ -n "$version" && "$version" != "$expected" ]]; then
    echo "$service data version $version requires migration to $expected." >&2
    echo "Run ./bin/upgrade_core_services.sh ${1:-production} --apply before starting the stack." >&2
    exit 1
  fi
done
