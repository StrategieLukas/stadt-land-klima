#!/bin/sh
# Both clusters have already been restored and verified; all writers must be stopped.
set -eu
run_id="$1"
storage="${2:-/storage}"
case "$run_id" in ''|*[!A-Za-z0-9_-]*) echo 'Invalid upgrade identifier' >&2; exit 2;; esac
case "$storage" in /*) ;; *) echo 'Storage path must be absolute' >&2; exit 2;; esac
for name in db meilisearch; do
  test -d "$storage/$name"
  test -d "$storage/$name.upgrade-$run_id"
  test ! -e "$storage/$name.before-$run_id"
done
rollback() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    for name in db meilisearch; do
      if [ -d "$storage/$name.before-$run_id" ]; then
        if [ -d "$storage/$name" ]; then mv "$storage/$name" "$storage/$name.upgrade-$run_id"; fi
        mv "$storage/$name.before-$run_id" "$storage/$name"
      fi
    done
  fi
  exit "$status"
}
trap rollback EXIT
for name in db meilisearch; do
  mv "$storage/$name" "$storage/$name.before-$run_id"
  mv "$storage/$name.upgrade-$run_id" "$storage/$name"
done
