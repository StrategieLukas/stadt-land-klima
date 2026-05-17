#!/bin/bash

# Use the new import:all command which clears cache once and imports sequentially
./directus-cli -f -r import:all

echo "All imports completed"
