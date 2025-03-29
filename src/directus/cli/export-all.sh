#!/bin/bash

export() {
    echo "Exporting $1 ..."
    ./directus-cli -f export:$1
    echo "Done"
    echo ""
}

export "schema"
export "roles"
export "flows"
#export "presets"
export "translations"
export "webhooks"
#export "items"
export "settings"
