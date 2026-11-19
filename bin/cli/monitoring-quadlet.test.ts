import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "../..");
const source = resolve(root, "podman/logging/monitoring");
const configuredGenerator = process.env.SLK_TEST_QUADLET_GENERATOR;
const generator = configuredGenerator || "/usr/lib/systemd/system-generators/podman-system-generator";
const unit = readFileSync(resolve(source, "slk-victorialogs.container"), "utf8");
const image = /^Image=(.+)$/m.exec(unit)![1]!;

test("Quadlet backend is pinned, unprivileged, persistent and unpublished; clients use private DNS", () => {
  assert.match(image, /:v1\.54\.0@sha256:[a-f0-9]{64}$/);
  for (const expected of [
    "Network=slk-logs.network",
    "User=1000:1000",
    "ReadOnly=true",
    "NoNewPrivileges=true",
    "DropCapability=ALL",
    "PidsLimit=256",
    "MemoryMax=1G",
  ])
    assert.ok(unit.includes(expected), expected);
  assert.match(unit, /Volume=slk-victorialogs.volume:\/victoria-logs-data:U,nosuid,nodev,noexec/);
  assert.doesNotMatch(unit, /^PublishPort=|^AutoUpdate=|^UserNS=host|^SecurityLabelDisable=true/m);
  assert.match(readFileSync(resolve(source, "slk-logs.network"), "utf8"), /Internal=true/);
  const data = parse(readFileSync(resolve(source, "grafana-datasource.yaml"), "utf8"));
  assert.equal(data.datasources[0].url, "http://slk-victorialogs:9428");
  assert.match(readFileSync(resolve(source, "ingestion.caddy.example"), "utf8"), /reverse_proxy slk-victorialogs:9428/);
  assert.match(
    readFileSync(resolve(source, "loopback-publish.conf.example"), "utf8"),
    /^PublishPort=127\.0\.0\.1:9428:9428$/m,
  );
});

test(
  "real Quadlet generator resolves volume/network dependencies and preserves existing Grafana networking",
  {
    skip: process.platform !== "linux" || (!configuredGenerator && !existsSync(generator)),
  },
  () => {
    const directory = mkdtempSync(resolve(tmpdir(), "slk-quadlet-"));
    try {
      for (const name of ["slk-logs.network", "slk-victorialogs.volume", "slk-victorialogs.container"])
        cpSync(resolve(source, name), resolve(directory, name));
      writeFileSync(
        resolve(directory, "grafana.container"),
        "[Container]\nImage=example.invalid/test:fixture\nNetwork=existing-monitoring\nEnvironment=EXISTING_SETTING=keep\n",
      );
      mkdirSync(resolve(directory, "grafana.container.d"));
      cpSync(
        resolve(source, "network-client.conf.example"),
        resolve(directory, "grafana.container.d/50-slk-logs.conf"),
      );
      const output = execFileSync(generator, ["--user", "--dryrun"], {
        encoding: "utf8",
        env: { ...process.env, QUADLET_UNIT_DIRS: directory },
      });
      assert.match(output, /---slk-victorialogs\.service---/);
      assert.match(output, /Requires=slk-logs-network\.service/);
      assert.match(output, /Requires=slk-victorialogs-volume\.service/);
      assert.match(output, /network create --ignore --internal slk-logs/);
      const grafana = output.split("---grafana.service---")[1]?.split("---")[0];
      assert.ok(grafana);
      assert.match(grafana, /--network existing-monitoring/);
      assert.match(grafana, /--network slk-logs/);
      assert.match(grafana, /EXISTING_SETTING=keep/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  "pinned VictoriaLogs container serves private-network clients and retains records across recreation",
  {
    skip: process.env.SLK_TEST_LOGGING_QUADLET !== "1",
    timeout: 90_000,
  },
  () => {
    const name = "slk-logs-test-" + randomUUID();
    const network = name + "-net";
    const volume = name + "-data";
    const client = name + "-client";
    const podman = (...args: string[]) =>
      execFileSync("podman", args, { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
    let netCreated = false;
    let volumeCreated = false;
    const start = () =>
      podman(
        "run",
        "-d",
        "--name",
        name,
        "--network",
        network,
        "--network-alias",
        "slk-victorialogs",
        "--user",
        "1000:1000",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--memory=1g",
        "--pids-limit=256",
        "--volume",
        `${volume}:/victoria-logs-data:U,nosuid,nodev,noexec`,
        "--health-cmd",
        '["/victoria-logs-prod","-healthcheck","-httpListenAddr=127.0.0.1:9428"]',
        image,
        "-httpListenAddr=0.0.0.0:9428",
        "-storageDataPath=/victoria-logs-data",
        "-retentionPeriod=30d",
        "-memory.allowedBytes=64MiB",
      );
    const peer = (code: string) =>
      podman(
        "run",
        "--rm",
        "--name",
        client,
        "--network",
        network,
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--user",
        "1000:1000",
        "docker.io/library/node:24.22.3-trixie-slim",
        "node",
        "-e",
        code,
      );
    const waitCode =
      'await(async()=>{for(let n=0;n<100;n++){try{if((await fetch("http://slk-victorialogs:9428/health")).ok)return;}catch{} await new Promise(r=>setTimeout(r,100));}throw Error("private backend not ready")})()';
    try {
      podman("network", "create", "--internal", network);
      netCreated = true;
      podman("volume", "create", volume);
      volumeCreated = true;
      start();
      peer(
        `(async()=>{${waitCode};const r=await fetch("http://slk-victorialogs:9428/insert/jsonline",{method:"POST",headers:{"VL-Msg-Field":"message"},body:JSON.stringify({message:"quadlet-volume-canary"})+"\\n"});if(!r.ok)throw Error(await r.text());})().catch(e=>{console.error(e);process.exit(1)})`,
      );
      podman("healthcheck", "run", name);
      assert.equal(podman("port", name), "");
      podman("stop", "--time", "60", name);
      podman("rm", name);
      start();
      peer(
        `(async()=>{${waitCode};const r=await fetch("http://slk-victorialogs:9428/select/logsql/query",{method:"POST",body:new URLSearchParams({query:'"quadlet-volume-canary"'})});const text=await r.text();if(!r.ok||!text.includes("quadlet-volume-canary"))throw Error("persisted canary missing");})().catch(e=>{console.error(e);process.exit(1)})`,
      );
    } finally {
      podman("rm", "--force", "--ignore", client, name);
      if (volumeCreated) podman("volume", "rm", volume);
      if (netCreated) podman("network", "rm", network);
    }
  },
);
