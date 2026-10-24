#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

IMPORT_CONFIGURATION=false
PREPARE_ONLY=false
for arg in "$@"; do
	case "$arg" in
		--import) IMPORT_CONFIGURATION=true ;;
		--prepare-only) PREPARE_ONLY=true ;;
		--help) echo 'Usage: start_production.sh [--import] [--prepare-only]'; exit 0 ;;
		*) echo "Unknown option: $arg" >&2; exit 2 ;;
	esac
done
command -v curl >/dev/null 2>&1 || { echo 'curl is required for readiness checks' >&2; exit 1; }

wait_for_url() {
	local url="$1"
	local name="$2"
	local timeout_seconds="${3:-180}"
	local started_at=$SECONDS
	local deadline=$((started_at + timeout_seconds))
	local http_code="000"

	while (( SECONDS < deadline )); do
		http_code="$(curl \
			--silent \
			--output /dev/null \
			--connect-timeout 2 \
			--max-time 5 \
			--write-out '%{http_code}' \
			"$url" || true)"

		case "$http_code" in
			2*|3*)
				echo "[ready] $name is reachable after $((SECONDS - started_at))s ($url)"
				return 0
				;;
		esac

		sleep 2
	done

	echo "[error] $name did not become reachable within ${timeout_seconds}s (last HTTP status: ${http_code:-000}, $url)" >&2
	echo "[diagnostics] Container status for $name:" >&2
	"${CORE_COMPOSE[@]}" ps "$name" >&2 || true
	echo "[diagnostics] Last $name logs:" >&2
	"${CORE_COMPOSE[@]}" logs --tail=100 "$name" >&2 || true
	return 1
}

cd "$REPO_ROOT"
source "$SCRIPT_DIR/lib/core-service-data.sh"
core_compose production
mkdir -p src/directus/uploads

"$SCRIPT_DIR/check_core_service_data.sh" production

echo "[stack] Starting production services"
"${CORE_COMPOSE[@]}" up -d maintenance
if [[ "$IMPORT_CONFIGURATION" == true || "$PREPARE_ONLY" == true ]]; then
	"${CORE_COMPOSE[@]}" stop frontend
fi
"${CORE_COMPOSE[@]}" up -d db cache meilisearch
"${CORE_COMPOSE[@]}" up -d --force-recreate directus
wait_for_url "http://127.0.0.1:9001/server/health" "directus" 360
if [[ "$IMPORT_CONFIGURATION" == true ]]; then
	echo "[configuration] Applying code-first imports before starting the frontend"
	"${CORE_COMPOSE[@]}" exec -T directus /directus/cli/import-all.sh
fi
if [[ "$PREPARE_ONLY" == true ]]; then
	echo "[maintenance] Frontend remains stopped; Directus is ready for operator setup"
	exit 0
fi
"${CORE_COMPOSE[@]}" up -d --force-recreate frontend
wait_for_url "http://127.0.0.1:9000" "frontend" 180

echo "[maintenance] Deactivating maintenance container"
"${CORE_COMPOSE[@]}" stop maintenance
