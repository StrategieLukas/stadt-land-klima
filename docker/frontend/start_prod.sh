#!/bin/bash

cd /frontend

npm ci
npm run build
node .output/server/index.mjs
