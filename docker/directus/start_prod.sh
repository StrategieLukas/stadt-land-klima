#!/bin/bash

cd /directus/cli
npm install
cd ..

node /directus/cli.js bootstrap && \
cd /directus/cli && npx tsx security/startupChecks.ts && cd .. && \
node /directus/cli.js start
