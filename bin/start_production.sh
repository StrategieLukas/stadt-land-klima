#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

wait_for_url() {
	local url="$1"
	local name="$2"
	local timeout_seconds="${3:-180}"
	local started_at=$SECONDS
	local deadline=$((started_at + timeout_seconds))
	local http_code="000"

	if ! command -v curl >/dev/null 2>&1; then
		echo "[warn] curl not found, skipping readiness check for $name"
		return 0
	fi

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
	docker compose -f docker-compose.yaml -f docker-compose.prod.yaml ps "$name" >&2 || true
	echo "[diagnostics] Last $name logs:" >&2
	docker compose -f docker-compose.yaml -f docker-compose.prod.yaml logs --tail=100 "$name" >&2 || true
	return 1
}

cd "$REPO_ROOT"
mkdir -p src/directus/uploads

echo "[stack] Starting production services"
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d db cache meilisearch
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --force-recreate directus frontend

wait_for_url "http://127.0.0.1:9001/server/health" "directus" 360
wait_for_url "http://127.0.0.1:9000" "frontend" 180

echo "[maintenance] Deactivating maintenance container"
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml stop maintenance >/dev/null 2>&1 || true
