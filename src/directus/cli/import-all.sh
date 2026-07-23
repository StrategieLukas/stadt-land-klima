#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

# Use the new import:all command which clears cache once and imports sequentially
"$SCRIPT_DIR/index.mjs" -f -r import:all

echo "All imports completed"
