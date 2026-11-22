import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileDigest, releasePayloads, verifyCheckpoint } from "./release-checkpoint.ts";
import { commandDigest, releaseBackupUnit, verifyRemoteCheckpoint } from "./release-cloud.ts";
import {
  releaseUpdateConfig,
  assertReleaseResources,
  releaseUpdateServiceArguments,
  prepareReleaseRuntimes,
  releasePublicOrigin,
  checkReleaseRead,
  resolveReleaseMain,
  restoreReleaseDatabase,
  updateProductionRelease,
  type UpdateCommand,
} from "./release-update.ts";
import { run } from "./process.ts";

const counts = { municipalities: 138, elections: 6, content_translation_memory: 13960 };
function directory(t: TestContext) {
  const path = mkdtempSync(join(tmpdir(), "slk-release-update-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function checkpoint(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const lines = releasePayloads.map((name) => {
    const bytes = name === "database.before.json" ? JSON.stringify(counts) : `backup ${name}\n`;
    writeFileSync(join(path, name), bytes, { mode: 0o600 });
    return `${createHash("sha256").update(bytes).digest("hex")}  ${name}`;
  });
  writeFileSync(join(path, "backups.sha256"), lines.join("\n") + "\n", { mode: 0o600 });
}

test("automatic updates select one private production/legacy config and refuse ambiguity", (t) => {
  const home = directory(t);
  assert.throws(() => releaseUpdateConfig(home), /Select one/);
  const config = join(home, ".config/slk");
  mkdirSync(config, { recursive: true });
  writeFileSync(join(config, "future.env"), "private");
  assert.equal(releaseUpdateConfig(home), join(config, "future.env"));
  writeFileSync(join(config, "production.env"), "private");
  assert.throws(() => releaseUpdateConfig(home), /Select one/);
  assert.equal(releaseUpdateConfig(home, join(config, "production.env")), join(config, "production.env"));
});

test("low-memory production builds require real RAM/swap and disk headroom before starting", () => {
  assert.doesNotThrow(() => assertReleaseResources("MemAvailable: 2200000 kB\nSwapFree: 7500000 kB", 10 * 1024 ** 3));
  assert.throws(
    () => assertReleaseResources("MemAvailable: 2200000 kB\nSwapFree: 0 kB", 10 * 1024 ** 3),
    /RAM plus swap/,
  );
  assert.throws(() => assertReleaseResources("MemAvailable: 100000 kB\nSwapFree: 7500000 kB", 10 * 1024 ** 3), /RAM/);
  assert.throws(() => assertReleaseResources("MemAvailable: 6000000 kB\nSwapFree: 0 kB", 1024 ** 3), /8 GiB/);
});

test("release health checks reject maintenance HTML, empty catalogs and credential-bearing public origins", (t) => {
  const base = directory(t),
    env = join(base, "frontend.env");
  writeFileSync(env, "PUBLIC_URL=https://website.test/\n", { mode: 0o600 });
  assert.equal(releasePublicOrigin(base, { SLK_PODMAN_FRONTEND_ENV_FILE: env }), "https://website.test");
  for (const url of [
    "http://website.test",
    "https://user:private-canary@website.test",
    "https://website.test/?token=private-canary",
  ]) {
    writeFileSync(env, `PUBLIC_URL=${url}\n`);
    assert.throws(
      () => releasePublicOrigin(base, { SLK_PODMAN_FRONTEND_ENV_FILE: env }),
      (error: unknown) => error instanceof Error && !error.message.includes("private-canary"),
    );
  }
  assert.throws(() => checkReleaseRead("/api/public/site-layout", "<html>Maintenance</html>"), /non-JSON/);
  assert.throws(
    () => checkReleaseRead("/api/public/site-layout", JSON.stringify({ pages: [], municipalities: [] })),
    /missing/,
  );
  assert.throws(() => checkReleaseRead("/api/public/catalogs", "[]"), /missing/);
  assert.doesNotThrow(() => checkReleaseRead("/api/public/wahlcheck", "[]"));
});

