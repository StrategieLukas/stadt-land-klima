#!/bin/bash
cd ..
# no stashing to prevent changes beeing removed
# git stash
git pull
git submodule sync --recursive
git submodule update --recursive
uid=$UID docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up --build --remove-orphans
