#!/bin/bash
cd ..

docker compose -f docker-compose.yaml -f docker-compose.prod.yaml build --build-arg UID=${UID} --build-arg GID=${GID}
