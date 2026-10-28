#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

# Refuse administrative writes when the maintained tooling no longer type-checks.
npm --prefix "$SCRIPT_DIR" run typecheck

# Preserve legacy content before the final snapshot removes its collections.
"$SCRIPT_DIR/node_modules/.bin/tsx" "$SCRIPT_DIR/migrateSuccessProjectTours.ts" --prepare
"$SCRIPT_DIR/node_modules/.bin/tsx" "$SCRIPT_DIR/migrateSuccessProjectTours.ts"

# Use the new import:all command which clears cache once and imports sequentially
"$SCRIPT_DIR/index.mjs" -f -r import:all

# Triggers are not part of the Directus YAML format. Install their maintained
# TypeScript definition only after the private outbox tables exist.
"$SCRIPT_DIR/node_modules/.bin/tsx" "$SCRIPT_DIR/installTranslationOutbox.ts"

# Directus bootstrap can run migrations before newly declared collections exist.
# Seed content after the schema import so fresh and existing databases both work.
"$SCRIPT_DIR/node_modules/.bin/tsx" "$SCRIPT_DIR/seedTourOst2026.ts"


echo "All imports completed"
