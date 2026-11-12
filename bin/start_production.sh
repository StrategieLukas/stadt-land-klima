#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == --help ]]; then echo 'Usage: start_production.sh [--import] [--prepare-only]'; exit 0; fi
exec "$SCRIPT_DIR/podman.sh" production start "$@"