test("release backup service arguments cannot select arbitrary units or shell commands", () => {
  assert.equal(releaseBackupUnit("release-12345678"), "slk-release-backup.service");
  for (const tag of ["../etc/passwd", "release-1234", "release-abcdef12.service ssh.service", "release-$(id)"])
    assert.throws(() => releaseBackupUnit(tag));
});

test("the updater survives SSH disconnects without killing application monitors or exporting credentials", () => {
  const args = releaseUpdateServiceArguments(
    "fixture",
    "app",
    "/run/user/1000/app.lock",
    "/private/host.env",
    { PATH: "/usr/bin", PRIVATE_SECRET: "private-canary" },
    true,
  );
  assert(args.includes("--property=KillMode=process"));
  assert(args.includes("--wait") && args.includes("--collect"));
  assert(!args.includes("--pipe"));
  assert(args.includes("--close"));
  assert(args.includes("aa-exec") && args.includes("slk-rootless"));
  assert(!args.join(" ").includes("private-canary"));
});

test(
  "cloud verification reads back every exact payload and refuses tampering, incomplete manifests and links",
  { skip: process.platform === "win32" },
  async (t) => {
    const path = join(directory(t), "checkpoint");
    checkpoint(path);
    const owner = process.getuid!();
    const read: string[] = [];
    const digest = await verifyRemoteCheckpoint(path, owner, "a".repeat(64), async (file) => {
      read.push(file);
      return fileDigest(file);
    });
    assert.equal(read.length, releasePayloads.length + 1);
    assert.equal(digest, await fileDigest(join(path, "backups.sha256")));
    await assert.rejects(
      verifyRemoteCheckpoint(path, owner, "a".repeat(64), async () => "0".repeat(64)),
      /Off-host/,
    );
    writeFileSync(join(path, "database.before.dump"), "tampered");
    await assert.rejects(verifyCheckpoint(path, owner), /checksum/);
    checkpoint(path);
    writeFileSync(join(path, "backups.sha256"), "0".repeat(64) + "  ../../outside\n");
    await assert.rejects(verifyCheckpoint(path, owner), /manifest/);
    checkpoint(path);
    rmSync(join(path, "database.before.dump"));
    symlinkSync(join(path, "source.before.tar.gz"), join(path, "database.before.dump"));
    await assert.rejects(verifyCheckpoint(path, owner), /private regular/);
    rmSync(join(path, "database.before.dump"));
    checkpoint(path);
    chmodSync(join(path, "database.before.dump"), 0o644);
    await assert.rejects(verifyCheckpoint(path, owner), /private regular/);
  },
);

test("remote digest verification streams binary data and rejects a failed downloader", async () => {
  const bytes = Buffer.alloc(1024 * 1024, 0xff);
  assert.equal(
    await commandDigest(process.execPath, ["-e", "process.stdout.write(Buffer.alloc(1024*1024,255))"], process.env),
    createHash("sha256").update(bytes).digest("hex"),
  );
  await assert.rejects(
    commandDigest(process.execPath, ["-e", "process.stdout.write('partial');process.exit(7)"], process.env),
    /verification failed/,
  );
});

test("restore verification uses only a random temporary database and always cleans it up", async (t) => {
  const path = directory(t);
  checkpoint(path);
  for (const failure of ["", "restore", "counts"]) {
    const calls: string[][] = [];
    const execute: UpdateCommand = async (_program, args) => {
      calls.push(args);
      if (failure === "restore" && args.some((s) => s.includes("exec pg_restore"))) throw new Error("restore failed");
      return args.includes("slk-query")
        ? JSON.stringify(failure === "counts" ? { ...counts, content_translation_memory: 0 } : counts)
        : "";
    };
    const result = restoreReleaseDatabase(path, "c".repeat(64), execute);
    if (failure) await assert.rejects(result);
    else await result;
    const created = calls.find((args) => args.some((s) => s.includes("exec createdb")))!.at(-1)!;
    assert.match(created, /^slk_release_verify_[a-f0-9]{32}$/);
    assert.equal(calls.at(-1)!.at(-1), created);
    assert.ok(calls.at(-1)!.some((s) => s.includes("dropdb") && s.includes("--force")));
    assert.ok(
      calls
        .find((args) => args.some((s) => s.includes("exec pg_restore")))!
        .some((s) => s.includes("--no-owner --no-privileges --exit-on-error")),
    );
  }
});

