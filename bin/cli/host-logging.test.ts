import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { hostSettings } from "./host-configuration.ts";
import { hostArtifacts } from "./host-maintenance.ts";
import { assertAlloyBuild, hostLoggingArtifacts, loggingSettings } from "./host-logging.ts";

const root = resolve(import.meta.dirname, "../..");
const fields = {
  SLK_LOG_ENDPOINT: "https://logs.example.org/loki/api/v1/push",
  SLK_LOG_HOST: "production-1",
  SLK_LOG_ENVIRONMENT: "production",
  SLK_LOG_USERNAME: "slk-production",
  SLK_LOG_PASSWORD_FILE: "/root/.config/slk/loki-password",
};

test("host activation rejects unknown versions and Go builds affected by the HTTP advisory", () => {
  assert.throws(() => assertAlloyBuild("alloy, version v1.22.0\n  go version: go1.27.3\n"));
  assert.throws(() => assertAlloyBuild("alloy, version v1.22.0\n  go version: go1.26.10\n"));
  assert.throws(() => assertAlloyBuild("alloy, version v1.22.0\n"));
  assert.throws(() => assertAlloyBuild("alloy, version v1.23.0\n  go version: go1.27.4\n"));
  assert.doesNotThrow(() => assertAlloyBuild("alloy, version v1.22.0\n  go version: go1.27.4\n"));
  assert.doesNotThrow(() => assertAlloyBuild("alloy, version v1.22.0\n  go version: go1.26.11\n"));
});

test("logging rejects credential-bearing URLs, insecure transport and configuration injection", () => {
  for (const endpoint of [
    "http://logs.example.org/loki/api/v1/push",
    "https://user:password@logs.example.org/loki/api/v1/push",
    "https://logs.example.org/loki/api/v1/push?token=secret",
    "https://logs.example.org/loki/api/v1/push#secret",
    "https://logs.example.org/",
    "https://logs.example.org/loki/api/v1/push\n",
  ])
    assert.throws(() => loggingSettings({ ...fields, SLK_LOG_ENDPOINT: endpoint }));
  for (const key of ["SLK_LOG_HOST", "SLK_LOG_USERNAME", "SLK_LOG_ENVIRONMENT", "SLK_LOG_PASSWORD_FILE"])
    assert.throws(() => loggingSettings({ ...fields, [key]: 'bad\"\nExecStart=/bin/false' }));
  assert.throws(() => loggingSettings({ ...fields, SLK_LOG_ENVIRONMENT: "prodution" }));
  assert.equal(
    loggingSettings({ ...fields, SLK_LOG_ENDPOINT: "https://logs.example.org/insert/loki/api/v1/push" }).endpoint,
    "https://logs.example.org/insert/loki/api/v1/push",
  );
});

test("optional host manifest keeps credentials private and detects collector/config/journal drift", () => {
  const settings = hostSettings(
    {
      SLK_HOST_APP_CONFIG: "/home/deploy/.config/slk/production.env",
      SLK_HOST_BACKUP_CONFIG: "/root/.config/slk/backup.env",
      SLK_HOST_BACKUP_HOST: "production-1",
      SLK_HOST_BACKUP_TAG: "slk",
    },
    { user: "deploy", uid: 1000, gid: 1000, home: "/home/deploy" },
    { SLK_PODMAN_PROJECT: "slk-production", SLK_DEPLOYMENT_TARGET: "production" },
  );
  assert.equal(settings.loggingConfig, null);
  assert.equal(
    hostArtifacts(root, settings, "/root/.config/slk/host.env", 999).some((f) => f.path.includes("alloy")),
    false,
  );
  const logging = loggingSettings(fields);
  const files = hostArtifacts(root, settings, "/root/.config/slk/host.env", 999, { settings: logging, gid: 998 });
  const get = (path: string) => files.find((f) => f.path === path)!;
  const config = get("/etc/slk/alloy/config.alloy");
  assert.equal(config.uid, 0);
  assert.equal(config.gid, 998);
  assert.equal(config.mode, 0o640);
  assert.doesNotMatch(config.bytes.toString(), /__SLK_|\/root\/|password\s*=/);
  assert.match(config.bytes.toString(), /sys.env\("CREDENTIALS_DIRECTORY"\)/);
  assert.match(config.bytes.toString(), /follow_redirects\s*= false/);
  const unit = get("/etc/systemd/system/slk-alloy.service").bytes.toString();
  assert.match(unit, /LoadCredential=loki-password:\/root\/\.config\/slk\/loki-password/);
  assert.match(unit, /User=alloy/);
  assert.match(unit, /SupplementaryGroups=systemd-journal/);
  assert.match(unit, /127.0.0.1:12345/);
  assert.doesNotMatch(unit, /--stability.level|docker.sock|podman.sock|EnvironmentFile/);
  assert.match(get("/etc/systemd/journald.conf.d/60-slk-logging.conf").bytes.toString(), /Storage=persistent/);
  for (const path of [
    "/etc/systemd/system/caddy.service",
    "/etc/systemd/system/staedtechallenge-backup.service",
    "/home/deploy/.config/systemd/user/slk.service",
  ])
    assert.match(get(path).bytes.toString(), /StandardOutput=journal\nStandardError=journal/);
  assert.throws(() => hostLoggingArtifacts(root, "--all", logging, 998));
});

