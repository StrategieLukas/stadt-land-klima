#!/bin/bash
NO_DIRECTUS_BUILD=false
NO_FRONTEND_BUILD=false
NO_RESTART=false
UID=${UID}
GID=${GID}

for arg in "$@"; do
  case $arg in
    --no-directus-build)
      NO_DIRECTUS_BUILD=true
      shift
      ;;
    --no-frontend-build)
      NO_FRONTEND_BUILD=true
      shift
      ;;
    --no-restart)
      NO_RESTART=true
      shift
      ;;
    --help)
      echo "Options:
--no-directus-build > prevents building directus
--no-frontend-build > prevents building frontend
--no-restart > prevents container restart"
      exit
      ;;
    *)
      ;;
  esac
done

cd ..
# no stashing to prevent changes beeing removed
# git stash
git pull
git submodule init
git submodule sync --recursive
git submodule update --recursive
docker compose build && \
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d && \
if [[ $NO_DIRECTUS_BUILD != true ]]; then
  echo "building directus ..."
  docker compose exec -T directus sh /build.sh
fi
if [[ $NO_FRONTEND_BUILD != true ]]; then
echo "building frontend ..."
  docker compose exec -T frontend sh /build.sh
fi
cd bin

if [[ $NO_RESTART != true ]]; then
  ./stop.sh
  ./start_production.sh
fi
