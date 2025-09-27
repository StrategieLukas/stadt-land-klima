#!/bin/bash
cd ..

docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec directus /directus/cli/import-all.sh
