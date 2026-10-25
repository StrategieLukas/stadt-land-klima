#!/bin/bash
# Every maintained Nuxt context and Vue template must compile without exemptions.
set -euo pipefail
cd "$(dirname "$0")"
if [ "$#" -ne 0 ]; then
  echo 'Usage: typecheck.sh' >&2
  exit 64
fi
npm exec --no -- nuxt prepare
npm exec --no -- vue-tsc -b --noEmit --pretty false
npm exec --no -- vue-tsc --noEmit -p tsconfig.components.json --pretty false
