#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ] || [ "$#" -gt 4 ] || [[ "${4:-}" != "" && "${4:-}" != "--full" ]]; then
  echo "Usage: $0 <backend-url> <frontend-url> <env-file> [--full]" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CALLER_DIR="$(pwd)"
BACKEND_URL="$1"
FRONTEND_URL="$2"
ENV_FILE="$3"
PROFILE="${4:-}"

if [[ "$ENV_FILE" != /* ]]; then
  ENV_FILE="$(cd "$CALLER_DIR" && realpath "$ENV_FILE")"
fi

cd "$SCRIPT_DIR"

if [ ! -d node_modules ]; then
  npm install
fi

if ! node -e "const { chromium } = require('playwright'); process.exit(chromium.executablePath() ? 0 : 1);" >/dev/null 2>&1; then
  npx playwright install chromium
fi

npm run test:unit
npx tsx src/run.ts "$BACKEND_URL" "$FRONTEND_URL" "$ENV_FILE" "$PROFILE"
