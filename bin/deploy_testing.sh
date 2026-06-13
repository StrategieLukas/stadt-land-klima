#!/bin/bash
set -euo pipefail

ssh deploy@staging 'cd slk-testing/bin && git pull &&  ./update_development.sh'
