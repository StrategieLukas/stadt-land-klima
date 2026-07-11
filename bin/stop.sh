#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAINTENANCE_META_FILE="$REPO_ROOT/docker/maintenance/maintenance-meta.js"
FRONTEND_ENV_FILE="$REPO_ROOT/src/frontend/.env"

PLAUSIBLE_ANALYTICS_URL_VALUE=""
PLAUSIBLE_ANALYTICS_DOMAIN_VALUE=""
PLAUSIBLE_UTM_CAMPAIGN_VALUE="maintenance_mode"

escape_js_string() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

read_env_value() {
	local env_file="$1"
	local key="$2"
	local value

	value="$(grep -m1 -E "^${key}=" "$env_file" | cut -d'=' -f2- || true)"

	value="${value%\"}"
	value="${value#\"}"
	value="${value%\'}"
	value="${value#\'}"

	printf '%s' "$value"
}

load_plausible_config() {
	if [[ ! -f "$FRONTEND_ENV_FILE" ]]; then
		return
	fi

	PLAUSIBLE_ANALYTICS_URL_VALUE="$(read_env_value "$FRONTEND_ENV_FILE" "PLAUSIBLE_ANALYTICS_URL")"
	PLAUSIBLE_ANALYTICS_DOMAIN_VALUE="$(read_env_value "$FRONTEND_ENV_FILE" "PLAUSIBLE_ANALYTICS_DOMAIN")"

	local campaign_value
	campaign_value="$(read_env_value "$FRONTEND_ENV_FILE" "PLAUSIBLE_UTM_CAMPAIGN")"
	if [[ -n "$campaign_value" ]]; then
		PLAUSIBLE_UTM_CAMPAIGN_VALUE="$campaign_value"
	fi
}

write_maintenance_meta() {
	local started_at
	local plausible_url_escaped
	local plausible_domain_escaped
	local plausible_campaign_escaped

	started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
	plausible_url_escaped="$(escape_js_string "$PLAUSIBLE_ANALYTICS_URL_VALUE")"
	plausible_domain_escaped="$(escape_js_string "$PLAUSIBLE_ANALYTICS_DOMAIN_VALUE")"
	plausible_campaign_escaped="$(escape_js_string "$PLAUSIBLE_UTM_CAMPAIGN_VALUE")"

	cat > "$MAINTENANCE_META_FILE" <<EOF
window.__MAINTENANCE_STARTED_AT = "$started_at";
window.__PLAUSIBLE_ANALYTICS_URL = "$plausible_url_escaped";
window.__PLAUSIBLE_ANALYTICS_DOMAIN = "$plausible_domain_escaped";
window.__PLAUSIBLE_UTM_CAMPAIGN = "$plausible_campaign_escaped";
EOF
}

cd "$REPO_ROOT"

echo "[maintenance] Activating maintenance container"
load_plausible_config
write_maintenance_meta
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --force-recreate maintenance

echo "[stack] Stopping production application services"
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml stop frontend directus meilisearch cache db
