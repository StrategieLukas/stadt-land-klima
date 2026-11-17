/** Optional real-binary integration; never reads the host journal. */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import { createServer as tcpServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { gunzipSync } from "node:zlib";
import { parse, stringify } from "yaml";
import { hostLoggingArtifacts, loggingSettings } from "./host-logging.ts";

async function freePort() {
  const server = tcpServer();
  await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  await new Promise<void>((accept, reject) => server.close((error) => (error ? reject(error) : accept())));
  return address.port;
}

test(
  "Vector forwards filtered records over authenticated TLS to VictoriaLogs and recovers its disk buffer after SIGKILL",
  {
    skip: !process.env.SLK_TEST_VECTOR_BINARY || !process.env.SLK_TEST_VICTORIALOGS_BINARY,
    timeout: 45_000,
  },
  async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "slk-vector-"));
    const processes: ChildProcessWithoutNullStreams[] = [];
    const outputs: string[] = [];
    const start = (binary: string, args: string[]) => {
      const child = spawn(binary, args);
      const slot = outputs.push("") - 1;
      child.stdout.on("data", (b: Buffer) => {
        outputs[slot] += b.toString();
      });
      child.stderr.on("data", (b: Buffer) => {
        outputs[slot] += b.toString();
      });
      processes.push(child);
      return child;
    };
    const stop = async (child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals = "SIGTERM") => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = new Promise<void>((accept) => child.once("exit", () => accept()));
      child.kill(signal);
      await exited;
    };
    const poll = async (predicate: () => Promise<boolean>, message: string) => {
      for (let i = 0; i < 150; i++) {
        try {
          if (await predicate()) return;
        } catch {
          /* Waiting for isolated fixtures. */
        }
        await delay(100);
      }
      assert.fail(message + "\n" + outputs.join("\n"));
    };
    const port = await freePort();
    const password = 'fixture-only-$()"-credential-value-123456789';
    const authorization = "Basic " + Buffer.from("slk-test:" + password).toString("base64");
    let unavailable = true;
    let retries = 0;
    const delivered: Record<string, unknown>[] = [];
    const cert = spawnSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=IP:127.0.0.1,DNS:localhost",
        "-days",
        "1",
        "-keyout",
        `${directory}/key.pem`,
        "-out",
        `${directory}/cert.pem`,
      ],
      { encoding: "utf8" },
    );
    assert.equal(cert.status, 0, cert.stderr);
    const gateway = createServer(
      { key: readFileSync(`${directory}/key.pem`), cert: readFileSync(`${directory}/cert.pem`) },
      (request, response) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () => {
          void (async () => {
            if (request.headers.authorization !== authorization) {
              response.writeHead(401).end();
              return;
            }
            if (unavailable) {
              retries++;
              response.writeHead(503).end();
              return;
            }
            const compressed = Buffer.concat(chunks);
            const body = request.headers["content-encoding"] === "gzip" ? gunzipSync(compressed) : compressed;
            const result = await fetch(`http://127.0.0.1:${port}/insert/jsonline`, {
              method: "POST",
              body: body.toString(),
              headers: {
                "Content-Type": "application/stream+json",
                "VL-Msg-Field": "message",
                "VL-Time-Field": "timestamp",
                "VL-Stream-Fields": "project,environment,host,service_name",
              },
            });
            if (result.ok)
              delivered.push(
                ...body
                  .toString()
                  .trim()
                  .split("\n")
                  .map((line) => JSON.parse(line) as Record<string, unknown>),
              );
            response.writeHead(result.status).end(await result.text());
          })().catch(() => response.writeHead(500).end());
        });
      },
    );
    try {
      start(process.env.SLK_TEST_VICTORIALOGS_BINARY!, [
        `-httpListenAddr=127.0.0.1:${port}`,
        `-storageDataPath=${directory}/storage`,
        "-retentionPeriod=30d",
        "-memory.allowedBytes=64MiB",
      ]);
      await poll(async () => (await fetch(`http://127.0.0.1:${port}/health`)).ok, "VictoriaLogs must start");
      await new Promise<void>((accept) => gateway.listen(0, "127.0.0.1", accept));
      const address = gateway.address();
      assert.ok(address && typeof address === "object");
      const artifacts = hostLoggingArtifacts(
        resolve(import.meta.dirname, "../.."),
        "slk-production",
        loggingSettings({
          SLK_LOG_ENDPOINT: `https://127.0.0.1:${address.port}/insert/jsonline`,
          SLK_LOG_HOST: "test-host",
          SLK_LOG_ENVIRONMENT: "development",
          SLK_LOG_USERNAME: "slk-test",
          SLK_LOG_PASSWORD_FILE: "/root/.config/slk/victorialogs-password",
        }),
        1000,
      );
      writeFileSync(`${directory}/normalize.vrl`, artifacts[1]!.bytes);
      const configuration = parse(artifacts[0]!.bytes.toString());
      configuration.data_dir = `${directory}/vector-state`;
      configuration.secret.systemd.path = directory;
      configuration.sources = { journal: { type: "stdin", decoding: { codec: "json" } } };
      configuration.transforms.records.file = `${directory}/normalize.vrl`;
      delete configuration.sinks.metrics;
      configuration.sinks.monitoring.tls.ca_file = `${directory}/cert.pem`;
      configuration.sinks.monitoring.batch.timeout_secs = 0.1;
      writeFileSync(`${directory}/victorialogs-password`, password + "\n", { mode: 0o600 });
      const configPath = `${directory}/vector.yaml`;
      writeFileSync(configPath, stringify(configuration));
      const binary = process.env.SLK_TEST_VECTOR_BINARY!;
      const validation = spawnSync(
        binary,
        ["validate", "--no-environment", "--resolve-secrets", "--deny-warnings", configPath],
        { encoding: "utf8" },
      );
      assert.equal(validation.status, 0, validation.stdout + validation.stderr);
      const first = start(binary, ["--config", configPath, "--log-format", "json"]);
      const cases = [
        {
          service: "nuxt",
          container: "slk-production_frontend_1",
          message: '{"severity":"error","event":"nuxt.fixture","host":"forged"}',
          level: "error",
          source: "application",
        },
        {
          service: "directus",
          container: "slk-production_directus_2",
          message: '{"level":50,"event":"directus.fixture"}',
          level: "error",
          source: "application",
        },
        {
          service: "caddy",
          unit: "caddy.service",
          message: '{"level":"error","msg":"gateway.fixture"}',
          level: "error",
          source: "application",
        },
        {
          service: "postgresql",
          container: "slk-production_db_1",
          message: "ordinary postgres stderr",
          level: "warning",
          source: "journal",
        },
        {
          service: "redis",
          container: "slk-production-cache-3",
          message: "redis fixture",
          level: "warning",
          source: "journal",
        },
        {
          service: "slk-worker",
          unit: "slk-worker@private-instance.service",
          message: "worker fixture",
          level: "warning",
          source: "journal",
        },
        {
          service: "host",
          unit: "session-private.scope",
          message: '{"severity":"unbounded-value"}',
          level: "unknown",
          source: "unknown",
        },
      ];
      for (const value of cases)
        first.stdin.write(
          JSON.stringify({
            message: value.message,
            timestamp: new Date().toISOString(),
            CONTAINER_NAME: value.container ?? "",
            _SYSTEMD_UNIT: value.unit ?? "libpod-private-id.scope",
            PRIORITY: "4",
            _CMDLINE: "private-envelope-canary",
            _UID: "1000",
          }) + "\n",
        );
      await poll(async () => retries > 0, "Vector must retry during an outage");
      await delay(750); // Allow the documented disk-buffer synchronization interval.
      await stop(first, "SIGKILL");
      unavailable = false;
      const second = start(binary, ["--config", configPath, "--log-format", "json"]);
      await poll(async () => delivered.length >= cases.length, "Buffered records must survive SIGKILL");
      for (const value of cases) {
        const record = delivered.find((r) => r.message === value.message);
        assert.ok(record, value.message);
        assert.equal(record.service_name, value.service);
        assert.equal(record.level, value.level);
        assert.equal(record.level_source, value.source);
        assert.equal(record.host, "test-host");
      }
      assert.doesNotMatch(
        JSON.stringify(delivered),
        /private-envelope-canary|private-instance|libpod-private-id|_CMDLINE|_UID/,
      );
      await poll(async () => {
        const result = await fetch(`http://127.0.0.1:${port}/select/logsql/query`, {
          method: "POST",
          body: new URLSearchParams({ query: 'project:="stadt-land-klima"', limit: "100" }),
        });
        const text = await result.text();
        const found = text
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>);
        return cases.every((value) => found.some((record) => record._msg === value.message));
      }, "Records must be searchable in VictoriaLogs");
      assert.ok(!outputs.join("\n").includes(password), "Credential must not enter process logs");
      await stop(second);
    } finally {
      for (const child of processes) await stop(child, "SIGKILL");
      gateway.closeAllConnections();
      await new Promise<void>((accept) => gateway.close(() => accept()));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
