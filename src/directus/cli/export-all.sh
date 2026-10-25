#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

# Refuse administrative writes when the maintained tooling no longer type-checks.
npm --prefix "$SCRIPT_DIR" run typecheck

# Use the new export:all command which clears cache once and exports sequentially
"$SCRIPT_DIR/index.mjs" -f -c export:all

echo "All exports completed"
