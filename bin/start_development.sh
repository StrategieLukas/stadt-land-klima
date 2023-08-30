#!/bin/bash
cd ..

mkdir -p src/directus/uploads

uid=$UID docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up --build --remove-orphans
