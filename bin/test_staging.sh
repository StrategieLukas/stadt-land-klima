#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

"$SCRIPT_DIR/test_suite/run_tests.sh" \
  "https://staging.stadt-land-klima.de/backend" \
  "https://staging.stadt-land-klima.de" \
  "$REPO_ROOT/src/directus/.env"
