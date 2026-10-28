/** Explicit read-only acceptance against an already prepared rootless production stack. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const run = (...args: string[]) =>
  execFileSync("./bin/podman.sh", ["production", ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
run("doctor");
process.stdout.write(run("audit"));
for (const service of ["db", "cache", "meilisearch", "directus", "frontend"]) {
  run(
    "compose",
    "exec",
    "-T",
    service,
    "sh",
    "-ec",
    "if touch /usr/slk-readonly-probe 2>/dev/null; then rm /usr/slk-readonly-probe; exit 1; fi",
  );
}
run(
  "compose",
  "exec",
  "-T",
  "frontend",
  "node",
  "--input-type=module",
  "-e",
  `
  import {Worker} from 'node:worker_threads';
  import {execFileSync} from 'node:child_process';
  import assert from 'node:assert/strict';
  const worker=new Worker('require("node:worker_threads").parentPort.postMessage(42)',{eval:true,execArgv:[]});
  assert.equal(await new Promise((ok,fail)=>{worker.once('message',ok);worker.once('error',fail)}),42);
  await worker.terminate();
  assert.equal(execFileSync('node',['-p','6*7'],{encoding:'utf8'}).trim(),'42');
`,
);
run(
  "compose",
  "exec",
  "-T",
  "directus",
  "sh",
  "-ec",
  `
  directory=$(mktemp -d /directus/.tmp/slk-acceptance-XXXXXX)
  trap 'rm -rf "$directory"' EXIT
  printf 'SLK container acceptance' > "$directory/probe.typ"
  typst compile "$directory/probe.typ" "$directory/probe.pdf"
  test -s "$directory/probe.pdf"
`,
);
const port = process.env.SLK_PODMAN_WEB_PORT || "9000";
if (!/^\d{4,5}$/.test(port)) throw new Error("Invalid frontend acceptance port");
for (const path of ["/", "/measures", "/map", "/stats", "/jobs", "/organisation", "/news"]) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-security-policy") || "", /script-src.*'nonce-/);
  assert.match(await response.text(), /<html/);
}
process.stdout.write(
  "Rootless production acceptance passed: runtime controls, immutable roots, Node workers/children, Typst and seven HTTP/CSP routes.\n",
);