function repository(t: TestContext, preserve = true) {
  const base = directory(t),
    repo = join(base, "repository"),
    remote = join(base, "origin.git");
  mkdirSync(repo);
  mkdirSync(join(base, "hooks"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Release Test");
  git("config", "user.email", "release@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", join(base, "hooks"));
  const commit = (message: string) => {
    git("add", ".");
    git("commit", "--quiet", "-m", message);
    return git("rev-parse", "HEAD");
  };
  writeFileSync(join(repo, "base.txt"), "baseline");
  writeFileSync(join(repo, ".node-version"), process.versions.node + "\n");
  for (const folder of ["podman/environment", "podman/directus", "podman/frontend", "podman/maintenance", "caddy"]) {
    mkdirSync(join(repo, folder), { recursive: true });
    writeFileSync(
      join(repo, folder, "Containerfile"),
      folder === "podman/maintenance" ? "FROM localhost/slk-caddy:2.11.9\n" : "FROM runtime\n",
    );
  }
  const initial = commit("Baseline");
  git("switch", "--quiet", "-c", "deployed");
  writeFileSync(join(repo, "mail-fix.txt"), "production fixes");
  const active = commit("Production fixes");
  git("switch", "--quiet", "main");
  if (preserve) {
    git("merge", "--squash", "deployed");
    commit("Squashed production fixes");
  }
  writeFileSync(join(repo, "new-feature.txt"), "main update");
  const target = commit("Latest main");
  execFileSync("git", ["init", "--bare", "--quiet", remote]);
  git("remote", "add", "origin", remote);
  git("push", "--quiet", "origin", "main");
  git("switch", "--quiet", "--detach", active);
  return { base, repo, remote, git, commit, initial, active, target };
}

test("main resolution accepts squashed updates, rejects stale main and refuses dirty worktrees", async (t) => {
  const f = repository(t);
  const execute: UpdateCommand = (tool, args, options) => run(tool, args, { ...options, cwd: f.repo, capture: true });
  assert.equal(await resolveReleaseMain(f.repo, f.active, execute), f.target);
  assert.equal(
    f.git("rev-parse", "HEAD"),
    f.active,
    "Fetch/preflight must not switch the live source before its checkpoint",
  );
  writeFileSync(join(f.repo, "uncommitted.txt"), "preserve this");
  await assert.rejects(resolveReleaseMain(f.repo, f.active, execute), /working-tree/);
  const missing = repository(t, false);
  missing.git("push", "--force", "origin", `${missing.initial}:main`);
  await assert.rejects(
    resolveReleaseMain(missing.repo, missing.active, (tool, args, options) =>
      run(tool, args, { ...options, cwd: missing.repo, capture: true }),
    ),
    /behind the deployed/,
  );
});

test("unchanged runtime inputs skip rebuilding; shared runtime changes invalidate their dependants", async (t) => {
  const f = repository(t),
    labels = new Map<string, string>();
  let builds = 0;
  const execute: UpdateCommand = async (tool, args, options) => {
    if (tool === "git") return run(tool, args, { ...options, cwd: f.repo, capture: true });
    if (args.includes("inspect")) return labels.get(args[args.indexOf("inspect") + 1]!) ?? "";
    if (args.includes("build")) {
      builds++;
      labels.set(args[args.indexOf("-t") + 1]!, args[args.indexOf("--label") + 1]!.split("=")[1]!);
    }
    return "";
  };
  await prepareReleaseRuntimes(f.repo, execute);
  assert.equal(builds, 4);
  await prepareReleaseRuntimes(f.repo, execute);
  assert.equal(builds, 4);
  writeFileSync(join(f.repo, "podman/environment/Containerfile"), "changed shared runtime");
  await prepareReleaseRuntimes(f.repo, execute);
  assert.equal(builds, 8);
});

test(
  "automatic release checks out main only after verified cloud backup and restore, rolls back failed reads, and preserves datastores",
  { skip: process.platform === "win32" },
  async (t) => {
    for (const failure of ["", "cloud", "stage", "health", "maintenance"]) {
      const f = repository(t),
        home = join(f.base, "home");
      mkdirSync(home);
      writeFileSync(join(home, "frontend.env"), "PUBLIC_URL=https://website.test\nPRIVATE_SECRET=private-canary\n", {
        mode: 0o600,
      });
      const previous = `release-${f.active.slice(0, 8)}`,
        tag = `release-${f.target.slice(0, 12)}`,
        state = join(home, ".local/state/slk-releases", tag);
      const calls: { tool: string; args: string[] }[] = [];
      let activated = false;
      const execute: UpdateCommand = async (tool, args, options) => {
        calls.push({ tool, args });
        if (tool === "git") return run(tool, args, { ...options, cwd: f.repo, capture: true });
        if (tool === "systemctl") return "loaded";
        if (tool === process.execPath) {
          const action = args[2];
          if (action === "backup") checkpoint(state);
          if (action === "stage" && failure === "stage") throw new Error("stage failed");
          if (action === "activate") activated = true;
          if (action === "rollback") activated = false;
        }
        if (tool === "sudo" && args[1] !== "-l") {
          if (failure === "cloud") throw new Error("cloud failed");
          writeFileSync(
            join(state, "backup.offhost.json"),
            JSON.stringify({
              tag,
              snapshot: "a".repeat(64),
              manifest: await fileDigest(join(state, "backups.sha256")),
            }),
            { mode: 0o600 },
          );
        }
        if (tool === "podman") {
          if (args[1] === "inspect") return activated ? f.target : f.active;
          if (args[1] === "ps") return "c".repeat(64);
          if (args.includes("slk-query")) return JSON.stringify(counts);
        }
        if (tool === "curl" && failure === "health") throw new Error("health failed");
        if (tool === "curl")
          return failure === "maintenance"
            ? "<html>Maintenance</html>"
            : args.at(-1)?.endsWith("/site-layout")
              ? JSON.stringify({ pages: [{}], municipalities: [] })
              : "[{}]";
        return "";
      };
      const promise = updateProductionRelease(
        {
          repository: f.repo,
          home,
          config: join(home, "host.env"),
          environment: {
            SLK_PODMAN_PROJECT: "fixture",
            SLK_DEPLOYMENT_TARGET: "production",
            SLK_PODMAN_TAG: previous,
            SLK_PODMAN_FRONTEND_ENV_FILE: join(home, "frontend.env"),
          },
        },
        execute,
      );
      if (failure) await assert.rejects(promise);
      else await promise;
      const actions = calls.filter((c) => c.tool === process.execPath).map((c) => c.args[2]);
      assert.deepEqual(
        actions,
        failure === "cloud"
          ? ["backup"]
          : failure === "stage"
            ? ["backup", "stage"]
            : failure === "health" || failure === "maintenance"
              ? ["backup", "stage", "activate", "rollback"]
              : ["backup", "stage", "activate"],
      );
      assert.equal(existsSync(join(state, "backup.verified")), failure !== "cloud");
      assert.equal(existsSync(join(state, "update.ok")), !failure);
      if (failure !== "cloud") {
        assert.equal(f.git("branch", "--show-current"), "main");
        assert.equal(f.git("rev-parse", "HEAD"), f.target);
        const cloud = calls.findIndex((c) => c.tool === "sudo" && c.args[1] !== "-l");
        const switched = calls.findIndex((c) => c.tool === "git" && c.args[0] === "switch");
        assert(cloud < switched);
      }
      assert.equal(activated, !failure);
      assert.equal(
        calls.some((c) => c.args.includes("stop") || c.args.includes("restart")),
        false,
      );
      assert.equal(
        calls.some((c) => c.tool === "podman" && c.args.includes("podman/database/Containerfile")),
        false,
      );
    }
  },
);
