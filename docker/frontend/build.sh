#!/bin/bash

cd /frontend

npm ci
npx update-browserslist-db@latest
npm run build
