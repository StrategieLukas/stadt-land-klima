/**
 * A shell script for `podman exec` in a database container, with the container's private settings.
 *
 * Containers with mounted settings receive POSTGRES_* only through their slk-env loader, and
 * `podman exec` does not inherit what the loader gave PID 1. Containers with native secrets have
 * no loader and already carry the values. A present but failing loader never falls back to
 * inherited values, because `exec` replaces the shell in both branches.
 *
 * The script is passed as an argument, never pasted into quotes, so it may contain any character
 * (SQL literals included). `name` becomes the script's $0 and `args` its $1, $2, ...
 */
const loader = 'if command -v slk-env >/dev/null 2>&1; then exec slk-env sh -ec "$0" "$@"; fi; exec sh -ec "$0" "$@"';

export function databaseShell(script: string, name: string, ...args: string[]): string[] {
  return ["sh", "-ec", loader, script, name, ...args];
}
