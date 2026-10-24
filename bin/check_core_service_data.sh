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
    destination=/var/lib/postgresql/data; filename=PG_VERSION; expected="$CORE_DB_MAJOR"
    if [[ "$service" == meilisearch ]]; then destination=/meili_data; filename=data.ms/VERSION; expected="$CORE_MEILI_VERSION"; fi
    mount="$(core_configured_mount "$service" "$destination")"
    # A fresh checkout may not have a bind directory yet. Existing storage is
    # always inspected, including macOS/default and custom named volumes.
    if [[ "$mount" == bind\|* ]]; then
      IFS='|' read -r _ source _ <<< "$mount"
      if [[ ! -d "$source" ]]; then version=""; else version="$(core_storage_version "$mount" "$filename")"; fi
    else
      version="$(core_storage_version "$mount" "$filename")"
    fi
  fi
  if [[ -n "$version" && "$version" != "$expected" ]]; then
    echo "$service data version $version requires migration to $expected." >&2
    echo "Run ./bin/upgrade_core_services.sh ${1:-production} --apply before starting the stack." >&2
    exit 1
  fi
done
