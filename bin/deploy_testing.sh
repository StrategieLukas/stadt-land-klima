#!/bin/bash
set -euo pipefail

ssh deploy@staging 'cd slk-testing/bin && ./update_development.sh'
