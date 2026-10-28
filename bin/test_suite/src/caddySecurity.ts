/** Optional real proxy gate. Uses disposable Caddy, trusted fixture TLS and isolated upstreams. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { request } from "node:https";
import { request as httpRequest } from "node:http";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "slk-caddy-"));
const name = "slk-caddy-" + randomUUID();
const upstream = name + "-upstream";
const image = process.env.SLK_CADDY_IMAGE || "slk-caddy-security:local";
const docker = (...args: string[]) =>
  execFileSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    timeout: 600_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let created = false;
let upstreamCreated = false;
try {
  if (!process.env.SLK_CADDY_IMAGE) docker("build", "-t", image, "-f", "caddy/Containerfile", "caddy");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-subj",
      "/CN=www.stadt-land-klima.de",
      "-addext",
      "subjectAltName=DNS:www.stadt-land-klima.de,DNS:stadt-land-klima.de,DNS:staging.stadt-land-klima.de",
      "-days",
      "1",
      "-keyout",
      join(directory, "key.pem"),
      "-out",
      join(directory, "cert.pem"),
    ],
    { stdio: "ignore" },
  );
  const configMounts = [
    "--mount",
    `type=bind,source=${join(root, "caddy")},target=/etc/caddy,readonly`,
    "--mount",
    `type=bind,source=${directory},target=/fixture,readonly`,
  ];
  const configuration = [
    "--env",
    "SLK_CADDY_CERT=/fixture/cert.pem",
    "--env",
    "SLK_CADDY_KEY=/fixture/key.pem",
    "--env",
    "SLK_CADDY_APEX_CERT=/fixture/cert.pem",
    "--env",
    "SLK_CADDY_APEX_KEY=/fixture/key.pem",
    "--env",
    "SLK_CADDY_HTTP_PORT=8080",
    "--env",
    "SLK_CADDY_HTTPS_PORT=8443",
  ];
  const confined = [
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--user",
    "1000:1000",
    "--memory",
    "512m",
    "--pids-limit",
    "128",
    "--tmpfs",
    "/run/caddy:rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=700",
    "--tmpfs",
    "/data:rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=700",
    "--tmpfs",
    "/config:rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=700",
  ];
  if (process.env.SLK_CADDY_SECCOMP) confined.push("--security-opt", "seccomp=" + process.env.SLK_CADDY_SECCOMP);
  for (const file of ["Caddyfile", "Caddyfile.staging"])
    docker(
      "run",
      "--rm",
      "--network",
      "none",
      ...confined,
      ...configMounts,
      ...configuration,
      image,
      "validate",
      "--config",
      "/etc/caddy/" + file,
      "--adapter",
      "caddyfile",
    );
  docker(
    "run",
    "-d",
    "--name",
    name,
    ...confined,
    ...configMounts,
    ...configuration,
    "--publish",
    "127.0.0.1::8443",
    "--publish",
    "127.0.0.1::8080",
    image,
  );
  created = true;
  docker(
    "run",
    "-d",
    "--name",
    upstream,
    "--network",
    "container:" + name,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--user",
    "1000:1000",
    "--memory",
    "256m",
    "--pids-limit",
    "64",
    "--mount",
    `type=bind,source=${join(root, "bin/test_suite/src/fixtures/caddy-upstream.ts")},target=/upstream.ts,readonly`,
    "node:24.22.1-trixie-slim",
    "node",
    "/upstream.ts",
  );
  upstreamCreated = true;
  const port = Number(docker("port", name, "8443/tcp").split(":").at(-1));
  const httpPort = Number(docker("port", name, "8080/tcp").split(":").at(-1));
  const ca = readFileSync(join(directory, "cert.pem"));
  type Result = { status: number; headers: import("node:http").IncomingHttpHeaders; body: string };
  const fetch = (
    path: string,
    headers: Record<string, string> = {},
    body?: Buffer,
    host = "www.stadt-land-klima.de",
    plain = false,
  ) =>
    new Promise<Result>((resolve, reject) => {
      const makeRequest = plain ? httpRequest : request;
      const req = makeRequest(
        {
          hostname: "127.0.0.1",
          port: plain ? httpPort : port,
          path,
          servername: host,
          ca,
          method: body ? "POST" : "GET",
          headers: { Host: host, ...headers },
          agent: false,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode!,
              headers: response.headers,
              body: Buffer.concat(chunks).toString(),
            }),
          );
        },
      );
      req.setTimeout(5000, () => req.destroy(new Error("Fixture proxy timeout")));
      req.on("error", reject);
      req.end(body);
    });
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt++) {
    try {
      ready = (await fetch("/")).status === 200;
    } catch {
      /* Wait for fixture only. */
    }
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Isolated Caddy/upstream must start");
  assert.equal(
    (await fetch("/redirect?keep=1", {}, undefined, "www.stadt-land-klima.de", true)).headers.location,
    "https://www.stadt-land-klima.de/redirect?keep=1",
  );
  assert.equal((await fetch("/redirect", {}, undefined, "stadt-land-klima.de")).status, 301);
  for (const [path, expected, headers] of [
    ["/backend/items/pages?deep=%7B%7D", 400, {}],
    ["/backend/items/pages?%64%65%65%70=%7B%7D", 400, {}],
    ["/backend/server/health", 403, { Upgrade: "websocket" }],
    ["/backend/graphql", 403, {}],
    ["/backend/GraphQL", 403, {}],
    ["/backend//graphql", 403, {}],
    ["/backend/./graphql", 403, {}],
    ["/backend/items/../graphql", 403, {}],
    ["/backend/%2e/graphql", 403, {}],
    ["/backend/utils//hash/generate", 403, {}],
    ["/backend/%75tils/%68ash/generate", 403, {}],
    ["/backend/utils/hash/verify", 403, {}],
  ] as const) {
    const response = await fetch(path, headers);
    assert.equal(response.status, expected, path);
    assert.ok(response.headers["content-security-policy"]);
    assert.equal(response.headers["x-permitted-cross-domain-policies"], "none");
  }
  const forwarded = await fetch("/backend/items/pages?deep[page][_limit]=1", {
    "X-Real-IP": "203.0.113.55",
    "X-Forwarded-For": "203.0.113.55",
    "X-Forwarded-Proto": "forged",
    Forwarded: "for=203.0.113.55",
  });
  assert.equal(forwarded.status, 200);
  assert.match(forwarded.body, /"path":"\/items\/pages\?deep\[page\]/);
  assert.doesNotMatch(forwarded.body, /203\.0\.113\.55|forged|"forwarded":/);
  assert.match(forwarded.body, /"forwardedProto":"https"/);
  const ai = await fetch("/ai/chat");
  assert.match(ai.body, /"path":"\/ai\/chat"/);
  for (const path of [
    "/elections/thesen/private-path-canary",
    "/api/candidate/private-path-canary",
    "/municipalities/example?preview=private-query-canary",
    "/municipalities/example?%70review=private-query-canary",
  ]) {
    const response = await fetch(path);
    assert.equal(response.headers["referrer-policy"], "no-referrer");
    assert.equal(response.headers["x-powered-by"], undefined);
  }
  const page = await fetch("/");
  assert.equal(page.headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.equal(page.headers.server, undefined);
  const csp = String(page.headers["content-security-policy"]);
  assert.match(csp, /nonce-syntheticNonce/);
  assert.match(csp, /frame-ancestors 'self'/);
  await fetch("/municipalities/example?preview=private-query-canary", {
    Referer: "https://example.test/private-referrer-canary",
    Authorization: "Bearer private-auth-canary",
    Cookie: "session=private-cookie-canary",
    "User-Agent": 'badbot 203.0.113.55 forged-json-canary {"severity":"error"}',
  });
  const fallback = await fetch(
    "/unavailable",
    {
      Authorization: "Bearer private-auth-canary",
      Cookie: "session=private-cookie-canary",
    },
    Buffer.from("private-body-canary"),
  );
  assert.equal(fallback.status, 200);
  assert.match(fallback.body, /"maintenance":true/);
  assert.match(fallback.body, /"method":"GET"/);
  assert.doesNotMatch(fallback.body, /private-auth-canary|private-cookie-canary/);
  assert.equal((await fetch("/backend/unavailable")).status, 200);
  assert.equal((await fetch("/ai/unavailable")).status, 503, "AI errors retain upstream behavior");
  assert.equal((await fetch("/_nuxt/unavailable.js")).status, 503, "Static errors do not trigger maintenance");
  assert.equal((await fetch("/elections/thesen/unavailable")).status, 503);
  const tooLarge = await fetch("/ai/chat", { "Content-Length": String(10485761) }, Buffer.alloc(10485761));
  assert.equal(tooLarge.status, 413, "AI retains nginx's 10 MiB body limit");
  await fetch("/_test/cms-down");
  assert.match(
    (await fetch("/backend/server/health")).body,
    /"maintenance":true/,
    "Connection failure reaches maintenance",
  );
  const assets = await Promise.all(Array.from({ length: 180 }, (_, i) => fetch(`/_nuxt/chunk-${i}.js`)));
  assert.ok(
    assets.every((response) => response.status === 200),
    "180 asset chunks must fit independent budget",
  );
  assert.equal((await fetch("/")).status, 200);
  const pages = await Promise.all(Array.from({ length: 100 }, () => fetch("/")));
  assert.ok(
    pages.some((response) => response.status === 429),
    "Dynamic pages remain rate limited",
  );
  const logs = docker("logs", name);
  assert.doesNotMatch(
    logs,
    /private-(?:path|query|referrer|auth|cookie|body)-canary|forged-json-canary|203\.0\.113\.55/,
  );
  for (const line of logs.split("\n").filter(Boolean)) {
    const value = JSON.parse(line) as Record<string, unknown>;
    assert.equal(value.remote_ip, undefined);
    if (value.level === "error" && typeof value.status === "number")
      assert.ok(value.status >= 500, "Ordinary rejections must not emit errors");
    if (value.actorType === "unknown") assert.equal(value.userId, null);
    const requestFields = value.request as Record<string, unknown> | undefined;
    if (requestFields) {
      for (const key of ["uri", "headers", "remote_ip", "client_ip", "remote_port"])
        assert.equal(requestFields[key], undefined, key);
    }
  }
  assert.match(logs, /"userAgent":"bot"/);
  process.stdout.write(
    "Caddy: production/staging validation, TLS redirects, proxy guards/headers, nonce CSP, private logs/referrers, body limits, maintenance and independent rate budgets passed.\n",
  );
} finally {
  if (process.env.TEST_KEEP_CADDY_FIXTURE === "1")
    process.stdout.write(`Retained Caddy fixture ${name} ${directory}\n`);
  else {
    if (upstreamCreated) docker("rm", "-f", upstream);
    if (created) docker("rm", "-f", name);
    rmSync(directory, { recursive: true, force: true });
  }
}
