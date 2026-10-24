#!/bin/bash
cd ..
# no stashing to prevent changes beeing removed
# git stash
git pull
git submodule sync --recursive
git submodule update --recursive
./bin/start_development.sh
