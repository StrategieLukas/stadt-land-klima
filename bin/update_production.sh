#!/bin/bash
cd ..
# no stashing to prevent changes beeing removed
# git stash
git pull
git submodule init
git submodule sync --recursive
git submodule update --recursive
docker compose build && \
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d && \
docker compose exec -T directus sh /build.sh
docker compose exec -T frontend sh /build.sh
cd bin
./stop.sh
./start_production.sh
