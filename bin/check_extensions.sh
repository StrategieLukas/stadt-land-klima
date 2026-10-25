#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMAND=typecheck
if [[ "${1:-}" == "--build" && "$#" == 1 ]]; then
  COMMAND=build
elif [[ "$#" != 0 ]]; then
  echo "Usage: $0 [--build]" >&2
  exit 64
fi

for extension_dir in "$REPO_ROOT"/src/directus/extensions/*; do
  [[ -f "$extension_dir/package.json" ]] || continue
  printf '\nChecking %s\n' "${extension_dir##*/}"
  npm --prefix "$extension_dir" run "$COMMAND"
done
