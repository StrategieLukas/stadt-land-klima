import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { hostLoggingBackupPaths, hostSettings } from "./host-configuration.ts";
import { hostArtifacts } from "./host-maintenance.ts";
import { assertVectorBuild, HOST_VECTOR_SHA256, hostLoggingArtifacts, loggingSettings } from "./host-logging.ts";

const root = resolve(import.meta.dirname, "../..");
const fields = {
  SLK_LOG_ENDPOINT: "https://logs.example.org/insert/jsonline",
  SLK_LOG_HOST: "production-1",
  SLK_LOG_ENVIRONMENT: "production",
  SLK_LOG_USERNAME: "slk-production",
  SLK_LOG_PASSWORD_FILE: "/root/.config/slk/victorialogs-password",
};

test("host logging pins the reviewed Vector release and binary", () => {
  for (const value of ["vector 0.61.0 (linux)", "vector 0.62.01 (linux)", "unknown"])
    assert.throws(() => assertVectorBuild(value));
  assert.doesNotThrow(() => assertVectorBuild("vector 0.62.0 (x86_64-unknown-linux-gnu)"));
  assert.match(HOST_VECTOR_SHA256, /^[a-f0-9]{64}$/);
});

test("logging rejects insecure URLs, embedded credentials and configuration/template injection", () => {
  for (const endpoint of [
    "http://logs.example.org/insert/jsonline",
    "https://user:password@logs.example.org/insert/jsonline",
    "https://logs.example.org/insert/jsonline?debug=1",
    "https://logs.example.org/insert/jsonline#secret",
    "https://logs.example.org/loki/api/v1/push",
    "https://logs.example.org/insert/jsonline\n",
    "https://{{host}}/insert/jsonline",
  ])
    assert.throws(() => loggingSettings({ ...fields, SLK_LOG_ENDPOINT: endpoint }));
  for (const key of ["SLK_LOG_HOST", "SLK_LOG_USERNAME", "SLK_LOG_ENVIRONMENT", "SLK_LOG_PASSWORD_FILE"])
    assert.throws(() => loggingSettings({ ...fields, [key]: 'bad\"\nExecStart=/bin/false' }));
  assert.throws(() => loggingSettings({ ...fields, SLK_LOG_ENVIRONMENT: "prodution" }));
});

test("optional host manifest protects credentials, buffers logs and verifies installed files", () => {
  const settings = hostSettings(
    {
      SLK_HOST_APP_CONFIG: "/home/deploy/.config/slk/production.env",
      SLK_HOST_BACKUP_CONFIG: "/root/.config/slk/backup.env",
      SLK_HOST_BACKUP_HOST: "production-1",
      SLK_HOST_BACKUP_TAG: "slk",
    },
    { user: "deploy", uid: 1000, gid: 1000, home: "/home/deploy" },
    {
      SLK_PODMAN_PROJECT: "slk-production",
      SLK_DEPLOYMENT_TARGET: "production",
    },
  );
  assert.equal(settings.loggingConfig, null);
  assert.equal(
    hostArtifacts(root, settings, "/root/.config/slk/host.env", 999).some((f) => f.path.includes("vector")),
    false,
  );
  const logging = loggingSettings(fields);
  const files = hostArtifacts(root, settings, "/root/.config/slk/host.env", 999, { settings: logging, gid: 998 });
  const get = (path: string) => files.find((f) => f.path === path)!;
  const file = get("/etc/slk/vector/vector.yaml");
  assert.equal(file.uid, 0);
  assert.equal(file.gid, 998);
  assert.equal(file.mode, 0o640);
  assert.doesNotMatch(file.bytes.toString(), /__SLK_|\/root\/|dangerously_allow/);
  const configuration = parse(file.bytes.toString());
  assert.equal(configuration.secret.systemd.type, "directory");
  assert.equal(configuration.sinks.monitoring.auth.password, "SECRET[systemd.victorialogs-password]");
  assert.equal(configuration.sources.journal.current_boot_only, false);
  assert.equal(configuration.sinks.monitoring.acknowledgements.enabled, true);
  assert.deepEqual(configuration.sinks.monitoring.buffer, { type: "disk", max_size: 1073741824, when_full: "block" });
  assert.equal(configuration.api.enabled, false);
  assert.equal(configuration.sinks.metrics.address, "127.0.0.1:9598");
  const unit = get("/etc/systemd/system/slk-vector.service").bytes.toString();
  assert.match(unit, /LoadCredential=victorialogs-password:\/root\/\.config\/slk\/victorialogs-password/);
  assert.match(unit, /BindReadOnlyPaths=%d:\/run\/slk-vector\/credentials/);
  assert.match(unit, /User=slk-vector/);
  assert.match(unit, /SupplementaryGroups=systemd-journal/);
  assert.doesNotMatch(unit, /dangerously-allow|docker.sock|podman.sock|EnvironmentFile/);
  assert.match(get("/etc/systemd/journald.conf.d/60-slk-logging.conf").bytes.toString(), /Storage=persistent/);
  for (const path of [
    "/etc/systemd/system/caddy.service",
    "/etc/systemd/system/staedtechallenge-backup.service",
    "/home/deploy/.config/systemd/user/slk.service",
  ])
    assert.match(get(path).bytes.toString(), /StandardOutput=journal\nStandardError=journal/);
  assert.doesNotMatch(get("/etc/slk/vector/normalize.vrl").bytes.toString(), /__SLK_/);
  assert.throws(() => hostLoggingArtifacts(root, "--all", logging, 998));
});

