#!/bin/bash
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec directus /directus/cli/import-all.sh
# Now reset all permissions for the public role to be safe
cd ..
if [ -f src/directus/.env ]; then
  source src/directus/.env
fi

docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec -T db psql -p $DB_PORT -U $DB_USER -d $DB_DATABASE < ./bin/migrations/reset-public-role-permissions.sql
