#!/bin/bash
cd ..

docker compose -f docker-compose.yaml -f docker-compose.prod.yaml build --build-arg UID=$(id -u) --build-arg GID=$(id -g)
