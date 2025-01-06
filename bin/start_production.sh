#!/bin/bash
cd ..

mkdir -p src/directus/uploads
UID="$(id -u)"
GID="$(id -g)"
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d
