#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 [backend url] [frontend url] [absolute path to backend env file]" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CALLER_DIR="$(pwd)"
BACKEND_URL="$1"
FRONTEND_URL="$2"
ENV_FILE="$3"

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

npx tsx src/run.ts "$BACKEND_URL" "$FRONTEND_URL" "$ENV_FILE"
