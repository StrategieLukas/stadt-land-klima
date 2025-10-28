#!/bin/bash
cd ..
if [ -f src/directus/.env ]; then
  source src/directus/.env
fi
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec -T db psql -p $DB_PORT -U $DB_USER -d $DB_DATABASE $1
