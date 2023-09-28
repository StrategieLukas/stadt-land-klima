#!/bin/bash

cd /directus/cli

npm install

cd ..

sh directus-cli import:schema -v -f
npx directus database migrate:up
