#!/bin/bash

cd /frontend

npm ci

# Clear stale nuxt dev cache to avoid "Unexpected end of input" and
# "#internal/nuxt/paths not defined" errors during the startup compilation window.
rm -rf .nuxt/dist

npm run dev
