#!/bin/bash
# Enforce compiler execution while allowing reviewed legacy diagnostics
# Existing errors are recorded in .ts-baseline.txt

set -euo pipefail
cd "$(dirname "$0")"
if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != '--update-baseline' ]; }; then
  echo 'Usage: typecheck.sh [--update-baseline]' >&2
  exit 64
fi

npm exec --no -- nuxt prepare

report=$(mktemp)
diagnostics=$(mktemp)
trap 'rm -f "$report" "$diagnostics"' EXIT

# Compile both the application and component templates. Only existing non-component
# debt may use the shared baseline; strict component templates add no exemptions.
check_report() {
  local chunk checker_status=0
  chunk=$(mktemp)
  npm exec --no -- vue-tsc "$@" > "$chunk" 2>&1 || checker_status=$?
  cat "$chunk" | tee -a "$report"
  if { [ "$checker_status" -ne 0 ] && [ "$checker_status" -ne 1 ] && [ "$checker_status" -ne 2 ]; } ||
     { [ "$checker_status" -ne 0 ] && { ! grep -q 'error TS' "$chunk" || grep -Eq 'Error:|ERR_|Exception|Segmentation fault|[Ff]atal' "$chunk"; }; }; then
    rm -f "$chunk"
    echo 'Type checker failed; the diagnostic baseline cannot accept a tool failure.'
    exit "$checker_status"
  fi
  rm -f "$chunk"
}
check_report -b --noEmit --pretty false
check_report --noEmit -p tsconfig.components.json --pretty false
if grep -q '^components/.*error TS' "$report"; then
  echo 'Component diagnostics cannot be added to the migration baseline.'
  exit 1
fi
awk -F: '/error TS/ { print $1 ":" $2 }' "$report" | LC_ALL=C sort -u > "$diagnostics"

if [ "${1:-}" = '--update-baseline' ]; then
  # Replace only after successful preparation and a valid checker report.
  # Keep this an explicit maintenance command; normal checks never add debt.
  cp "$diagnostics" .ts-baseline.txt
  echo 'Diagnostic baseline updated; review its diff before accepting new debt.'
  exit 0
fi

new=$(LC_ALL=C comm -23 "$diagnostics" <(LC_ALL=C sort -u .ts-baseline.txt))
if [ -n "$new" ]; then
  echo "New type errors detected:"
  echo "$new"
  exit 1
fi
echo "Type check passed (existing baseline errors ignored)"
