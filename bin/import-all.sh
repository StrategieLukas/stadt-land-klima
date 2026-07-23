#!/bin/bash
set -euo pipefail
cd ..

docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec directus /directus/cli/import-all.sh
