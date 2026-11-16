import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { releaseRetentionPlan, retainReleaseBackups } from "./release-retention.ts";
import { cloudRetentionArguments } from "./cloud-retention.ts";

const linuxOnly = { skip: process.platform !== "linux" || process.getuid?.() === 0 };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "slk-retention-"));
  const files = [
    "database.before.dump",
    "uploads.before.tar",
    "frontend-output.before.tar",
    "source.before.tar.gz",
    "config.before.tar.gz",
  ];
  for (let i = 1; i <= 7; i++) {
    const directory = join(root, `release-${String(i).padStart(8, "0")}`);
    mkdirSync(directory);
    const manifest = files.map((name) => {
      writeFileSync(join(directory, name), `fixture-${i}-${name}`);
      return createHash("sha256").update(`fixture-${i}-${name}`).digest("hex") + "  " + name;
    });
    writeFileSync(join(directory, "backups.sha256"), manifest.join("\n") + "\n");
    utimesSync(join(directory, "backups.sha256"), i, i);
    writeFileSync(join(directory, "backup.verified"), "verified");
    writeFileSync(join(directory, "operator-notes.txt"), "preserve");
  }
  return root;
}

test(
  "retention keeps five by capture time, verifies survivors, invalidates approval and deletes only known payloads",
  linuxOnly,
  async (t) => {
    const root = fixture();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const old = join(root, "release-00000001");
    utimesSync(old, 99999, 99999); // A later staging attempt must not change capture order.
    const dry = await retainReleaseBackups(root);
    assert.equal(dry.keep.length, 5);
    assert.equal(dry.expire.length, 2);
    assert.ok(existsSync(join(old, "uploads.before.tar")));
    const result = await retainReleaseBackups(root, true);
    assert.deepEqual(result.busy, []);
    assert.ok(!existsSync(join(old, "uploads.before.tar")));
    assert.ok(!existsSync(join(old, "backup.verified")));
    assert.equal(readFileSync(join(old, "operator-notes.txt"), "utf8"), "preserve");
    assert.equal((await releaseRetentionPlan(root)).keep.length, 5);
    assert.equal((await retainReleaseBackups(root, true)).expire.length, 0);
  },
);

test(
  "a damaged retained backup blocks every deletion; unrecognised and symlink payloads are preserved",
  linuxOnly,
  async (t) => {
    const root = fixture();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const old = join(root, "release-00000001");
    writeFileSync(join(root, "release-00000007/uploads.before.tar"), "corrupt");
    await assert.rejects(retainReleaseBackups(root, true), /checksum mismatch/);
    assert.ok(existsSync(join(old, "backup.verified")));
    const outside = join(root, "outside");
    writeFileSync(outside, "outside");
    rmSync(join(old, "uploads.before.tar"));
    symlinkSync(outside, join(old, "uploads.before.tar"));
    const plan = await releaseRetentionPlan(root);
    assert.ok(plan.skipped.includes("release-00000001"));
    assert.equal(readFileSync(outside, "utf8"), "outside");
    symlinkSync(old, join(root, "release-00000008"));
    await assert.rejects(releaseRetentionPlan(root), /Unsafe release checkpoint/);
  },
);

test("an active release lock prevents checkpoint deletion", linuxOnly, async (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const old = join(root, "release-00000001");
  const holder = spawn(
    "flock",
    ["--no-fork", join(old, "release.lock"), process.execPath, "-e", 'console.log("locked");setInterval(()=>{},1000)'],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  t.after(() => {
    holder.kill();
  });
  await once(holder.stdout!, "data");
  const result = await retainReleaseBackups(root, true);
  assert.deepEqual(result.busy, ["release-00000001"]);
  assert.ok(existsSync(join(old, "uploads.before.tar")));
  holder.kill();
  await once(holder, "exit");
});

test("cloud retention is scoped to an explicit app and host, retains five across changed source paths and defaults to dry-run", () => {
  const dry = cloudRetentionArguments("slk-prod", "staedtechallenge");
  assert.deepEqual(dry, [
    "forget",
    "--host",
    "slk-prod",
    "--tag",
    "staedtechallenge",
    "--group-by",
    "host",
    "--keep-last",
    "5",
    "--dry-run",
  ]);
  assert.ok(cloudRetentionArguments("slk-prod", "staedtechallenge", true).includes("--prune"));
  assert.throws(() => cloudRetentionArguments("", "staedtechallenge"));
  assert.throws(() => cloudRetentionArguments("slk-prod", "--all"));
});
