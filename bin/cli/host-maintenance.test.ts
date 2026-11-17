import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { backupAndRetain, dumpHostDatabases, type BackupCommand } from "./host-backup.ts";
import { hostPath, hostSettings, privateHostEnvironment } from "./host-configuration.ts";
import { HOST_NODE, hostArtifacts, verifyHostArtifact } from "./host-maintenance.ts";

const fields = {
  SLK_HOST_APP_CONFIG: "/home/deploy/.config/slk/future.env",
  SLK_HOST_BACKUP_CONFIG: "/root/.config/staedtechallenge-backup.env",
  SLK_HOST_BACKUP_HOST: "slk-prod",
  SLK_HOST_BACKUP_TAG: "staedtechallenge",
};
const account = { user: "deploy", uid: 1000, gid: 1000, home: "/home/deploy" };
const app = { SLK_PODMAN_PROJECT: "slk-podman-future", SLK_DEPLOYMENT_TARGET: "production" };
const settings = hostSettings(fields, account, app);

test("host settings refuse implicit targets, privileged accounts and executable dotenv/systemd paths", () => {
  for (const value of ["relative", "/root/../etc/config", "/root/%h.env", "/root/a\nExecStart=bad", "/root/$(id)"])
    assert.throws(() => hostPath(value));
  assert.throws(() => hostSettings(fields, account, { ...app, SLK_DEPLOYMENT_TARGET: "future" }));
  assert.throws(() => hostSettings(fields, { ...account, uid: 0 }, app));
  assert.throws(() => hostSettings(fields, account, { ...app, SLK_PODMAN_PROJECT: "--all" }));
  assert.throws(() => hostSettings(fields, account, { ...app, SLK_PODMAN_CMS_PORT: "80" }));
  assert.throws(() => hostSettings({ ...fields, SLK_HOST_BACKUP_TAG: "" }, account, app));
});

test("private dotenv is data and refuses exposed/symlink files; verification detects content and mode drift", () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-host-"));
  try {
    const path = join(directory, "host.env");
    const bytes = Buffer.from('KEY="$(touch /tmp/not-executed)"\n');
    writeFileSync(path, bytes, { mode: 0o600 });
    const owner = process.getuid!();
    assert.equal(privateHostEnvironment(path, owner).KEY, "$(touch /tmp/not-executed)");
    const file = { path, bytes, mode: 0o600, uid: owner, gid: process.getgid!() };
    assert.equal(verifyHostArtifact(file), true);
    chmodSync(path, 0o644);
    assert.throws(() => privateHostEnvironment(path, owner));
    assert.equal(verifyHostArtifact(file), false);
    chmodSync(path, 0o600);
    writeFileSync(path, "changed");
    assert.equal(verifyHostArtifact(file), false);
    unlinkSync(path);
    symlinkSync("missing", path);
    assert.throws(() => privateHostEnvironment(path, owner));
    assert.equal(verifyHostArtifact(file), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("host plan includes all executable dependencies, pinned runtime and current production entrypoint", () => {
  const root = resolve(import.meta.dirname, "../..");
  assert.equal(HOST_NODE.version, readFileSync(join(root, ".node-version"), "utf8").trim());
  const files = hostArtifacts(root, settings, "/root/.config/slk/host.env", 999);
  const text = (path: string) => files.find((file) => file.path === path)!.bytes.toString();
  const unit = text("/home/deploy/.config/systemd/user/slk.service");
  assert.match(unit, /Environment=PATH=\/usr\/local\/lib\/slk:/);
  assert.match(unit, /EnvironmentFile=\/home\/deploy\/\.config\/slk\/future.env/);
  assert.match(unit, /start slk-podman-future_db_1 slk-podman-future_cache_1/);
  assert.doesNotMatch(unit, /stack start/); // Existing native-secret data services must remain intact.
  const backup = text("/etc/systemd/system/staedtechallenge-backup.service");
  assert.match(
    backup,
    /\/usr\/local\/lib\/slk\/node \/usr\/local\/lib\/slk\/host-backup.ts \/root\/\.config\/slk\/host.env/,
  );
  assert.doesNotMatch(backup, /\/home\/deploy|\/usr\/local\/sbin/);
  for (const name of [
    "host-backup.ts",
    "host-configuration.ts",
    "cloud-retention.ts",
    "release-retention.ts",
    "image-retention.ts",
  ])
    assert.ok(text(`/usr/local/lib/slk/${name}`).length > 100);
  assert.equal(text("/etc/caddy/Caddyfile"), readFileSync(join(root, "caddy/Caddyfile.production"), "utf8"));
  assert.match(text("/etc/systemd/system/staedtechallenge-backup.timer"), /03:30:00 Europe\/Berlin/);
});

test("cloud backup streams paths directly and completes scoped remote retention/check before any local cleanup", () => {
  const commands: string[][] = [];
  const run: BackupCommand = (tool, args) => {
    commands.push([tool, ...args]);
    return "";
  };
  backupAndRetain(settings, ["/db-dumps", "/uploads"], run, true);
  assert.deepEqual(commands[1], [
    "restic",
    "backup",
    "--tag",
    "staedtechallenge",
    "--host",
    "slk-prod",
    "--exclude-caches",
    "/db-dumps",
    "/uploads",
  ]);
  assert.ok(
    commands[2]!.includes("cloud-retention.ts") || commands[2]!.some((arg) => arg.endsWith("/cloud-retention.ts")),
  );
  assert.deepEqual(commands[3], ["restic", "check", "--read-data-subset=10%"]);
  assert.equal(commands[4]![0], "runuser");
  assert.ok(commands[4]!.includes("HOME=/home/deploy"));
  assert.ok(commands[5]!.includes("slk-podman-future"));
  assert.equal(commands.length, 6);
});

for (const failedStep of [0, 1, 2, 3])
  test(`remote backup failure at step ${failedStep} prevents all local cleanup`, () => {
    let calls = 0;
    const commands: string[] = [];
    assert.throws(() =>
      backupAndRetain(
        settings,
        ["/uploads"],
        (tool) => {
          commands.push(tool);
          if (calls++ === failedStep) throw new Error("Remote operation failed");
          return "";
        },
        true,
      ),
    );
    assert.ok(!commands.includes("runuser"));
  });

test("dump validation preserves the previous recoverable archive on corruption and rejects unsafe database names", () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-host-dumps-"));
  try {
    const previous = join(directory, "directus.pgdump");
    writeFileSync(previous, "previous validated backup");
    const fake: BackupCommand = (_tool, args, options) => {
      if (options?.output) writeFileSync(options.output, "new archive");
      if (args.includes("pg_restore")) throw new Error("Corrupt archive");
      return args.some((arg) => arg.includes("SELECT datname")) ? "directus\n" : "";
    };
    assert.throws(() => dumpHostDatabases(directory, "project_db_1", fake), /Corrupt/);
    assert.equal(readFileSync(previous, "utf8"), "previous validated backup");
    assert.ok(existsSync(`${previous}.partial`));
    assert.throws(
      () =>
        dumpHostDatabases(directory, "project_db_1", (tool, args, options) => {
          if (args.some((arg) => arg.includes("SELECT datname"))) return "unsafe;name\n";
          return fake(tool, args, options);
        }),
      /safe database names/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
