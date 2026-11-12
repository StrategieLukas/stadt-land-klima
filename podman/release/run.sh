#!/usr/bin/env bash
# Stage and activate application-only releases as the rootless deployment user.
set -Eeuo pipefail
umask 077
RELEASE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run.sh"
SCRIPT_DIR="$(cd "$(dirname "$RELEASE_SCRIPT")/../../bin" && pwd)"
cd "$SCRIPT_DIR/.."
host_command() (
  trap - ERR
  if [[ -v release_lock ]]; then exec {release_lock}>&-; fi
  if [[ -v project_lock ]]; then exec {project_lock}>&-; fi
  action="$1"; shift
  if [[ "$action" == compose ]]; then
    node "$SCRIPT_DIR/cli/host-environment.ts" "$config" "$SCRIPT_DIR/slk" stack compose --env production -- "$@"
  else
    node "$SCRIPT_DIR/cli/host-environment.ts" "$config" "$SCRIPT_DIR/slk" stack "$action" --env production "$@"
  fi
)
[[ $# == 4 && "$1" == /* && -f "$1" && ! -L "$1" ]] || { echo 'Usage: bin/slk release backup|stage|stage-prebuilt|activate|rollback /private/host.env release-tag previous-tag --env production' >&2; exit 2; }
[[ "$(id -u)" != 0 ]] || { echo 'Run as the deployment user.' >&2; exit 1; }
config="$1"; action="$2"; next_tag="$3"; previous_tag="$4"
[[ "$action" =~ ^(backup|stage|stage-prebuilt|activate|rollback)$ && "$next_tag" =~ ^release-[a-f0-9]{8,40}$ && "$previous_tag" =~ ^release-[a-f0-9]{8,40}$ && "$next_tag" != "$previous_tag" ]] || exit 2
[[ "$(stat -c '%a:%u' "$config")" == "600:$(id -u)" ]] || { echo 'Host configuration must be an owned mode-0600 regular file.' >&2; exit 1; }
if [[ -f /etc/apparmor.d/slk-rootless && "$(cat /proc/self/attr/current)" != *slk-rootless* ]]; then
  exec aa-exec -p slk-rootless -- bash "$RELEASE_SCRIPT" "$@"
fi
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"
project="${SLK_PODMAN_PROJECT:?Host configuration must name its project}"
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]+$ ]] || exit 2
state="$HOME/.local/state/slk-releases/$next_tag"
mkdir -p "$state"
[[ ! -L "$state" && "$(stat -c '%a:%u' "$state")" == "700:$(id -u)" ]] || exit 1
exec {release_lock}>"$state/release.lock"
flock --nonblock "$release_lock" || { echo 'This release is already running.' >&2; exit 1; }
export SLK_PODMAN_TAG="$next_tag"
host_command doctor
exec {project_lock}>"$XDG_RUNTIME_DIR/slk-podman/$project.release.lock"
flock --nonblock "$project_lock" || { echo 'Another release operation is active for this project.' >&2; exit 1; }
seccomp="$XDG_RUNTIME_DIR/slk-podman/seccomp.json"
compose() {
  if [[ "${1:-}" == -f ]]; then
    local overlay="$2"; shift 2
    SLK_PODMAN_VOLUME_OVERLAY="$overlay" host_command compose "$@"
  else
    host_command compose "$@"
  fi
}
podman() (
  trap - ERR
  exec {release_lock}>&- {project_lock}>&-
  command podman "$@"
)
staged="${project}_frontend-output_${next_tag#release-}"
active="${project}_frontend-output"
saved="${project}_frontend-output_before_${next_tag#release-}"
cat > "$state/stage.yaml" <<EOF
services:
  frontend:
    volumes: ["staged-output:/frontend/.output:ro,U"]
  frontend-build:
    volumes: ["staged-output:/release:U"]
volumes:
  staged-output:
    name: $staged
