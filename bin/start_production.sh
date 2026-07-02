#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

wait_for_url() {
	local url="$1"
	local name="$2"
	local max_attempts="${3:-60}"
	local attempt=1

	if ! command -v curl >/dev/null 2>&1; then
		echo "[warn] curl not found, skipping readiness check for $name"
		return 0
	fi

	while (( attempt <= max_attempts )); do
		if curl --silent --show-error --fail "$url" >/dev/null 2>&1; then
			echo "[ready] $name is reachable ($url)"
			return 0
		fi

		sleep 2
		((attempt++))
	done

	echo "[error] $name did not become reachable in time ($url)"
	return 1
}

cd "$REPO_ROOT"
mkdir -p src/directus/uploads

echo "[stack] Starting production services"
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d db cache meilisearch directus frontend

wait_for_url "http://127.0.0.1:9001/server/health" "directus"
wait_for_url "http://127.0.0.1:9000" "frontend"

echo "[maintenance] Deactivating maintenance container"
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml stop maintenance >/dev/null 2>&1 || true
