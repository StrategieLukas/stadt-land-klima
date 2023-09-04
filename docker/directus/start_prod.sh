#!/bin/bash

cd /directus/cli
npm install
cd ..

node /directus/cli.js bootstrap && \
node /directus/cli.js start
