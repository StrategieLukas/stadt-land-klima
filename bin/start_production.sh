#!/bin/bash
cd ..

mkdir -p src/directus/uploads
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d
