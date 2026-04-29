#!/bin/bash

cd /frontend

npm install
npx update-browserslist-db@latest
npm run build
