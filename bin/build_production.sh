#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BUILD_DIRECTUS=true
BUILD_FRONTEND=true

for arg in "$@"; do
  case "$arg" in
    --no-directus-build)
      BUILD_DIRECTUS=false
      ;;
    --no-frontend-build)
      BUILD_FRONTEND=false
      ;;
    --help)
      echo "Options:
--no-directus-build  skip the Directus image
--no-frontend-build  skip the frontend image"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

cd "$REPO_ROOT"
BUILD_SERVICES=()
if [[ $BUILD_DIRECTUS == true ]]; then
  BUILD_SERVICES+=(directus)
fi
if [[ $BUILD_FRONTEND == true ]]; then
  BUILD_SERVICES+=(frontend)
fi

if ((${#BUILD_SERVICES[@]} == 0)); then
  echo "No production images selected for rebuilding."
  exit 0
fi

echo "Rebuilding production images without Docker build cache..."
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml build \
  --no-cache \
  --pull \
  --build-arg UID="$(id -u)" \
  --build-arg GID="$(id -g)" \
  "${BUILD_SERVICES[@]}"
