#!/usr/bin/env bash
# Full Docker production backup based on the original production recovery script.
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
backup_dir=''
stage=preflight
failed() {
  local status="$1" line="$2"
  printf 'BACKUP FAILED during %s at line %s (exit %s). Directory: %s\n' \
    "$stage" "$line" "$status" "${backup_dir:-not created}" >&2
  echo 'Services are not automatically restarted. Inspect their state before resuming traffic.' >&2
  exit "$status"
}
trap 'failed "$?" "$LINENO"' ERR
trap 'failed 130 "$LINENO"' INT
trap 'failed 143 "$LINENO"' TERM
usage() {
  cat <<'HELP'
Usage: bin/full-export.sh --writers-stopped [--output backups/NAME] [--config LABEL=/path/to/file ...]

Docker production export; resolves the checkout from this script's location.
Enable gateway maintenance and pause external writers/deployments BEFORE running.
--writers-stopped acknowledges that preparation; this script stops app/data services.
Existing containers are used exclusively: no build, pull, up, create or upgrade.
Services remain stopped on success; failures never automatically restart them.

Captures application SQL, all databases/roles, checkout/config/uploads/local data,
external and named-volume mounts, frontend output, project images and metadata.
Output defaults to a new private directory under this checkout's backups/.
Additional --config files are copied, never sourced. The export contains secrets.
See bin/FULL_EXPORT.md for recovery and verification instructions.
HELP
}
die() {
  printf '%s\n' "$*" >&2
  if [[ -n "$backup_dir" ]]; then failed 1 "${BASH_LINENO[0]}"; fi
  exit 1
}
output=''
writers_stopped=false
config_labels=()
config_paths=()
while (($#)); do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --writers-stopped) writers_stopped=true; shift ;;
    --output)
      [[ $# -ge 2 && -z "$output" ]] || die 'Use --output once, followed by a new directory.'
      output="$2"; shift 2 ;;
    --config)
      [[ $# -ge 2 && "$2" == *=* ]] || die 'Use --config LABEL=/path/to/file.'
      label="${2%%=*}"; path="${2#*=}"
      [[ "$label" =~ ^[a-z][a-z0-9-]*$ && -f "$path" && ! -L "$path" && "$path" != *$'\n'* && "$path" != *$'\t'* ]] || die 'Config labels must be simple lowercase names; paths must be regular files.'
      for existing in "${config_labels[@]}"; do [[ "$label" != "$existing" ]] || die 'Duplicate config label.'; done
      config_labels+=("$label"); config_paths+=("$(realpath -- "$path")"); shift 2 ;;
    *) usage >&2; exit 2 ;;
  esac
done
[[ "$writers_stopped" == true ]] || die 'Enable maintenance, pause external writers/deployments, then pass --writers-stopped.'
[[ -z "${DOCKER_HOST:-}" && -z "${DOCKER_CONTEXT:-}" ]] || die 'Remote Docker/context overrides are unsupported; run on the source host.'
# Disconnect stdin even when launched from an operator shell/here-document.
exec </dev/null
cd "$REPO_ROOT"
for tool in docker git tar gzip sha256sum realpath stat flock mktemp find sort xargs awk; do
  command -v "$tool" >/dev/null || die "$tool is required."
done
# Always address the local default Docker context; respect existing Compose project/env selection.
docker() { command docker --context default "$@"; }
source "$SCRIPT_DIR/lib/core-service-data.sh"
core_compose production
compose=("${CORE_COMPOSE[@]}")

declare -A containers images stopped_state project_state
services=(db frontend directus meilisearch cache)
for service in "${services[@]}"; do
  id="$("${compose[@]}" ps --all --quiet "$service")"
  [[ "$id" =~ ^[a-f0-9]{12,64}$ ]] || die "Expected exactly one existing $service container. No containers will be created."
  containers["$service"]="$id"
done
project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${containers[db]}")"
[[ "$project" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]] || die 'Missing or invalid Compose project label.'
for service in "${services[@]}"; do
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${containers[$service]}")" == "$project" ]] || die 'Source containers belong to different projects.'
  images["$service"]="$(docker inspect --format '{{.Image}}' "${containers[$service]}")"
  [[ "${images[$service]}" =~ ^(sha256:)?[a-f0-9]{64}$ ]] || die 'Invalid source image ID.'
done
# A checkout tar cannot recover remote object storage; refuse a misleading complete export.
runtime_env="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${containers[directus]}")"
while IFS= read -r entry; do
  case "$entry" in
    STORAGE_LOCATIONS=local|STORAGE_LOCAL_DRIVER=local|STORAGE_LOCAL_ROOT=/directus/uploads|STORAGE_LOCAL_ROOT=./uploads) ;;
    STORAGE_LOCATIONS=*|STORAGE_LOCAL_DRIVER=*|STORAGE_LOCAL_ROOT=*) die 'Nonstandard Directus upload storage needs a separate backup plan.' ;;
  esac