test("host journal and gateway output are already wired without weakening application privacy", () => {
  const compose = readFileSync(resolve(root, "podman-compose.yaml"), "utf8");
  assert.match(compose, /driver: journald/);
  const config = readFileSync(resolve(root, "podman/logging/config.alloy"), "utf8");
  assert.doesNotMatch(config, /format_as_json\s*=\s*true|insecure_skip_verify|wal\s*\{|queue_config\s*\{/);
  assert.match(config, /regex\s*= "frontend"/);
  assert.match(config, /replacement\s*= "nuxt"/);
});

// Run with SLK_TEST_ALLOY_BINARY=/absolute/path/to/reviewed/alloy. The normal
// unit suite stays offline and does not read the machine's real journal.
test(
  "real Alloy normalizes journal labels and server severity without exporting the envelope",
  {
    skip: !process.env.SLK_TEST_ALLOY_BINARY,
    timeout: 15_000,
  },
  async () => {
    const binary = process.env.SLK_TEST_ALLOY_BINARY!;
    const directory = mkdtempSync(resolve(tmpdir(), "slk-alloy-"));
    const freePort = async () => {
      const server = createServer();
      await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
      const address = server.address();
      assert.ok(address && typeof address === "object");
      await new Promise<void>((accept, reject) => server.close((error) => (error ? reject(error) : accept())));
      return address.port;
    };
    const port = await freePort();
    const adminPort = await freePort();
    const generated = hostLoggingArtifacts(root, "slk-production", loggingSettings(fields), 998)[0]!.bytes.toString();
    writeFileSync(resolve(directory, "production.alloy"), generated);
    const validation = spawnSync(binary, ["validate", resolve(directory, "production.alloy")], { encoding: "utf8" });
    assert.equal(validation.status, 0, validation.stderr);
    const configuration = generated
      .replace(
        /loki.source.journal "host" \{[\s\S]*?\n\}/,
        `loki.source.api "fixture" {
      http {
        listen_address = "127.0.0.1"
        listen_port = ${port}
      }
      use_incoming_timestamp = true
      relabel_rules = loki.relabel.journal.rules
      forward_to = [loki.process.records.receiver]
      labels = { project = "stadt-land-klima", environment = "production", host = "production-1", service_name = "host" }
    }`,
      )
      .replaceAll("loki.write.monitoring.receiver", "loki.echo.fixture.receiver")
      .replace(/loki.write "monitoring" \{[\s\S]*$/, 'loki.echo "fixture" {}\n');
    const path = resolve(directory, "fixture.alloy");
    writeFileSync(path, configuration);
    const child = spawn(binary, [
      "run",
      "--disable-reporting",
      "--server.http.enable-pprof=false",
      `--server.http.listen-addr=127.0.0.1:${adminPort}`,
      `--storage.path=${directory}/state`,
      path,
    ]);
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    const exited = new Promise<void>((accept, reject) => {
      child.once("exit", () => accept());
      child.once("error", reject);
    });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          ready = (await fetch(`http://127.0.0.1:${port}/ready`)).ok;
        } catch {
          /* Starting. */
        }
        if (ready) break;
        await delay(50);
      }
      assert.ok(ready, output);
      const cases = [
        {
          service: "nuxt",
          container: "slk-production_frontend_1",
          line: '{"severity":"error","event":"nuxt.fixture"}',
          level: "error",
        },
        {
          service: "directus",
          container: "slk-production_directus_2",
          line: '{"level":50,"event":"directus.fixture"}',
          level: "error",
        },
        { service: "caddy", unit: "caddy.service", line: '{"level":"error","msg":"gateway.fixture"}', level: "error" },
        { service: "postgresql", container: "slk-production_db_1", line: "plain postgres fixture", level: "warning" },
        { service: "redis", container: "slk-production-cache-3", line: "plain redis fixture", level: "warning" },
        { service: "slk-worker", unit: "slk-worker@instance-123.service", line: "worker fixture", level: "warning" },
        {
          service: "host",
          unit: "session-123.scope",
          line: '{"severity":"unbounded-attacker-value"}',
          level: "unknown",
        },
      ];
      for (const value of cases) {
        const response = await fetch(`http://127.0.0.1:${port}/loki/api/v1/push`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            streams: [
              {
                stream: {
                  __journal_container_name: value.container ?? "",
                  __journal__systemd_unit: value.unit ?? "libpod-opaque-id.scope",
                  __journal_priority_keyword: "warning",
                  __journal__cmdline: "private-envelope-canary",
                },
                values: [[(BigInt(Date.now()) * 1_000_000n).toString(), value.line]],
              },
            ],
          }),
        });
        assert.equal(response.status, 204);
      }
      for (let attempt = 0; attempt < 50 && output.split('"received log entry"').length - 1 < cases.length; attempt++)
        await delay(50);
      const entries = output
        .split("\n")
        .filter((line) => line.includes('"received log entry"'))
        .map((line) => JSON.parse(line) as { entry: string; labels: string });
      assert.equal(entries.length, cases.length, output);
      for (const value of cases) {
        const entry = entries.find((record) => record.entry === value.line);
        assert.ok(entry, value.line);
        assert.ok(entry.labels.includes(`service_name="${value.service}"`), entry.labels);
        assert.ok(entry.labels.includes(`level="${value.level}"`), entry.labels);
        assert.doesNotMatch(entry.labels, /__journal|opaque-id|instance-123|session-123/);
      }
      assert.doesNotMatch(JSON.stringify(entries), /private-envelope-canary/);
    } finally {
      child.kill("SIGTERM");
      await exited;
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
