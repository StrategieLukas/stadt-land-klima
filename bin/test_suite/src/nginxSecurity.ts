/** Optional local integration gate; uses only a disposable nginx and stub upstreams. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { request } from "node:https";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "slk-nginx-gate-"));
const name = "slk-nginx-test-" + randomUUID();
let created = false;
const docker = (...args: string[]) =>
  execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
try {
  const cert = join(directory, "cert");
  mkdirSync(cert);
  for (const host of ["stadt-land-klima.de", "www.stadt-land-klima.de"])
    mkdirSync(join(cert, "live", host), { recursive: true });
  const first = join(cert, "live", "stadt-land-klima.de");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-subj",
      "/CN=localhost",
      "-days",
      "1",
      "-keyout",
      join(first, "privkey.pem"),
      "-out",
      join(first, "fullchain.pem"),
    ],
    { stdio: "ignore" },
  );
  for (const file of ["privkey.pem", "fullchain.pem"])
    copyFileSync(join(first, file), join(cert, "live", "www.stadt-land-klima.de", file));
  const fixture = join(directory, "upstream.conf");
  writeFileSync(
    fixture,
    'server { listen 9001; location / { return 200 "$http_x_real_ip $http_x_forwarded_for"; } }\nserver { listen 9000; add_header X-Powered-By synthetic-upstream always; location / { return 200 "frontend"; } }\n',
  );
  const image = /^FROM\s+(nginx:\S+)/m.exec(readFileSync(join(root, "docker/maintenance/Dockerfile"), "utf8"))?.[1];
  assert.ok(image, "Use the maintained, pinned nginx image");
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--publish",
    "127.0.0.1::443",
    "--memory",
    "128m",
    "--pids-limit",
    "64",
    "--mount",
    `type=bind,source=${join(root, "nginx/sites-available/stadt-land-klima.de")},target=/etc/nginx/conf.d/slk.conf,readonly`,
    "--mount",
    `type=bind,source=${fixture},target=/etc/nginx/conf.d/upstream.conf,readonly`,
    "--mount",
    `type=bind,source=${cert},target=/etc/letsencrypt,readonly`,
    image,
  );
  created = true;
  const port = Number(docker("port", name, "443/tcp").split(":").at(-1));
  const fetch = (path: string, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; headers: import("node:http").IncomingHttpHeaders; body: string }>(
      (resolve, reject) => {
        const req = request(
          {
            hostname: "127.0.0.1",
            port,
            path,
            rejectUnauthorized: false,
            headers: { Host: "www.stadt-land-klima.de", ...headers },
          },
          (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
              body += String(chunk);
            });
            response.on("end", () => resolve({ status: response.statusCode!, headers: response.headers, body }));
          },
        );
        req.setTimeout(3000, () => req.destroy(new Error("Local nginx timeout")));
        req.on("error", reject);
        req.end();
      },
    );
  let ready = false;
  let lastFailure = "";
  for (let attempt = 0; attempt < 40 && !ready; attempt++) {
    try {
      const response = await fetch("/");
      ready = response.status === 200;
      lastFailure = "HTTP " + response.status;
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      lastFailure = String(error);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) {
    for (const file of ["stadt-land-klima.de_error.log", "nginx-error.log"]) {
      try {
        docker("cp", name + ":/var/log/nginx/" + file, join(directory, file));
        lastFailure += readFileSync(join(directory, file), "utf8");
      } catch {
        /* No log at this path. */
      }
    }
  }
  assert.ok(ready, "Disposable nginx must start: " + lastFailure + (ready ? "" : docker("logs", name)));
  for (const [path, expected, headers] of [
    ["/backend/items/pages?deep=%7B%7D", 400, {}],
    ["/backend/items/pages?%64%65%65%70=%7B%7D", 400, {}],
    [
      "/backend/items/pages?deep[page][_limit]=1",
      200,
      { "X-Real-IP": "203.0.113.55", "X-Forwarded-For": "203.0.113.55" },
    ],
    ["/backend/server/health", 403, { Upgrade: "websocket" }],
    ["/backend/graphql", 403, {}],
    ["/backend/utils/hash/generate", 403, {}],
    ["/backend/GraphQL", 403, {}],
    ["/backend/%75tils/%68ash/generate", 403, {}],
  ] as const) {
    const response = await fetch(path, headers);
    assert.equal(response.status, expected, path);
    assert.ok(response.headers["content-security-policy"]);
    assert.equal(response.headers["content-security-policy-report-only"], undefined);
    assert.equal(response.headers["x-permitted-cross-domain-policies"], "none");
    assert.doesNotMatch(response.body, /203\.0\.113\.55/);
  }
  for (const path of [
    "/elections/thesen/synthetic-token",
    "/api/candidate/synthetic-token",
    "/municipalities/example?preview=synthetic-token",
  ]) {
    const response = await fetch(path);
    assert.equal(response.headers["referrer-policy"], "no-referrer", path);
    assert.equal(response.headers["x-powered-by"], undefined, "Private routes suppress upstream identification too");
  }
  const publicResponse = await fetch("/");
  assert.equal(publicResponse.headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.equal(publicResponse.headers["x-powered-by"], undefined);
  await fetch("/municipalities/example?preview=synthetic-private-query", {
    Referer: "https://www.stadt-land-klima.de/elections/thesen/synthetic-private-referrer",
  });
  const access = join(directory, "access.log");
  docker("cp", name + ":/var/log/nginx/stadt-land-klima.de_access.log", access);
  const log = readFileSync(access, "utf8");
  assert.match(log, /GET \/municipalities\/example HTTP/);
  assert.doesNotMatch(log, /synthetic-private-query|synthetic-private-referrer|synthetic-token|deep=/);

  // Nuxt/Blökkli preloads more chunks than the dynamic page burst permits.
  const assets = await Promise.all(Array.from({ length: 180 }, (_, index) => fetch(`/_nuxt/chunk-${index}.js`)));
  assert.ok(
    assets.every((response) => response.status === 200),
    "Normal chunk bursts must not be throttled",
  );
  assert.equal((await fetch("/")).status, 200, "Static downloads must not consume the dynamic page budget");
  const pages: number[] = [];
  for (let index = 0; index < 30; index++) {
    pages.push(...(await Promise.all(Array.from({ length: 5 }, () => fetch("/")))).map((response) => response.status));
  }
  assert.ok(pages.includes(429), "Dynamic pages must remain rate limited");

  console.log(
    "Nginx: deep/GraphQL/hash/WebSocket guards, trusted headers, private logs/referrers, 180-chunk bursts and independent dynamic-page throttling verified.",
  );
} finally {
  if (process.env.TEST_KEEP_NGINX_FIXTURE === "1") {
    console.log("Retained nginx fixture: " + name + " " + directory);
  } else if (created) docker("rm", "-f", name);
  if (process.env.TEST_KEEP_NGINX_FIXTURE !== "1") rmSync(directory, { recursive: true, force: true });
}
