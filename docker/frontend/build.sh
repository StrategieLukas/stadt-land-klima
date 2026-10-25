#!/bin/bash
set -e

cd /frontend

npm ci
npx update-browserslist-db@latest
npm run build
