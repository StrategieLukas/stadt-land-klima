#!/usr/bin/env node
// Compose providers may place --podman-args after the subcommand. Keep global
// options before it, and forbid remote execution regardless of caller defaults.
if (!process.execve) throw new Error("Node 24 or newer is required.");
process.execve("/usr/bin/env", ["env", "podman", "--remote=false", ...process.argv.slice(2)], process.env);
