import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { verifyBundle, outputDirectory, createBundle } from "../../lib/portable-backup.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
// Keep all fixture writes in this repository, including subprocess temporaries.
const fixtures = join(root, ".reports/portable-backup-tests");
mkdirSync(fixtures, { recursive: true, mode: 0o700 });
function fixture() {
  const directory = mkdtempSync(join(fixtures, "case-"));
  for (const name of [
    "bin/lib",
    "podman/database",
    "podman/meilisearch",
    "src/directus",
    "src/frontend",
    "tools",
    "payload",
    "restore",
  ])
    mkdirSync(join(directory, name), { recursive: true });
  copyFileSync(join(root, "bin/lib/portable-backup.ts"), join(directory, "bin/lib/portable-backup.ts"));
  copyFileSync(join(root, "bin/lib/container-environment.ts"), join(directory, "bin/lib/container-environment.ts"));
  copyFileSync(join(root, "bin/package.json"), join(directory, "bin/package.json"));
  symlinkSync(join(root, "bin/node_modules"), join(directory, "bin/node_modules"), "dir");
  copyFileSync(join(root, "bin/PORTABLE_BACKUP.md"), join(directory, "bin/PORTABLE_BACKUP.md"));
  for (const name of ["podman/database", "podman/meilisearch", "src/directus", "src/frontend"])
    writeFileSync(join(directory, name, ".env"), "KEY=private\n");
  writeFileSync(join(directory, "tracked.txt"), "original");
  writeFileSync(join(directory, "deleted.txt"), "remove after commit");
  for (const args of [
    ["init", "--quiet", directory],
    ["-C", directory, "add", "tracked.txt", "deleted.txt"],
    [
      "-C",
      directory,
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "user.name=Backup Test",
      "-c",
      "user.email=backup@example.invalid",
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      "Fixture",
    ],
  ])
    assert.equal(spawnSync("git", args).status, 0);
  writeFileSync(join(directory, "tracked.txt"), "local edit");
  rmSync(join(directory, "deleted.txt"));
  writeFileSync(join(directory, "payload/file.txt"), "upload contents äöü\n");
  writeFileSync(join(directory, "payload/.private"), "private file\n");
  assert.equal(
    spawnSync("tar", ["-cf", join(directory, "payload.tar"), "-C", join(directory, "payload"), "."]).status,
    0,
  );
  const engine = `#!/usr/bin/env node
const fs = require('node:fs');
let args=process.argv.slice(2);
if(args[0]==='--remote=false') args.shift();
if(args[0]==='--context') args.splice(0,2);
fs.appendFileSync(process.env.TEST_LOG,JSON.stringify(args)+'\\n');
const [action,...rest]=args;
if(action==='ps') {
 const service=rest.at(-1).split('=').at(-1);
 if(process.env.TEST_STATE==='missing' && service==='cache') process.exit(0);
 console.log(service); process.exit(0);
}
if(action==='inspect') {
 const service=rest[0];
 console.log(JSON.stringify([{Id:service, Image:'sha256:'+({db:'1',directus:'2',frontend:'3',cache:'4',meilisearch:'5'}[service]).repeat(64),
 Config:{Image:'saved/'+service+':old',Env:process.env.TEST_STATE==='s3'&&service==='directus'?['STORAGE_LOCATIONS=s3']:[]},
 State:{Running:service==='db'||(process.env.TEST_STATE==='running'&&service==='frontend'),ExitCode:process.env.TEST_STATE==='unclean'&&service==='cache'?1:0,Status:service==='db'?'running':'exited'},Mounts:[{Destination:'/directus/uploads'}]}])); process.exit(0);
}
if(action==='exec') {
 if(rest.includes('pg_restore')) { const data=fs.readFileSync(0,'utf8'); if(data!=='PGDMP fixture') process.exit(3); console.log('valid archive'); }
 else if(rest.some(x=>x.includes('pg_tablespace'))) { if(process.env.TEST_STATE==='tablespaces') console.log('custom'); }
 else if(rest.some(x=>x.includes('json_agg'))) console.log(JSON.stringify(['postgres','application database']));
 else if(rest.some(x=>x.includes('pg_dumpall'))) console.log('CREATE ROLE app;');
 else if(rest.some(x=>x.includes('pg_dump '))) { if(process.env.TEST_STATE==='dump-fail') { console.error('SECRET runtime credentials'); process.exit(2); } process.stdout.write('PGDMP fixture'); }
 else process.exit(9);
 process.exit(0);
}
if(action==='cp'||action==='save') {process.stdout.write(fs.readFileSync(process.env.TEST_ARCHIVE));process.exit(0);}
process.exit(8);
`;
  for (const name of ["podman"]) writeFileSync(join(directory, "tools", name), engine, { mode: 0o700 });
  const run = (engine: string, state = "ok", extra: string[] = []) =>
    spawnSync(
      process.execPath,
      [
        join(directory, "bin/lib/portable-backup.ts"),
        "create",
        "--engine",
        engine,
        "--project",
        "source-project",
        "--output",
        join(directory, "backups/full"),
        "--writers-stopped",
        ...extra,
      ],
      {
        cwd: directory,
        encoding: "utf8",
        env: {
          ...process.env,
          DOCKER_HOST: "",
          DOCKER_CONTEXT: "",
          CONTAINER_HOST: "",
          CONTAINER_CONNECTION: "",
          SLK_PODMAN_DB_ENV_FILE: "",
          SLK_PODMAN_MEILI_ENV_FILE: "",
          SLK_PODMAN_DIRECTUS_ENV_FILE: "",
          SLK_PODMAN_FRONTEND_ENV_FILE: "",
          PATH: join(directory, "tools") + ":" + process.env.PATH,
          TEST_STATE: state,
          TEST_ARCHIVE: join(directory, "payload.tar"),
          TEST_LOG: join(directory, "commands"),
        },
      },
    );
  return {
    directory,
    run,
    output: join(directory, "backups/full"),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

for (const engine of ["podman"])
  test(`${engine}: portable capture survives relocation and restores directory contents`, async () => {
    const f = fixture();
    try {
      const result = f.run(engine);
      assert.equal(result.status, 0, result.stderr);
      await verifyBundle(f.output);
      const clone = join(f.directory, "restored-checkout");
      assert.equal(
        spawnSync("git", ["clone", "--quiet", "--no-checkout", join(f.output, "repository.bundle"), clone]).status,
        0,
      );
      assert.equal(
        spawnSync("git", ["-C", clone, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(),
        JSON.parse(readFileSync(join(f.output, "manifest.json"), "utf8")).revision,
      );

      assert.equal(statSync(f.output).mode & 0o777, 0o700);
      for (const file of readdirSync(f.output)) assert.equal(statSync(join(f.output, file)).mode & 0o777, 0o600);
      const manifest = JSON.parse(readFileSync(join(f.output, "manifest.json"), "utf8"));
      assert.equal(spawnSync("git", ["-C", clone, "reset", "--mixed", manifest.revision]).status, 0);
      assert.equal(
        spawnSync("tar", ["--no-same-owner", "-xzf", join(f.output, "source.tar.gz"), "-C", clone]).status,
        0,
      );
      assert.equal(readFileSync(join(clone, "tracked.txt"), "utf8"), "local edit");
      assert.throws(() => statSync(join(clone, "deleted.txt")), "Recovery must retain deleted tracked files");

      assert.deepEqual(
        manifest.databases.map((entry: { name: string }) => entry.name),
        ["postgres", "application database"],
      );
      const commands = readFileSync(join(f.directory, "commands"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string[]);
      assert(
        commands.every((args) => ["ps", "inspect", "exec", "cp", "save"].includes(args[0]!)),
        "No stop, start, run, volume or host modification commands",
      );
      assert(
        commands.some((args) => args.includes("--list")),
        "Checks database archives through pg_restore stdin",
      );
      assert(
        commands.some((args) => args[0] === "save" && args.filter((value) => value.startsWith("sha256:")).length === 5),
      );
      for (const archive of ["uploads.tar", "redis.tar", "search.tar", "frontend-output.tar"]) {
        const target = join(f.directory, "restore", archive);
        mkdirSync(target);
        assert.equal(spawnSync("tar", ["--no-same-owner", "-xf", join(f.output, archive), "-C", target]).status, 0);
        assert.equal(readFileSync(join(target, "file.txt"), "utf8"), "upload contents äöü\n");
        assert.equal(readFileSync(join(target, ".private"), "utf8"), "private file\n");
      }
      const moved = join(f.directory, "relocated");
      mkdirSync(moved);
      for (const file of readdirSync(f.output)) copyFileSync(join(f.output, file), join(moved, file));
      await verifyBundle(moved);
      writeFileSync(join(moved, "uploads.tar"), "corrupt");
      await assert.rejects(verifyBundle(moved), /Checksum mismatch/);
      assert.equal(f.run(engine).status, 1, "Never overwrite an earlier backup");
    } finally {
      f.cleanup();
    }
  });

for (const state of ["running", "missing", "unclean", "s3", "tablespaces", "dump-fail"])
  test(`backup refuses ${state} and never certifies partial output`, () => {
    const f = fixture();
    try {
      const result = f.run("podman", state);
      assert.equal(result.status, 1);
      assert(!result.stderr.includes("SECRET"));
      assert.throws(() => statSync(join(f.output, "SHA256SUMS")));
    } finally {
      f.cleanup();
    }
  });

test("backup rejects output symlinks, outside-repo writes and manifest path traversal", async () => {
  const f = fixture();
  try {
    assert.throws(() => outputDirectory(join(root, "../outside-backup")), /Output must/);
    const link = join(root, "backups/portable-test-link");
    mkdirSync(join(root, "backups"), { recursive: true, mode: 0o700 });
    symlinkSync(f.directory, link);
    try {
      assert.throws(() => outputDirectory(join(link, "new")), /symlinks/);
    } finally {
      rmSync(link);
    }
    assert.equal(f.run("podman").status, 0);
    writeFileSync(join(f.output, "SHA256SUMS"), "a".repeat(64) + "  ../secret\n");
    await assert.rejects(verifyBundle(f.output), /Invalid/);
  } finally {
    f.cleanup();
  }
});

test("explicit private config overrides a missing default and is never executed", async () => {
  const f = fixture();
  try {
    rmSync(join(f.directory, "podman/database/.env"));
    const config = join(f.directory, "operator.env");
    const text = "POSTGRES_USER=bootstrap\nKEY=$(touch /DO_NOT_EXECUTE)\n";
    writeFileSync(config, text);
    const result = f.run("podman", "ok", ["--config", "db=" + config]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(f.output, "config-db"), "utf8"), text);
    await verifyBundle(f.output);
  } finally {
    f.cleanup();
  }
});

test("capture requires an explicit writer shutdown acknowledgement", async () => {
  await assert.rejects(
    createBundle({
      engine: "podman",
      project: "source-project",
      output: "backups/unused",
      configs: [],
      writersStopped: false,
    }),
    /writers-stopped/,
  );
});

test("bundle verification refuses missing files, extra files and symlinked payloads", async () => {
  const f = fixture();
  try {
    assert.equal(f.run("podman").status, 0);
    const upload = join(f.output, "uploads.tar");
    const original = readFileSync(upload);
    rmSync(upload);
    await assert.rejects(verifyBundle(f.output));
    symlinkSync(join(f.directory, "payload.tar"), upload);
    await assert.rejects(verifyBundle(f.output), /regular file/);
    rmSync(upload);
    writeFileSync(upload, original);
    writeFileSync(join(f.output, "extra"), "unexpected");
    await assert.rejects(verifyBundle(f.output), /Unexpected/);
  } finally {
    f.cleanup();
  }
});
