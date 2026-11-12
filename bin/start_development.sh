#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/podman.sh" development build
exec "$SCRIPT_DIR/podman.sh" development start "$@"
