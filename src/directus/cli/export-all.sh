#!/bin/bash

# Use the new export:all command which clears cache once and exports sequentially
./directus-cli -f -c export:all

echo "All exports completed"
