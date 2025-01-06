#!/bin/bash
cd ..

docker compose --build-arg UID=${UID} --build-arg GID=${GID} -f docker-compose.yaml -f docker-compose.prod.yaml build
