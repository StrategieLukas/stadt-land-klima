#!/usr/bin/env bash
# Rootless, daemonless infrastructure orchestration alongside the Docker scripts.
set -euo pipefail
umask 077
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
usage() {
  echo 'Usage: bin/podman.sh development|production doctor|build|prepare|start [--import]|stop|audit|compose <args...>'
}
if [[ "${1:-}" == --help ]]; then usage; exit 0; fi
[[ $# -ge 2 ]] || { usage >&2; exit 2; }
environment="$1"; action="$2"; shift 2
case "$environment" in
  development) overlay=podman-compose.dev.yaml; web_port=${SLK_PODMAN_WEB_PORT:-8080}; cms_port=${SLK_PODMAN_CMS_PORT:-8081} ;;
  production) overlay=podman-compose.prod.yaml; web_port=${SLK_PODMAN_WEB_PORT:-9000}; cms_port=${SLK_PODMAN_CMS_PORT:-9001} ;;
  *) usage >&2; exit 2 ;;
esac
maintenance_port=${SLK_PODMAN_MAINTENANCE_PORT:-9090}
for port in "$web_port" "$cms_port" "$maintenance_port"; do
  [[ "$port" =~ ^[1-9][0-9]{3,4}$ ]] && ((10#$port >= 1024 && 10#$port <= 65535)) || { echo 'Podman ports must be between 1024 and 65535.' >&2; exit 2; }
done
export SLK_PODMAN_WEB_PORT="$web_port" SLK_PODMAN_CMS_PORT="$cms_port" SLK_PODMAN_MAINTENANCE_PORT="$maintenance_port"
case "$action" in doctor|build|prepare|start|stop|audit|compose) ;; *) usage >&2; exit 2 ;; esac
[[ "$action" == compose || "$action" == start || $# == 0 ]] || { usage >&2; exit 2; }
[[ "$action" != start || $# == 0 || ( $# == 1 && "$1" == --import ) ]] || { usage >&2; exit 2; }
[[ "$(id -u)" != 0 ]] || { echo 'Use a non-root deployment account, without sudo.' >&2; exit 1; }
[[ -z "${CONTAINER_HOST:-}" && -z "${CONTAINER_CONNECTION:-}" ]] || { echo 'Remote Podman connections are not supported by this local setup.' >&2; exit 1; }
for tool in node podman podman-compose curl flock; do
  command -v "$tool" >/dev/null || { echo "$tool is required; see PODMAN.md." >&2; exit 1; }
done
node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' || { echo 'Node 24 or newer is required.' >&2; exit 1; }
provider_version="$(podman-compose --version)"
node -e 'const v=process.argv[1].match(/podman-compose version (\d+)\.(\d+)\.(\d+)/);if(!v || +v[1]<1 || (+v[1]===1 && +v[2]<5))process.exit(1)' "$provider_version" || {
  echo 'podman-compose 1.5 or newer is required; do not silently switch providers.' >&2; exit 1;
}
SLK_PODMAN_SECCOMP="$(node bin/lib/podman-security.ts host)"
export SLK_PODMAN_SECCOMP
node bin/lib/podman-security.ts environment
project="${SLK_PODMAN_PROJECT:-slk-podman-$environment}"
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]+$ ]] || { echo 'Invalid SLK_PODMAN_PROJECT.' >&2; exit 2; }
tag="${SLK_PODMAN_TAG:-local}"
[[ "$tag" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]] || { echo 'Invalid SLK_PODMAN_TAG.' >&2; exit 2; }
case "$action" in
  start|prepare|build|stop)
    exec {deployment_lock}>"$XDG_RUNTIME_DIR/slk-podman/$project.lock"
    flock --nonblock "$deployment_lock" || { echo 'Another Podman deployment operation is active for this project.' >&2; exit 1; }
    ;;
esac
if [[ "$action" != doctor ]]; then
  secret_mode=metadata
  case "$action" in start|prepare|compose) secret_mode=sync ;; esac
  secret_overlay="$(node bin/lib/podman-secrets.ts "$environment" "$project" "$secret_mode")"
fi
# Never share a pod: db/cache/search must retain their separate network namespaces.
compose=(podman-compose --podman-path "$(command -v podman)" --podman-args=--remote=false --in-pod=false -p "$project" -f podman-compose.yaml -f "$overlay")
if [[ "$action" != doctor ]]; then compose+=(-f "$secret_overlay"); fi