test("existing container output is already routed to the host journal", () => {
  assert.match(readFileSync(resolve(root, "podman-compose.yaml"), "utf8"), /driver: journald/);
});

test("additional container routes require exact names and bounded literal project/service labels", () => {
  assert.deepEqual(loggingSettings(fields).containerRoutes, {});
  const routes = {
    campaignmanager_server_1: { project: "campaignmanager", service: "server" },
  };
  const settings = loggingSettings({ ...fields, SLK_LOG_CONTAINER_ROUTES: JSON.stringify(routes) });
  assert.deepEqual(settings.containerRoutes, routes);
  const artifacts = hostLoggingArtifacts(root, "slk-production", settings, 998);
  const transform = artifacts[1]!.bytes.toString();
  assert.ok(transform.includes(`container_routes = ${JSON.stringify(routes)}`));
  assert.doesNotMatch(transform, /__SLK_/);
  for (const value of [
    "not-json",
    "null",
    "[]",
    '"routes"',
    '{"campaignmanager_*":{"project":"campaignmanager","service":"server"}}',
    '{"campaignmanager_server_1":null}',
    '{"campaignmanager_server_1":[]}',
    '{"campaignmanager_server_1":{"project":"campaignmanager"}}',
    '{"campaignmanager_server_1":{"project":"campaignmanager","service":"server","environment":"staging"}}',
    JSON.stringify({ campaignmanager_server_1: { project: "${SECRET}", service: "server" } }),
    JSON.stringify({ campaignmanager_server_1: { project: "campaignmanager", service: 'server"\n. = {}' } }),
    JSON.stringify({ campaignmanager_server_1: { project: 42, service: "server" } }),
    JSON.stringify({ campaignmanager_server_1: { project: "x".repeat(101), service: "server" } }),
    JSON.stringify(
      Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`container_${i}`, routes.campaignmanager_server_1])),
    ),
  ])
    assert.throws(() => loggingSettings({ ...fields, SLK_LOG_CONTAINER_ROUTES: value }));
});

test("encrypted backup scope includes opted-in private logging files and rejects exposed credentials", () => {
  assert.deepEqual(hostLoggingBackupPaths({ loggingConfig: null }), []);
  const directory = mkdtempSync(resolve(tmpdir(), "slk-log-backup-"));
  const config = resolve(directory, "logging.env");
  const password = resolve(directory, "credential");
  try {
    writeFileSync(config, `SLK_LOG_PASSWORD_FILE=${password}\n`, { mode: 0o600 });
    writeFileSync(password, "private-fixture-credential", { mode: 0o600 });
    assert.deepEqual(hostLoggingBackupPaths({ loggingConfig: config }, process.getuid!()), [config, password]);
    chmodSync(password, 0o644);
    assert.throws(() => hostLoggingBackupPaths({ loggingConfig: config }, process.getuid!()));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
