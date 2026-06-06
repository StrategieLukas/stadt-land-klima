#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

# Use the new export:all command which clears cache once and exports sequentially
"$SCRIPT_DIR/index.mjs" -f -c export:all

echo "All exports completed"
