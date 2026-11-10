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
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const fixtures = join(root, ".reports/full-export-tests");
mkdirSync(fixtures, { recursive: true, mode: 0o700 });

function fixture() {
  const directory = mkdtempSync(join(fixtures, "case-"));
  const put = (path: string, contents: string, mode = 0o600) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), contents, { mode });
  };
  for (const file of [
    "bin/full-export.sh",
    "bin/FULL_EXPORT.md",
    "bin/lib/core-service-data.sh",
    "bin/db_exports/export_db.sh",
  ]) {
    put(file, readFileSync(join(root, file), "utf8"), file.endsWith(".sh") ? 0o700 : 0o600);
  }
  put("src/directus/.env", "DB_DATABASE=app\nDB_PORT=5432\n");
  put("src/directus/uploads/private.txt", "private uploaded file\n");
  put("docker/data/db/PG_VERSION", "13\n");
  put("src/frontend/.output/server/index.mjs", "saved frontend output\n");
  put("src/frontend/node_modules/excluded.txt", "do not include\n");
  put("mounted/cache/data/session.rdb", "saved sessions\n");
  put("mounted/meilisearch/meili_data/index", "saved search index\n");
  put("mounted/db/data/PG_VERSION", "13\n");
  put("mounted/directus/uploads/external.txt", "external uploaded file\n");
  put("host.env", "PRIVATE_KEY=retain-this\nVALUE=$(never-execute)\n");
  put(".reports/mock/state.json", "{}");
  put("tools/sudo", '#!/bin/sh\nif [ "$1" = -v ]; then exit 0; fi\nexec "$@"\n', 0o700);
  for (const args of [
    ["init", "--quiet", directory],
    ["-C", directory, "add", "src/directus/.env"],
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
      "-m",
      "Fixture",
    ],
  ])
    assert.equal(spawnSync("git", args).status, 0);
  assert.equal(
    spawnSync("tar", ["-cf", join(directory, "image-payload.tar"), "-C", join(directory, "mounted/cache"), "data"])
      .status,
    0,
  );
  put(
    "tools/docker",
    `#!/usr/bin/env node
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const root=process.env.TEST_ROOT, failure=process.env.TEST_STATE;
let args=process.argv.slice(2);
if(args[0]==='--context') args.splice(0,2);
fs.appendFileSync(path.join(root,'.reports/mock/commands'),JSON.stringify(args)+'\\n');
const services=['db','frontend','directus','meilisearch','cache','maintenance'];
const id=s=>String.fromCharCode(97+services.indexOf(s)).repeat(64);
const service=idValue=>services.find(s=>id(s)===idValue);
const image=s=>'sha256:'+String(services.indexOf(s)+1).repeat(64);
const stateFile=path.join(root,'.reports/mock/state.json');
const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
const stateFor=s=>state[s]??{running:s!=='db',exit:0,started:'original',finished:'original'};
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(state));
const [action,...rest]=args;
if(action==='compose') {
 if(rest.includes('config')) {console.log('postgis/postgis:17-3.6\\ngetmeili/meilisearch:v1.55.0');process.exit(0);}
 if(rest.includes('ps')) {const s=rest.at(-1);if(failure==='missing'&&s==='db')process.exit(0);console.log(id(s));process.exit(0);}
 if(rest.includes('exec')) {
   if(fs.readFileSync(0).length)process.exit(11);
   if(process.env.DOCKER_CONTEXT!=='default')process.exit(12);
   if(failure==='dump-fail'){console.error('PRIVATE_ERROR_VALUE');process.exit(3);}
   console.log('CREATE TABLE app_data (id integer);');process.exit(0);
 }
 process.exit(10);
}
if(action==='inspect') {
 const at=rest.indexOf('--format');
 if(at===-1){console.log(JSON.stringify(rest.map(v=>({Id:v,Image:image(service(v))}))));process.exit(0);}
 const format=rest[at+1],s=service(rest.at(-1)),current=stateFor(s);
 if(format.includes('com.docker.compose.project'))console.log('old-project');
 else if(format.includes('com.docker.compose.service'))console.log(s);
 else if(format==='{{.Image}}')console.log(image(s));
 else if(format.includes('.Config.Env'))console.log(failure==='s3'?'STORAGE_LOCATIONS=s3':'STORAGE_LOCATIONS=local');
 else if(format.includes('.Mounts')) {
   let mounts=[];
   if(s==='db')mounts=[[failure==='named'?'volume':'bind',failure==='named'?'/engine/volumes/db/_data':root+'/docker/data/db','/var/lib/postgresql/data']];
   if(s==='frontend')mounts=[['bind',root+'/src/frontend','/frontend']];
   if(s==='directus')mounts=[[failure==='external'?'volume':'bind',failure==='external'?'/engine/volumes/uploads/_data':root+'/src/directus/uploads','/directus/uploads']];
   if(s==='cache')mounts=[['volume','/engine/volumes/cache/_data','/data']];
   if(s==='meilisearch')mounts=[['volume','/engine/volumes/search/_data','/meili_data']];
   console.log(mounts.map(m=>m.join('\\t')).join('\\n'));
 }
 else if(format==='{{.State.Running}}:{{.State.ExitCode}}')console.log(current.running+':'+current.exit);
 else if(format==='{{.State.Running}}')console.log(current.running);
 else if(format==='{{.State.ExitCode}}')console.log(current.exit);
 else if(format==='{{.State.StartedAt}}|{{.State.FinishedAt}}')console.log(current.started+'|'+current.finished);
 else if(format==='{{.State.Running}}|{{.State.StartedAt}}|{{.State.FinishedAt}}')console.log(current.running+'|'+current.started+'|'+current.finished);
 else process.exit(13);
 process.exit(0);
}
if(action==='stop') {
 for(const value of rest.filter(v=>/^[a-f]{64}$/.test(v))) {const s=service(value);state[s]={running:false,exit:failure==='unclean'&&s==='cache'?1:0,started:stateFor(s).started,finished:'stopped'};}
 save();process.exit(0);
}
if(action==='start') {const s=service(rest[0]);state[s]={running:true,exit:0,started:'started',finished:'original'};save();process.exit(0);}
if(action==='exec') {
 if(fs.readFileSync(0).length)process.exit(14);
 if(rest.some(x=>x.includes('pg_isready')))process.exit(failure==='not-ready'?2:0);
 if(rest.some(x=>x.includes('pg_tablespace'))) {if(failure==='tablespaces')console.log('custom');process.exit(0);}
 if(rest.some(x=>x.includes('pg_dumpall'))) {console.log('CREATE ROLE app;\\nCREATE DATABASE app;');process.exit(0);}
 process.exit(15);
}
if(action==='ps'){console.log(services.map(id).join('\\n'));process.exit(0);}
if(action==='image'){console.log(JSON.stringify(services.map(s=>({Id:image(s)}))));process.exit(0);}
if(action==='save') {
 if(failure==='restart'){state.directus={running:true,exit:0,started:'restarted',finished:'stopped'};save();}
 process.stdout.write(fs.readFileSync(path.join(root,'image-payload.tar')));process.exit(0);
}
if(action==='cp') {
 if(failure==='copy-fail')process.exit(16);
 const [container,destination]=rest[0].split(':'),s=service(container);
 let source=destination.startsWith('/frontend/.output')?path.join(root,'src/frontend/.output'):path.join(root,'mounted',s,path.basename(destination));
 const tarArgs=destination.endsWith('/.')?['-cf','-','-C',source,'.']:['-cf','-','-C',path.dirname(source),path.basename(source)];
 process.exit(cp.spawnSync('tar',tarArgs,{stdio:['ignore',1,2]}).status??1);
}
process.exit(17);
`,
    0o700,
  );
  const output = join(directory, "backups/result");
  const run = (state = "ok", extra: string[] = [], acknowledge = true, outputPath = "backups/result") =>
    spawnSync(
      "bash",
      [
        join(directory, "bin/full-export.sh"),
        ...(acknowledge ? ["--writers-stopped"] : []),
        "--output",
        outputPath,
        ...extra,
      ],
      {
        cwd: join(directory, "bin"),
        encoding: "utf8",
        env: {
          ...process.env,
          DOCKER_HOST: "",
          DOCKER_CONTEXT: "",
          TEST_ROOT: directory,
          TEST_STATE: state,
          PATH: join(directory, "tools") + ":" + process.env.PATH,
        },
      },
    );
  return { directory, output, run, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

for (const state of ["ok", "named", "external"])
  test(`full shell export: ${state} data, images and config survive archive restoration`, () => {
    const f = fixture();
    try {
      if (state === "named") {
        mkdirSync(join(f.directory, "docker/core-storage"), { recursive: true });
        writeFileSync(join(f.directory, "docker/core-storage/production.compose.json"), "{}");
        writeFileSync(join(f.directory, "docker/core-storage/production.volumes"), "target_db target_search\n");
      }
      const index = statSync(join(f.directory, ".git/index"));
      const result = f.run(state, ["--config", "host=" + join(f.directory, "host.env")]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /BACKUP COMPLETE/);
      assert.equal(statSync(f.output).mode & 0o777, 0o700);
      for (const file of readdirSync(f.output)) assert.equal(statSync(join(f.output, file)).mode & 0o777, 0o600);
      assert.equal(statSync(join(f.directory, ".git/index")).mtimeMs, index.mtimeMs, "Git index stays unchanged");
      assert.equal(spawnSync("sha256sum", ["--check", "SHA256SUMS"], { cwd: f.output }).status, 0);
      const restore = join(f.directory, "restored");
      mkdirSync(restore);
      assert.equal(
        spawnSync("tar", ["--no-same-owner", "-xzf", join(f.output, "checkout-and-data.tar.gz"), "-C", restore]).status,
        0,
      );
      assert.equal(readFileSync(join(restore, "src/directus/uploads/private.txt"), "utf8"), "private uploaded file\n");
      assert.equal(readFileSync(join(restore, "docker/data/db/PG_VERSION"), "utf8"), "13\n");
      assert.throws(() => statSync(join(restore, "backups")), "No recursive backups");
      assert.throws(() => statSync(join(restore, "src/frontend/.output")), "Frontend output is separate");
      assert.throws(() => statSync(join(restore, "src/frontend/node_modules")), "Dependencies are excluded");
      const mapping = readFileSync(join(f.output, "mounts.tsv"), "utf8");
      assert.match(mapping, /\/data/);
      assert.match(mapping, /\/meili_data/);
      if (state === "named") assert.match(mapping, /\/var\/lib\/postgresql\/data/);
      if (state === "external") assert.match(mapping, /\/directus\/uploads/);
      for (const line of mapping.trim().split("\n").slice(1)) {
        const [archive, , , , destination] = line.split("\t"),
          target = join(restore, archive!);
        mkdirSync(target);
        assert.equal(spawnSync("tar", ["--no-same-owner", "-xf", join(f.output, archive!), "-C", target]).status, 0);
        const expected: Record<string, [string, string]> = {
          "/data": ["data/session.rdb", "saved sessions\n"],
          "/meili_data": ["meili_data/index", "saved search index\n"],
          "/var/lib/postgresql/data": ["data/PG_VERSION", "13\n"],
          "/directus/uploads": ["uploads/external.txt", "external uploaded file\n"],
        };
        const [file, contents] = expected[destination!]!;
        assert.equal(readFileSync(join(target, file), "utf8"), contents);
      }
      const frontend = join(restore, "frontend-output");
      mkdirSync(frontend);
      assert.equal(
        spawnSync("tar", ["--no-same-owner", "-xf", join(f.output, "frontend-output.tar"), "-C", frontend]).status,
        0,
      );
      assert.equal(readFileSync(join(frontend, "server/index.mjs"), "utf8"), "saved frontend output\n");
      assert.equal(
        readFileSync(join(f.output, "config-host"), "utf8"),
        readFileSync(join(f.directory, "host.env"), "utf8"),
      );
      const commands = readFileSync(join(f.directory, ".reports/mock/commands"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string[]);
      if (state === "named")
        assert(
          commands.some((args) => args.includes("docker/core-storage/production.compose.json")),
          "Loads migrated storage overlay",
        );
      assert(
        !commands.some((args) => ["run", "create", "pull", "build", "up"].includes(args[0]!)),
        "No container creation/upgrade",
      );
      assert(
        commands.some((args) => args[0] === "save" && args.length === 7),
        "Includes all six project images, including maintenance",
      );
      const states = JSON.parse(readFileSync(join(f.directory, ".reports/mock/state.json"), "utf8"));
      for (const service of ["db", "frontend", "directus", "meilisearch", "cache"])
        assert.equal(states[service].running, false);
      writeFileSync(join(f.output, "directus.sql"), "corrupt");
      assert.notEqual(spawnSync("sha256sum", ["--check", "SHA256SUMS"], { cwd: f.output, stdio: "ignore" }).status, 0);
    } finally {
      f.cleanup();
    }
  });

for (const state of ["missing", "s3", "unclean", "not-ready", "tablespaces", "dump-fail", "copy-fail", "restart"])
  test(`full shell export refuses ${state} without a completion marker`, () => {
    const f = fixture();
    try {
      const result = f.run(state);
      assert.notEqual(result.status, 0);
      assert.throws(() => statSync(join(f.output, "SHA256SUMS")));
      assert(!result.stderr.includes("PRIVATE_ERROR_VALUE"));
      if (["missing", "s3"].includes(state))
        assert(!readFileSync(join(f.directory, ".reports/mock/commands"), "utf8").includes('["stop"'));
    } finally {
      f.cleanup();
    }
  });

test("full shell export requires writer acknowledgement and refuses output outside the checkout", () => {
  const f = fixture();
  try {
    assert.match(f.run("ok", [], false).stderr, /writers-stopped/);
    const result = f.run("ok", [], true, "/outside/export");
    assert.notEqual(result.status, 0);
    assert.throws(() => statSync(f.output));
  } finally {
    f.cleanup();
  }
});
