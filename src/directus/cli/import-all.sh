#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

# Use the new import:all command which clears cache once and imports sequentially
"$SCRIPT_DIR/index.mjs" -f -r import:all

# Directus bootstrap can run migrations before newly declared collections exist.
# Seed content after the schema import so fresh and existing databases both work.
"$SCRIPT_DIR/node_modules/.bin/tsx" "$SCRIPT_DIR/seedTourOst2026.ts"

echo "All imports completed"