done <<< "$runtime_env"
unset runtime_env

archive_command=(tar)
copy_command=(cat)
if ((EUID != 0)); then
  command -v sudo >/dev/null || die 'sudo is required to archive database-owned checkout files.'
  sudo -v
  archive_command=(sudo tar)
  copy_command=(sudo cat)
fi
[[ ! -L "$REPO_ROOT/backups" ]] || die 'backups/ must not be a symlink.'
mkdir -p -m 700 "$REPO_ROOT/backups"
[[ ! -L "$REPO_ROOT/backups/.full-export.lock" && ( ! -e "$REPO_ROOT/backups/.full-export.lock" || -f "$REPO_ROOT/backups/.full-export.lock" ) ]] || die 'The export lock must be a regular file, without a symlink.'
exec {backup_lock}>>"$REPO_ROOT/backups/.full-export.lock"
if ((EUID == 0)); then
  chown "$(stat -c '%u:%g' "$REPO_ROOT")" "$REPO_ROOT/backups/.full-export.lock"
fi
flock --nonblock "$backup_lock" || die 'Another full export is already running.'
if [[ -n "$output" ]]; then
  [[ "$output" == /* ]] || output="$REPO_ROOT/$output"
  output="$(realpath -m -- "$output")"
  [[ "$output" == "$REPO_ROOT/backups/"* && ! -e "$output" && ! -L "$output" ]] || die 'Output must be a new directory under this checkout’s backups/.'
  mkdir -m 700 -- "$output"
  backup_dir="$output"
else
  backup_dir="$(mktemp -d "$REPO_ROOT/backups/full-export-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
fi
printf 'Backup destination: %s\n' "$backup_dir"
printf '%s\n' "$project" > "$backup_dir/project.txt"
printf '%s\n' "${images[db]}" > "$backup_dir/database-image.txt"
# Optional locks disabled: root must not rewrite a deploy-owned .git/index.
GIT_OPTIONAL_LOCKS=0 git -c safe.directory="$REPO_ROOT" rev-parse HEAD > "$backup_dir/git-commit.txt"
GIT_OPTIONAL_LOCKS=0 git -c safe.directory="$REPO_ROOT" status --short > "$backup_dir/git-status.txt"

stage='stopping writers'
echo 'Stopping application services, then search and cache...'
docker stop --time 60 "${containers[frontend]}" "${containers[directus]}" >/dev/null
docker stop --time 60 "${containers[meilisearch]}" "${containers[cache]}" >/dev/null
for service in meilisearch cache; do
  [[ "$(docker inspect --format '{{.State.Running}}:{{.State.ExitCode}}' "${containers[$service]}")" == false:0 ]] || die "$service did not shut down cleanly; no complete backup will be recorded."
done
stage='logical database exports'
echo 'Starting the existing database container and waiting for readiness...'
docker start "${containers[db]}" >/dev/null
docker exec "${containers[db]}" sh -ec '
  attempts=60
  until pg_isready -q -t 1 -U "$POSTGRES_USER"; do
    attempts=$((attempts - 1))
    if [ "$attempts" -eq 0 ]; then echo "Database did not become ready." >&2; exit 1; fi
    sleep 2
  done
'
tablespaces="$(docker exec "${containers[db]}" sh -ec 'exec psql -XqAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "SELECT spcname FROM pg_tablespace WHERE spcname NOT IN ('\''pg_default'\'', '\''pg_global'\'')"')"
[[ -z "$tablespaces" ]] || die 'Custom PostgreSQL tablespaces require a separate recovery plan.'
[[ "$("${compose[@]}" ps --all --quiet db)" == "${containers[db]}" ]] || die 'The selected database container changed.'
echo 'Exporting application database, then all PostgreSQL databases and roles...'
DOCKER_CONTEXT=default "$SCRIPT_DIR/db_exports/export_db.sh" > "$backup_dir/directus.sql" 2>> "$backup_dir/errors.log"
test -s "$backup_dir/directus.sql"
docker exec "${containers[db]}" sh -ec 'exec pg_dumpall -U "$POSTGRES_USER" --quote-all-identifiers' \
  2>> "$backup_dir/errors.log" | gzip > "$backup_dir/postgres-all.sql.gz"
gzip -t "$backup_dir/postgres-all.sql.gz"
echo 'Stopping the database before filesystem capture...'
docker stop --time 60 "${containers[db]}" >/dev/null
for service in "${services[@]}"; do
  [[ "$(docker inspect --format '{{.State.Running}}' "${containers[$service]}")" == false ]] || die 'A source service restarted during export.'
  [[ "$(docker inspect --format '{{.Image}}' "${containers[$service]}")" == "${images[$service]}" ]] || die 'A source image changed during export.'
  stopped_state["$service"]="$(docker inspect --format '{{.State.StartedAt}}|{{.State.FinishedAt}}' "${containers[$service]}")"
done
[[ "$(docker inspect --format '{{.State.ExitCode}}' "${containers[db]}")" == 0 ]] || die 'PostgreSQL did not shut down cleanly.'

# Inspect every project container before reading cold data, including additional writers.
project_ids="$(docker ps --all --quiet --filter "label=com.docker.compose.project=$project")"
[[ -n "$project_ids" ]] || die 'Project containers disappeared.'
mapfile -t all_ids <<< "$project_ids"
for id in "${all_ids[@]}"; do
  [[ "$id" =~ ^[a-f0-9]{12,64}$ ]] || die 'Invalid project container ID.'
  running="$(docker inspect --format '{{.State.Running}}' "$id")"
  if [[ "$running" != false ]]; then
    [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$id")" == maintenance ]] || die 'Stop additional project writers before exporting.'
  fi
  project_state["$id"]="$(docker inspect --format '{{.State.Running}}|{{.State.StartedAt}}|{{.State.FinishedAt}}' "$id")"
done

stage='checkout and data archives'
echo 'Archiving checkout, configuration, uploads and repository-local service data...'
"${archive_command[@]}" --acls --xattrs --numeric-owner \
  --exclude='./backups' --exclude='./.reports' --exclude='*/node_modules' \
  --exclude='./src/frontend/.nuxt' --exclude='./src/frontend/.output' \
  --exclude='core.[0-9]*' \
  -czf - . > "$backup_dir/checkout-and-data.tar.gz" 2>> "$backup_dir/errors.log"
gzip -t "$backup_dir/checkout-and-data.tar.gz"
tar -tzf "$backup_dir/checkout-and-data.tar.gz" >/dev/null
# Always retain standalone frontend output, even though it is excluded from the checkout tar.
docker cp "${containers[frontend]}:/frontend/.output/." - > "$backup_dir/frontend-output.tar" 2>> "$backup_dir/errors.log"
tar -tf "$backup_dir/frontend-output.tar" >/dev/null

# Capture actual external/named mounts, including Redis's anonymous /data volume.
# Repository-local mounts are already in the cold checkout archive.
printf 'archive\tcontainer\ttype\tsource\tdestination\n' > "$backup_dir/mounts.tsv"
image_ids=()
mount_index=0
for id in "${all_ids[@]}"; do
  [[ "$id" =~ ^[a-f0-9]{12,64}$ ]] || die 'Invalid project container ID.'
  image="$(docker inspect --format '{{.Image}}' "$id")"
  [[ "$image" =~ ^(sha256:)?[a-f0-9]{64}$ ]] || die 'Invalid project image ID.'
  image_ids+=("$image")
  mounts="$(docker inspect --format '{{range .Mounts}}{{printf "%s\t%s\t%s\n" .Type .Source .Destination}}{{end}}' "$id")"
  while IFS=$'\t' read -r type source destination; do
    [[ -n "$type" ]] || continue
    [[ "$type" == bind || "$type" == volume || "$type" == tmpfs ]] || die 'Unsupported container mount type.'
    [[ "$type" != tmpfs ]] || continue
    [[ "$source" == /* && "$destination" == /* && "$destination" != / && "$destination" != *$'\n'* ]] || die 'Unsupported mount path.'
    source="$(realpath -m -- "$source")"
    if [[ "$type" == bind && "$source" == "$REPO_ROOT" ]]; then continue; fi
    if [[ "$type" == bind && "$source" == "$REPO_ROOT/"* ]]; then
      case "$source" in
        "$REPO_ROOT/backups"|"$REPO_ROOT/backups/"*|"$REPO_ROOT/.reports"|"$REPO_ROOT/.reports/"*) continue ;;
        */node_modules|*/node_modules/*|"$REPO_ROOT/src/frontend/.nuxt"|"$REPO_ROOT/src/frontend/.nuxt/"*|"$REPO_ROOT/src/frontend/.output"|"$REPO_ROOT/src/frontend/.output/"*) ;;
        *) continue ;;
      esac
    fi
    [[ "$backup_dir" != "$source" && "$backup_dir" != "$source/"* ]] || die 'A mounted source would include the in-progress export.'
    [[ "$(docker inspect --format '{{.State.Running}}' "$id")" == false ]] || die 'An external data mount is still in use by a running project container.'
    mount_index=$((mount_index + 1))
    file="mount-$mount_index.tar"
    docker cp "$id:$destination" - > "$backup_dir/$file" 2>> "$backup_dir/errors.log"
    tar -tf "$backup_dir/$file" >/dev/null
    printf '%s\t%s\t%s\t%s\t%s\n' "$file" "$id" "$type" "$source" "$destination" >> "$backup_dir/mounts.tsv"
  done <<< "$mounts"
done
stage='images and private host configuration'
echo 'Saving exact project images, including maintenance when present...'
mapfile -t image_ids < <(printf '%s\n' "${image_ids[@]}" | sort -u)
docker image inspect "${image_ids[@]}" > "$backup_dir/images.json"
docker inspect "${all_ids[@]}" > "$backup_dir/containers.json"
docker ps --all --no-trunc --filter "label=com.docker.compose.project=$project" > "$backup_dir/containers.txt"
docker save "${image_ids[@]}" > "$backup_dir/images.tar" 2>> "$backup_dir/errors.log"
tar -tf "$backup_dir/images.tar" >/dev/null
printf 'archive\toriginal\n' > "$backup_dir/configs.tsv"
for index in "${!config_labels[@]}"; do
  file="config-${config_labels[$index]}"
  "${copy_command[@]}" -- "${config_paths[$index]}" > "$backup_dir/$file"
  printf '%s\t%s\n' "$file" "${config_paths[$index]}" >> "$backup_dir/configs.tsv"
done
cp "$SCRIPT_DIR/FULL_EXPORT.md" "$backup_dir/RESTORE.md"

stage='final consistency and integrity checks'
for service in "${services[@]}"; do
  [[ "$(docker inspect --format '{{.State.Running}}' "${containers[$service]}")" == false ]] || die 'A source service restarted during capture.'
  [[ "$(docker inspect --format '{{.State.StartedAt}}|{{.State.FinishedAt}}' "${containers[$service]}")" == "${stopped_state[$service]}" ]] || die 'A source service changed state during capture.'
  [[ "$("${compose[@]}" ps --all --quiet "$service")" == "${containers[$service]}" ]] || die 'A source container was replaced during capture.'
done
for id in "${all_ids[@]}"; do
  [[ "$(docker inspect --format '{{.State.Running}}|{{.State.StartedAt}}|{{.State.FinishedAt}}' "$id")" == "${project_state[$id]}" ]] || die 'A project container changed state during capture.'
done
# Make the completion marker only after validation; failures retain an uncertified directory.
(
  trap - ERR
  cd "$backup_dir"
  find . -maxdepth 1 -type f ! -name 'SHA256SUMS*' -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS.partial
  sha256sum --check SHA256SUMS.partial
)
if ((EUID == 0)); then
  chown -R "$(stat -c '%u:%g' "$REPO_ROOT")" "$backup_dir"
fi
du -sh "$backup_dir"
mv "$backup_dir/SHA256SUMS.partial" "$backup_dir/SHA256SUMS"
printf '\nBACKUP COMPLETE: %s\n' "$backup_dir"
echo 'Application/data services remain stopped. No containers were created and no upgrade was performed.'
echo 'Copy the whole private directory off-host and verify SHA256SUMS before a restore rehearsal.'