EOF
wait_ready() {
  local url="$1" deadline=$((SECONDS+360))
  until curl --fail --silent --output /dev/null --connect-timeout 2 --max-time 5 "$url"; do
    ((SECONDS < deadline)) || return 1
    sleep 2
  done
}
copy_output() {
  local source="$1" target="$2"
  [[ "$source" != "$target" ]] || return 1
  podman --remote=false volume exists "$source" || return 1
  if ! podman --remote=false volume exists "$target"; then
    podman --remote=false volume create "$target" >/dev/null || return 1
  fi
  podman --remote=false run --rm -i --network none --user 1000:1000 --userns keep-id:uid=1000,gid=1000 \
    --cap-drop ALL --security-opt no-new-privileges --security-opt "seccomp=$seccomp" \
    --read-only --memory 384m --pids-limit 128 --log-driver journald \
    -v "$source:/source:ro" -v "$target:/target:U" --entrypoint node \
    "localhost/slk-podman-frontend:$previous_tag" --input-type=module <<'JS'
import {existsSync,readdirSync,rmSync,cpSync} from 'node:fs';
if (!existsSync('/source/.slk-production.json')) throw Error('Missing source fingerprint');
for (const name of readdirSync('/target')) rmSync('/target/'+name,{recursive:true,force:true});
for (const name of readdirSync('/source')) cpSync('/source/'+name,'/target/'+name,{recursive:true,verbatimSymlinks:true});
if (!existsSync('/target/.slk-production.json')) throw Error('Copy failed');
JS
}
persist_tag() {
  node --input-type=module - "$config" "$1" <<'JS'
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const [path,tag]=process.argv.slice(2);
const source=readFileSync(path,'utf8');
if ((source.match(/^SLK_PODMAN_TAG=.*$/gm)??[]).length!==1) throw Error('Expected one release tag');
const temporary=path+'.'+randomUUID();
writeFileSync(temporary,source.replace(/^SLK_PODMAN_TAG=.*$/m,'SLK_PODMAN_TAG='+tag),{mode:0o600,flag:'wx'});
renameSync(temporary,path);
JS
}
remove_app_containers() {
  for service in frontend directus; do
    local container
    container="$(podman --remote=false ps -aq --filter "label=io.podman.compose.project=$project" --filter "label=io.podman.compose.service=$service")" || return 1
    if [[ -n "$container" ]]; then
      podman --remote=false stop --time 60 "$container" || return 1
      podman --remote=false rm "$container" || return 1
    fi
  done
}
rollback() {
  trap - ERR
  echo 'Restoring previous application images and output; data services remain running.'
  if [[ -f "$state/cms-origin.before.json" ]]; then
    node "$SCRIPT_DIR/lib/cms-origin.ts" restore "$config" "$state" || return 1
  fi
  # Only this migration's untouched seed may be removed. Authored content wins.
  if [[ -f "$state/import.started" ]]; then
    compose up -d --no-build --no-deps directus || return 1
    wait_ready "http://127.0.0.1:${SLK_PODMAN_CMS_PORT:-9001}/server/health" || return 1
    compose run --rm --no-deps -T --entrypoint /usr/local/bin/slk-env \
      -v "$SCRIPT_DIR/../src/directus/cli/tasks:/directus/cli/tasks:ro,z" \
      -v "$SCRIPT_DIR/../src/directus/cli/rollbackHomepage.ts:/directus/cli/rollbackHomepage.ts:ro,z" \
      directus sh -ec 'export FRONTEND_DIRECTUS_URL="$1"; exec /directus/cli/node_modules/.bin/tsx /directus/cli/rollbackHomepage.ts' \
      slk-cli "http://${project}_directus_1:8055" < "$state/homepage.before.json" || return 1
    rm "$state/import.started" || return 1
  fi
  remove_app_containers || return 1
  copy_output "$saved" "$active" || return 1
  export SLK_PODMAN_TAG="$previous_tag"
  persist_tag "$previous_tag" || return 1
  compose up -d --no-build --no-deps directus || return 1
  wait_ready "http://127.0.0.1:${SLK_PODMAN_CMS_PORT:-9001}/server/health" || return 1
  compose up -d --no-build --no-deps frontend || return 1
  wait_ready "http://127.0.0.1:${SLK_PODMAN_WEB_PORT:-9000}/" || return 1
  compose --profile maintenance stop maintenance || return 1
  touch "$state/rollback.ok"
}
case "$action" in
  backup)
    [[ ! -e "$state/backups.sha256" ]] || { echo 'Preserve the existing backup; use a new release record.' >&2; exit 1; }
    database="$(podman --remote=false ps -q --filter "label=io.podman.compose.project=$project" --filter label=io.podman.compose.service=db)"
    [[ -n "$database" ]] || exit 1
    podman --remote=false exec "$database" /usr/local/bin/slk-env sh -ec 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$state/database.before.dump"
    podman --remote=false exec -i "$database" pg_restore --list < "$state/database.before.dump" > "$state/database.before.list"
    podman --remote=false volume export "${project}_uploads" > "$state/uploads.before.tar"
    podman --remote=false volume export "$active" > "$state/frontend-output.before.tar"
    tar --exclude=.git --exclude=node_modules --exclude=.nuxt --exclude=.output --exclude=uploads --exclude='core.*' --exclude=podman/data --exclude=docker/data --exclude=backups --exclude=.reports -czf "$state/source.before.tar.gz" .
    tar -czf "$state/config.before.tar.gz" "$config" "$HOME/.config/systemd/user/slk.service"
    (cd "$state"; sha256sum database.before.dump uploads.before.tar frontend-output.before.tar source.before.tar.gz config.before.tar.gz > backups.sha256)
    echo 'Backups recorded. Copy off-host and verify before creating backup.verified.'
    ;;
  stage|stage-prebuilt)
    [[ -z "$(git status --porcelain)" ]] || { echo 'Commit and push source changes before staging a release.' >&2; exit 1; }
    revision="$(git rev-parse HEAD)"
    [[ "$revision" == "${next_tag#release-}"* ]] || { echo 'Tag does not identify this checkout.' >&2; exit 1; }
    rm -f "$state/stage.ok"
    printf '%s\n' "$revision" > "$state/revision"
    # Runtime base images are rebuilt separately when their maintained inputs change.
    if [[ "$action" == stage-prebuilt ]]; then
      for service in directus frontend; do
        image_revision="$(podman --remote=false image inspect "localhost/slk-podman-$service:$next_tag" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
        [[ "$image_revision" == "$revision" ]] || { echo 'Prebuilt image does not identify the clean source revision.' >&2; exit 1; }
      done
      compose --profile maintenance build maintenance
    else
      compose --profile maintenance build directus frontend maintenance
    fi
    if ! compose -f "$state/stage.yaml" run --rm --no-deps -T frontend node scripts/productionOutput.mts verify; then
      compose -f "$state/stage.yaml" --profile build run --rm --no-deps -T frontend-build
    fi
    compose -f "$state/stage.yaml" run --rm --no-deps -T frontend node scripts/productionOutput.mts verify
    compose run --rm --no-deps -T --entrypoint node directus --input-type=module -e 'await import("/opt/slk-directus-runtime-security/test-runtime.ts"); process.exit(0);'
    touch "$state/stage.ok"
    ;;
  activate)
    [[ -f "$state/stage.ok" && -f "$state/backup.verified" && "$(cat "$state/revision")" == "$(git rev-parse HEAD)" && -z "$(git status --porcelain)" ]] || { echo 'A clean staged revision and verified backup are required.' >&2; exit 1; }
    curl --fail --silent "http://127.0.0.1:${SLK_PODMAN_WEB_PORT:-9000}/api/public/pages/index" | node -e 'let b="";for await(const c of process.stdin)b+=c;const p=JSON.parse(b).page;if(!p?.id)throw Error("Missing homepage");process.stdout.write(JSON.stringify(p))' > "$state/homepage.before.json"
    # Snapshot block state for guarded rollback using the public read endpoint.
    page_id="$(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log(p.id)' "$state/homepage.before.json")"
    curl --fail --silent --get --data-urlencode 'entityType=pages' --data-urlencode "entityUuid=$page_id" --data-urlencode 'fieldName=content' "http://127.0.0.1:${SLK_PODMAN_WEB_PORT:-9000}/api/public/blocks" > "$state/blocks.before.json"
    copy_output "$active" "$saved"
    node "$SCRIPT_DIR/lib/maintenance-meta.ts" "$XDG_RUNTIME_DIR/slk-podman/$project.maintenance-meta.js"
    compose --profile maintenance up -d --no-build --no-deps maintenance
    wait_ready "http://127.0.0.1:${SLK_PODMAN_MAINTENANCE_PORT:-9090}/logo.svg"
    trap 'status=$?; rollback || echo "Rollback needs operator attention; maintenance retained." >&2; exit "$status"' ERR
    remove_app_containers
    compose up -d --no-build --no-deps directus
    wait_ready "http://127.0.0.1:${SLK_PODMAN_CMS_PORT:-9001}/server/health"
    # Record whether the old homepage had authored blocks before enabling rollback.
    if node -e 'const fs=require("fs");const blocks=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).blocks;if (!Array.isArray(blocks))throw Error("Invalid blocks checkpoint");if (blocks.length!==0)process.exit(1)' "$state/blocks.before.json"; then
      touch "$state/import.started"
    fi
    compose exec -T directus /directus/cli/import-all.sh
    copy_output "$staged" "$active"
    persist_tag "$next_tag"
    compose up -d --no-build --no-deps frontend
    wait_ready "http://127.0.0.1:${SLK_PODMAN_WEB_PORT:-9000}/"
    host_command audit
    compose exec -T frontend node scripts/productionOutput.mts verify
    compose --profile maintenance stop maintenance
    touch "$state/activate.ok"
    trap - ERR
    ;;
  rollback) rollback ;;
esac
