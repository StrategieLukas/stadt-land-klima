#!/bin/bash
set -eu

cd /directus/cli

npm ci --include=dev --no-audit --no-fund
npm run typecheck

cd ..

# ./directus-cli import:schema -v -f && npx directus database migrate:up TODO neu machen
