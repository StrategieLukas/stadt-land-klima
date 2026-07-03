#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

"$SCRIPT_DIR/test_suite/run_tests.sh" \
  "http://localhost:8081" \
  "http://localhost:8080" \
  "$REPO_ROOT/src/directus/.env"
