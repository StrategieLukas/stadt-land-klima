#!/bin/bash

cd /frontend

npm install
npm run build
node .output/server/index.mjs
