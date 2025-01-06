#!/bin/bash
cd ..

mkdir -p src/directus/uploads
UID=${UID}
GID=${GID}
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d
