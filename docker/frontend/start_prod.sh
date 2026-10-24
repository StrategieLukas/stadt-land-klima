#!/bin/bash
set -eu

cd /frontend

if node scripts/productionOutput.mts verify; then
  echo "Production output verified; starting without reinstalling or rebuilding."
else
  slk_build_input="$(node scripts/productionOutput.mts prepare)"
  npm ci
  npm run build
  node scripts/productionOutput.mts stamp "$slk_build_input"
fi
exec node .output/server/index.mjs
