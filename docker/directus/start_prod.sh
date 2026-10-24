#!/bin/bash
set -eu

cd /directus/cli
npm ci --include=dev --no-audit --no-fund
npm run typecheck
cd ..

node /directus/cli.js bootstrap && \
cd /directus/cli && ./node_modules/.bin/tsx security/startupChecks.ts && cd .. && \
node /directus/cli.js start