wait_for_url() {
  local url="$1" deadline=$((SECONDS + 360))
  while ((SECONDS < deadline)); do
    if curl --fail --silent --output /dev/null --connect-timeout 2 --max-time 5 "$url"; then return 0; fi
    sleep 2
  done
  echo 'Readiness failed. Maintenance remains active; inspect private container logs.' >&2
  return 1
}
frontend_stopped() {
  local ids container
  ids="$(podman --remote=false ps -q --filter "label=io.podman.compose.project=$project" --filter label=io.podman.compose.service=frontend)"
  for container in $ids; do
    [[ -z "$container" ]] || { echo 'Stop frontend before preparing its output; the live artifact must not be overwritten.' >&2; return 1; }
  done
}
prepare_frontend() {
  [[ "$environment" == production ]] || { echo 'Development installs dependencies in its isolated volumes at startup.'; return 0; }
  frontend_stopped
  if "${compose[@]}" run --rm --no-deps frontend node scripts/productionOutput.mts verify; then
    echo 'Production output already matches source, environment and runtime.'
  else
    "${compose[@]}" --profile build run --rm --no-deps frontend-build
  fi
}
case "$action" in
  doctor)
    echo 'Rootless Podman, cgroup limits, host confinement and the hardened seccomp profile passed preflight.'
    ;;
  build)
    # Reuse the patched Docker build definitions; never upgrade pinned Directus here.
    podman --remote=false build --pull=always --no-cache --build-arg UID=1000 --build-arg GID=1000 -t localhost/slk-podman-directus-runtime:local -f docker/directus/Dockerfile docker/directus
    podman --remote=false build --pull=always --no-cache --build-arg UID=1000 --build-arg GID=1000 -t localhost/slk-podman-frontend-runtime:local -f docker/frontend/Dockerfile docker/frontend
    "${compose[@]}" --profile maintenance build --no-cache directus frontend maintenance
    ;;
  prepare) prepare_frontend ;;
  start)
    if [[ "$environment" == production ]]; then
      "${compose[@]}" --profile maintenance up -d --no-build maintenance
      "${compose[@]}" stop frontend
    fi
    "${compose[@]}" up -d --no-build db cache meilisearch directus
    wait_for_url "http://127.0.0.1:$cms_port/server/health"
    if [[ "${1:-}" == --import ]]; then
      "${compose[@]}" exec -T directus /directus/cli/import-all.sh
    fi
    prepare_frontend
    "${compose[@]}" up -d --no-build --force-recreate frontend
    wait_for_url "http://127.0.0.1:$web_port/"
    if [[ "$environment" == production ]]; then
      "$SCRIPT_DIR/podman.sh" production audit
      "${compose[@]}" --profile maintenance stop maintenance
    fi
    ;;
  stop) "${compose[@]}" --profile maintenance stop ;;
  audit)
    [[ "$environment" == production ]] || { echo 'Runtime audit targets production; development intentionally mounts frontend source writable.' >&2; exit 2; }
    for service in db cache meilisearch directus frontend maintenance; do
      container="$("${compose[@]}" --profile maintenance ps -q "$service")"
      [[ -n "$container" ]] || { echo "Missing runtime service: $service" >&2; exit 1; }
      podman --remote=false inspect "$container" | node bin/lib/podman-security.ts container "$service"
      if [[ "$service" == maintenance && "$(podman --remote=false inspect --format '{{.State.Running}}' "$container")" != true ]]; then
        echo 'Runtime configuration verified: maintenance (stopped)'
        continue
      fi
      podman --remote=false exec "$container" sh -ec '
        test "$(id -u)" != 0
        grep -Eq "^NoNewPrivs:[[:space:]]+1$" /proc/1/status
        grep -Eq "^Seccomp:[[:space:]]+2$" /proc/1/status
        grep -Eq "^CapEff:[[:space:]]+0+$" /proc/1/status
        grep -Eq "^CapBnd:[[:space:]]+0+$" /proc/1/status
      '
      echo "Runtime confinement verified: $service"
    done
    ;;
  compose)
    # config/inspect can contain credentials: callers must keep their output private.
    "${compose[@]}" "$@"
    ;;
esac
