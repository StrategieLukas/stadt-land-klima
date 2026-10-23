#!/usr/bin/env bash
# Infrastructure orchestration stays in Bash alongside the existing deploy scripts.
set -euo pipefail
umask 077
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
source "$SCRIPT_DIR/lib/core-service-data.sh"

if [[ "${1:-}" == --help || $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 production|development [--apply]
Without --apply, only inspect the existing containers and target versions.
--apply stops application writers, exports ALL non-template PostgreSQL databases
and roles, restores into a separate cluster, imports a Meilisearch dump into a
separate directory, and verifies table hashes/counts and search indexes/settings/keys.
Only after verification are the data directories swapped. Old directories and
private backups are retained. Applications remain stopped: run start_production.sh
or start_development.sh afterward. PostgreSQL 17 keeps the existing mount layout.
The automated cutover requires the repository's Linux bind-mounted data layout.
Named-volume/macOS installations must use a separate dump/restore migration.
Do not allow external database/search writers during this maintenance window."
  exit 0
fi
environment="$1"
[[ "$environment" == production || "$environment" == development ]] || { echo "Use production or development" >&2; exit 2; }
[[ -z "${2:-}" || "$2" == --apply ]] || { echo "Unknown option: $2" >&2; exit 2; }
core_compose "$environment"
upgrade_timeout="${CORE_UPGRADE_TIMEOUT_SECONDS:-3600}"
[[ "$upgrade_timeout" =~ ^[1-9][0-9]*$ ]] || { echo "CORE_UPGRADE_TIMEOUT_SECONDS must be a positive integer." >&2; exit 2; }
db_container="$("${CORE_COMPOSE[@]}" ps --all --quiet db)"
meili_container="$("${CORE_COMPOSE[@]}" ps --all --quiet meilisearch)"
[[ -n "$db_container" && -n "$meili_container" ]] || { echo "Existing db and meilisearch containers are required; do not remove them before migration." >&2; exit 1; }
db_version="$(docker inspect "$db_container" --format '{{.Config.Image}}')"
meili_version="$(docker inspect "$meili_container" --format '{{.Config.Image}}')"
echo "PostgreSQL: $db_version -> $CORE_DB_IMAGE"
echo "Meilisearch: $meili_version -> $CORE_MEILI_IMAGE"
[[ "${2:-}" == --apply ]] || exit 0

[[ "${BASH_VERSINFO[0]}" -ge 4 ]] || { echo "Bash 4 or newer is required." >&2; exit 1; }
db_type=""; db_source=""; meili_type=""; meili_source=""
IFS='|' read -r db_type db_source _ <<< "$(core_mount "$db_container" /var/lib/postgresql/data)"
IFS='|' read -r meili_type meili_source _ <<< "$(core_mount "$meili_container" /meili_data)"
[[ "$db_type" == bind && "$meili_type" == bind ]] || { echo "Automatic cutover requires bind mounts; existing data was not changed." >&2; exit 1; }
[[ "$db_source" == "$REPO_ROOT/docker/data/db" && "$meili_source" == "$REPO_ROOT/docker/data/meilisearch" ]] || {
  echo "Custom data directories require an explicit migration; existing data was not changed." >&2; exit 1;
}
# Use the patched build base, not a still-running container's old Node binary.
node_image="$(awk '$1 == "FROM" && $2 ~ /^node:/ {print $2; exit}' docker/frontend/Dockerfile)"
[[ "$node_image" == node:* ]] || exit 1
docker pull "$node_image"
docker run --rm --network none --entrypoint node "$node_image" -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (!(major === 22 && minor >= 18 || major >= 24)) throw new Error("Native TypeScript support is required");
'
docker pull "$CORE_DB_IMAGE"
docker pull "$CORE_MEILI_IMAGE"
current_db_major="$(core_read_version "$db_container" /var/lib/postgresql/data PG_VERSION)"
current_meili_version="$(core_read_version "$meili_container" /meili_data data.ms/VERSION)"
if [[ "$current_db_major" == "$CORE_DB_MAJOR" && "$current_meili_version" == "$CORE_MEILI_VERSION" ]]; then
  echo "Data formats already match the configured targets. No migration needed."
  exit 0
fi
[[ "$current_db_major" =~ ^[0-9]+$ && "$current_db_major" -le "$CORE_DB_MAJOR" ]] || { echo "Refusing a PostgreSQL downgrade." >&2; exit 1; }
[[ "$current_meili_version" =~ ^1\.([0-9]+)\.([0-9]+)$ ]] || { echo "Unsupported Meilisearch source version." >&2; exit 1; }
source_meili_minor="${BASH_REMATCH[1]}"
source_meili_patch="${BASH_REMATCH[2]}"
[[ "$CORE_MEILI_VERSION" =~ ^1\.([0-9]+)\.([0-9]+)$ ]] || exit 1
target_meili_minor="${BASH_REMATCH[1]}"
target_meili_patch="${BASH_REMATCH[2]}"
[[ "$source_meili_minor" -lt "$target_meili_minor" ||
  ( "$source_meili_minor" -eq "$target_meili_minor" && "$source_meili_patch" -le "$target_meili_patch" ) ]] || {
  echo "Refusing a Meilisearch downgrade." >&2; exit 1;
}

backup_root="$REPO_ROOT/../backups"
mkdir -p "$backup_root"
lock_dir="$backup_root/.$(basename "$REPO_ROOT").core-upgrade-lock"
mkdir "$lock_dir" || { echo "Another migration is active, or its lock needs review: $lock_dir" >&2; exit 1; }
backup="$(mktemp -d "$backup_root/core-services-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
run_id="$(basename "$backup")"
db_target="slk-upgrade-db-$run_id"
meili_target="slk-upgrade-meili-$run_id"
db_new="$db_source.upgrade-$run_id"
meili_new="$meili_source.upgrade-$run_id"
swapped=false
cleanup() {
  local status=$?
  docker rm -f "$db_target" "$meili_target" >/dev/null 2>&1 || true
  rmdir "$lock_dir" 2>/dev/null || true
  if ((status != 0)); then
    echo "Upgrade stopped. Private diagnostics/backups: $backup" >&2
    if [[ "$swapped" == false ]]; then
      echo "Original data directories remain in place. Applications remain stopped." >&2
    else
      echo "Cutover occurred. Keep maintenance active and inspect the preserved old directories before recovery." >&2
    fi
  fi
}
trap cleanup EXIT
echo "Private migration backup: $backup"
printf 'services:\n  db:\n    image: "%s"\n  meilisearch:\n    image: "%s"\n' \
  "$(docker inspect "$db_container" --format '{{.Image}}')" \
  "$(docker inspect "$meili_container" --format '{{.Image}}')" > "$backup/rollback.compose.yaml"
# Docker --env-file does not parse Compose's quotes/inline comments. Preserve
# the already resolved environment from the old containers, never re-parse it.
resolved_env() {
  docker inspect "$1" | docker run --rm -i --network none --entrypoint node "$node_image" -e '
    const config = JSON.parse(require("node:fs").readFileSync(0, "utf8"))[0];
    for (const entry of config.Config.Env.filter(value => value.startsWith(process.argv[1]))) {
      if (/[\r\n]/.test(entry)) throw new Error("Multiline environment values require manual migration");
      process.stdout.write(entry + "\n");
    }
  ' "$2"
}
resolved_env "$db_container" POSTGRES_ > "$backup/db-runtime.env"
resolved_env "$meili_container" MEILI_ > "$backup/meilisearch-runtime.env"
if [[ "$environment" == production ]]; then
  "$SCRIPT_DIR/stop.sh"
else
  "${CORE_COMPOSE[@]}" stop frontend directus
fi
# Start the existing containers with their original images, never the new image
# against the old data. Needed when stop.sh has already stopped the database.
docker start "$db_container" "$meili_container" >/dev/null
source_db() {
  docker exec -i "$db_container" sh -ec 'exec psql -XqAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"' sh "$@"
}
target_db() {
  docker exec -i "$db_target" sh -ec 'exec psql -XqAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"' sh "$@"
}
wait_db() {
  local container="$1"
  for ((attempt=0; attempt<120; attempt++)); do
    if docker exec "$container" sh -ec 'pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER"' 2>/dev/null; then return 0; fi
    sleep 1
  done
  docker logs "$container" > "$backup/database-startup.log" 2>&1
  return 1
}
wait_db "$db_container"
docker exec "$db_container" sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -XqAt -v ON_ERROR_STOP=1 -h "$(hostname -i)" -U "$POSTGRES_USER" -d postgres -c "SELECT 1"' \
  > "$backup/source-password-check.log" 2>&1
db_user="$(docker exec "$db_container" sh -ec 'printf "%s" "$POSTGRES_USER"')"
[[ "$db_user" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "Database superuser name requires a manual globals restore." >&2; exit 1; }
tablespaces="$(printf '%s\n' "SELECT count(*) FROM pg_tablespace WHERE spcname NOT IN ('pg_default', 'pg_global');" | source_db postgres)"
[[ "$tablespaces" == 0 ]] || { echo "Custom tablespaces require manual migration." >&2; exit 1; }
legacy_logins="$(printf '%s\n' "SELECT count(*) FROM pg_authid WHERE rolcanlogin AND (rolpassword LIKE 'md5%' OR rolpassword IS NULL) AND rolname <> current_user;" | source_db postgres)"
[[ "$legacy_logins" == 0 ]] || { echo "Other login roles need SCRAM password rotation before migrating to the new authentication defaults." >&2; exit 1; }
mapfile -t databases < <(printf '%s\n' 'SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname;' | source_db postgres)
[[ ${#databases[@]} -gt 0 ]] || exit 1
docker exec "$db_container" sh -ec 'exec pg_dumpall -U "$POSTGRES_USER" --globals-only --quote-all-identifiers' > "$backup/globals.sql"
# initdb has already created this one role. All its ALTER ROLE statements and
# other roles/memberships/password hashes still come from the original dump.
while IFS= read -r line; do
  [[ "$line" == "CREATE ROLE \"$db_user\";" ]] || printf '%s\n' "$line"
done < "$backup/globals.sql" > "$backup/globals-restore.sql"
index=0
for database in "${databases[@]}"; do
  printf '%s\n' "$database" > "$backup/database-$index.name"
  docker exec "$db_container" sh -ec 'exec pg_dump -U "$POSTGRES_USER" --format=custom --create --quote-all-identifiers -d "$1"' sh "$database" > "$backup/database-$index.dump"
  source_db "$database" < "$SCRIPT_DIR/lib/core-upgrade-table-checks.sql" > "$backup/database-$index.before"
  index=$((index+1))
done

meili_helper() {
  local container="$1" action="$2"
  docker run --rm -i --user "$(id -u):$(id -g)" --network "container:$container" \
    --env-file "$backup/meilisearch-runtime.env" \
    --env "CORE_UPGRADE_TIMEOUT_SECONDS=${CORE_UPGRADE_TIMEOUT_SECONDS:-3600}" \
    --mount "type=bind,source=$SCRIPT_DIR/lib/meilisearch-migration.ts,target=/migration.ts,readonly" \
    --mount "type=bind,source=$backup,target=/backup" --entrypoint node "$node_image" /migration.ts "$action"
}
meili_helper "$meili_container" export
dump_file="$(cat "$backup/meilisearch-dump-filename")"
dump_dir="$(docker exec "$meili_container" sh -ec 'printf "%s" "${MEILI_DUMP_DIR:-/meili_data/dumps}"')"
if [[ "$dump_dir" != /* ]]; then
  dump_dir="$(docker inspect "$meili_container" --format '{{.Config.WorkingDir}}')/$dump_dir"
fi
docker cp "$meili_container:$dump_dir/$dump_file" "$backup/meilisearch.dump"
chmod 600 "$backup/meilisearch.dump"

# New data lives alongside the old paths, on the same filesystem. Old data is
# never mounted writable by the new versions during validation.
docker run --rm --network none --entrypoint sh \
  --mount "type=bind,source=$REPO_ROOT/docker/data,target=/storage" "$CORE_DB_IMAGE" \
  -ec 'test ! -e "/storage/$1"; test ! -e "/storage/$2"; mkdir "/storage/$1" "/storage/$2"' \
  sh "$(basename "$db_new")" "$(basename "$meili_new")"
docker run -d --name "$db_target" --network none --env-file "$backup/db-runtime.env" \
  --env POSTGRES_DB=postgres --env POSTGRES_HOST_AUTH_METHOD=scram-sha-256 \
  --mount "type=bind,source=$db_new,target=/var/lib/postgresql/data" "$CORE_DB_IMAGE" >/dev/null
wait_db "$db_target"
target_db template1 < "$backup/globals-restore.sql" > "$backup/globals-restore.log" 2>&1
# Imported PostgreSQL 13 MD5 password hashes cannot authenticate against the
# new SCRAM host rules. Rehash the configured bootstrap login without changing
# its password or exposing it in arguments/logs. Other legacy logins fail above.
docker exec -i "$db_target" sh -ec 'exec psql -Xq -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d template1' \
  > "$backup/password-upgrade.log" 2>&1 <<'SQL'
\getenv upgrade_user POSTGRES_USER
\getenv upgrade_password POSTGRES_PASSWORD
SET password_encryption = 'scram-sha-256';
ALTER ROLE :"upgrade_user" PASSWORD :'upgrade_password';
\unset upgrade_password
SQL
index=0
for database in "${databases[@]}"; do
  docker exec -i "$db_target" sh -ec 'exec pg_restore -U "$POSTGRES_USER" --clean --if-exists --create --exit-on-error -d template1' \
    < "$backup/database-$index.dump" > "$backup/database-$index.restore.log" 2>&1
  target_db "$database" < "$SCRIPT_DIR/lib/core-upgrade-table-checks.sql" > "$backup/database-$index.after"
  diff -u "$backup/database-$index.before" "$backup/database-$index.after" > "$backup/database-$index.diff"
  printf '%s\n' 'ANALYZE;' | target_db "$database" > /dev/null
  index=$((index+1))
done
echo "Verified all $index PostgreSQL databases: application table counts and row hashes match."
docker run -d --name "$meili_target" --env-file "$backup/meilisearch-runtime.env" \
  --mount "type=bind,source=$meili_new,target=/meili_data" \
  --mount "type=bind,source=$backup/meilisearch.dump,target=/migration.dump,readonly" \
  "$CORE_MEILI_IMAGE" meilisearch --import-dump /migration.dump >/dev/null
# The temporary Meilisearch has no published ports; its helper shares its network.
for ((attempt=0; attempt<upgrade_timeout; attempt++)); do
  if docker exec "$meili_target" sh -ec 'wget -q -O /dev/null http://127.0.0.1:7700/health' 2>/dev/null; then break; fi
  if [[ "$(docker inspect "$meili_target" --format '{{.State.Running}}')" != true ]]; then
    docker logs "$meili_target" > "$backup/meilisearch-import.log" 2>&1
    exit 1
  fi
  sleep 1
done
docker logs "$meili_target" > "$backup/meilisearch-import.log" 2>&1
meili_helper "$meili_target" validate
docker stop "$db_target" "$meili_target" >/dev/null
"${CORE_COMPOSE[@]}" stop db meilisearch
docker run --rm --network none --entrypoint sh \
  --mount "type=bind,source=$REPO_ROOT/docker/data,target=/storage" \
  --mount "type=bind,source=$SCRIPT_DIR/lib/core-data-cutover.sh,target=/cutover.sh,readonly" \
  "$CORE_DB_IMAGE" /cutover.sh "$run_id"
swapped=true
"${CORE_COMPOSE[@]}" up -d --no-deps --force-recreate db meilisearch
"$SCRIPT_DIR/check_core_service_data.sh" "$environment"
echo "Core data upgrade complete. Backups: $backup"
echo "Old data: docker/data/db.before-$run_id and docker/data/meilisearch.before-$run_id"
echo "Application services remain stopped. Start them using the normal $environment script."
