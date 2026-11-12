import {
  existsSync,
  readFileSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  closeSync,
  writeFileSync,
  copyFileSync,
  renameSync,
  chmodSync,
  rmdirSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { run, capture, succeeds, node, pause, root, type RunOptions } from "./process.ts";
import { maintenance, type Runtime } from "./stack.ts";

export function coreImages() {
  const db = /^FROM (\S*postgis\/postgis:\S+)/m.exec(
    readFileSync(join(root, "podman/database/Containerfile"), "utf8"),
  )?.[1];
  const meili = /^FROM (\S*getmeili\/meilisearch:\S+)/m.exec(
    readFileSync(join(root, "podman/meilisearch/Containerfile"), "utf8"),
  )?.[1];
  const frontend = /^FROM ((?:docker\.io\/library\/)?node:\S+)/m.exec(
    readFileSync(join(root, "podman/frontend/RuntimeContainerfile"), "utf8"),
  )?.[1];
  if (!db || !meili || !frontend) throw new Error("Missing pinned core images");
  return {
    db,
    meili,
    frontend,
    dbMajor: db.split(":")[1]!.split("-")[0]!,
    meiliVersion: meili.split(":v")[1]!.split("@")[0]!,
  };
}
export type Mount = { Type: "bind" | "volume"; Source: string; Destination: string; Name?: string };
export async function mountFor(container: string, destination: string): Promise<Mount> {
  const data = JSON.parse(await capture("podman", ["inspect", container])) as Array<{ Mounts: Mount[] }>;
  const mount = data[0]?.Mounts.find((item) => item.Destination === destination);
  if (!mount || !["bind", "volume"].includes(mount.Type))
    throw new Error("Unsupported data mount; existing data was not changed.");
  return mount;
}
export async function storageVersion(mount: Mount, filename: string) {
  if (mount.Type === "bind" && !existsSync(mount.Source)) return "";
  if (mount.Type === "volume" && !(await succeeds("podman", ["volume", "inspect", mount.Name!]))) return "";
  return capture("podman", [
    "run",
    "--rm",
    "--network",
    "none",
    "--entrypoint",
    "sh",
    "--mount",
    `type=${mount.Type},source=${mount.Type === "bind" ? mount.Source : mount.Name},target=/storage,readonly`,
    coreImages().db,
    "-ec",
    'if [ -f "/storage/$1" ]; then cat "/storage/$1"; fi',
    "sh",
    filename,
  ]);
}
export async function checkCoreData(rt: Runtime) {
  const pins = coreImages();
  for (const [service, target, filename, expected] of [
    ["db", "/var/lib/postgresql/data", "PG_VERSION", pins.dbMajor],
    ["meilisearch", "/meili_data", "data.ms/VERSION", pins.meiliVersion],
  ]) {
    const id = await rt.raw(["ps", "--all", "--quiet", service!], { capture: true });
    let mount: Mount;
    if (id) mount = await mountFor(id, target!);
    else {
      const config = await rt.raw(["config"], { capture: true });
      const selected = await node("bin/lib/compose-mount.ts", [service!, target!, rt.project], {
        input: config,
        capture: true,
      });
      const [Type, Source, Name] = selected.split("|");
      mount = { Type: Type as Mount["Type"], Source: Source!, Destination: target!, ...(Name ? { Name } : {}) };
    }
    const version = await storageVersion(mount, filename!);
    if (version && version !== expected)
      throw new Error(
        `${service} data version ${version} requires migration to ${expected}. Run slk database upgrade --env ${rt.environment} --apply before starting.`,
      );
  }
}
export async function containerExec(container: string, args: string[], options: RunOptions = {}) {
  const prefix = (await succeeds("podman", ["exec", container, "test", "-x", "/usr/local/bin/slk-env"]))
    ? ["/usr/local/bin/slk-env"]
    : [];
  return run("podman", ["exec", "-i", container, ...prefix, ...args], options);
}
async function fileOutput(path: string, command: (fd: number) => Promise<unknown>) {
  const fd = openSync(path, "w", 0o600);
  try {
    await command(fd);
  } finally {
    closeSync(fd);
  }
}
export async function upgradeCore(rt: Runtime, apply: boolean, logical: boolean) {
  const pins = coreImages();
  const timeout = Number(process.env.CORE_UPGRADE_TIMEOUT_SECONDS || "3600");
  if (!Number.isSafeInteger(timeout) || timeout < 1)
    throw new Error("CORE_UPGRADE_TIMEOUT_SECONDS must be a positive integer.");
  const db = await rt.raw(["ps", "--all", "--quiet", "db"], { capture: true });
  const meili = await rt.raw(["ps", "--all", "--quiet", "meilisearch"], { capture: true });
  if (!db || !meili)
    throw new Error("Existing db and meilisearch containers are required; do not remove them before migration.");
  console.log(`PostgreSQL target: ${pins.db}\nMeilisearch target: ${pins.meili}`);
  if (!apply) return;
  const dbMount = await mountFor(db, "/var/lib/postgresql/data"),
    meiliMount = await mountFor(meili, "/meili_data");
  if (
    !logical &&
    (dbMount.Type !== "bind" ||
      meiliMount.Type !== "bind" ||
      dbMount.Source !== join(root, "podman/data/db") ||
      meiliMount.Source !== join(root, "podman/data/meilisearch"))
  )
    throw new Error("Custom paths and named volumes require --logical; existing data was not changed.");
  const dbVersion = await storageVersion(dbMount, "PG_VERSION"),
    meiliVersion = await storageVersion(meiliMount, "data.ms/VERSION");
  if (!/^\d+$/.test(dbVersion) || +dbVersion > +pins.dbMajor)
    throw new Error("Unsupported PostgreSQL source/downgrade.");
  const source = /^1\.(\d+)\.(\d+)$/.exec(meiliVersion),
    target = /^1\.(\d+)\.(\d+)$/.exec(pins.meiliVersion);
  if (!source || !target || +source[1]! > +target[1]! || (+source[1]! === +target[1]! && +source[2]! > +target[2]!))
    throw new Error("Unsupported Meilisearch source/downgrade.");
  if (!logical && dbVersion === pins.dbMajor && meiliVersion === pins.meiliVersion) {
    console.log("Data formats already match; no migration needed.");
    return;
  }
  for (const image of [pins.frontend, pins.db, pins.meili]) await run("podman", ["pull", image]);
  const backupRoot = join(root, "../backups");
  mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  const lock = join(backupRoot, `.${basename(root)}.core-upgrade-lock`);
  mkdirSync(lock, { mode: 0o700 });
  const backup = mkdtempSync(join(backupRoot, "core-services-"));
  chmodSync(backup, 0o700);
  const id = basename(backup),
    dbTarget = `slk-upgrade-db-${id}`,
    meiliTarget = `slk-upgrade-meili-${id}`;
  const dbNew = logical ? `slk-db-${id}` : `${dbMount.Source}.upgrade-${id}`;
  const meiliNew = logical ? `slk-meili-${id}` : `${meiliMount.Source}.upgrade-${id}`;
  let swapped = false;
  const inspectImage = (container: string) => capture("podman", ["inspect", "--format", "{{.Image}}", container]);
  const dbCommand = (container: string, database: string, options: RunOptions = {}) =>
    containerExec(
      container,
      ["sh", "-ec", 'exec psql -XqAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', "sh", database],
      options,
    );
  const waitDb = async (container: string) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        await containerExec(container, ["sh", "-ec", 'pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER"'], {
          quiet: true,
        });
        return;
      } catch {
        await pause(1000);
      }
    }
    await fileOutput(join(backup, "database-startup.log"), (output) => run("podman", ["logs", container], { output }));
    throw new Error("Database migration target did not become ready");
  };
  const meiliHelper = (container: string, action: string) =>
    run("podman", [
      "run",
      "--rm",
      "-i",
      "--userns=keep-id",
      "--user",
      `${process.getuid!()}:${process.getgid!()}`,
      "--network",
      `container:${container}`,
      "--env-file",
      join(backup, "meilisearch-runtime.env"),
      "--env",
      `CORE_UPGRADE_TIMEOUT_SECONDS=${timeout}`,
      "--mount",
      `type=bind,source=${join(root, "bin/lib/meilisearch-migration.ts")},target=/migration.ts,readonly`,
      "--mount",
      `type=bind,source=${backup},target=/backup`,
      "--entrypoint",
      "node",
      pins.frontend,
      "/migration.ts",
      action,
    ]);
  try {
    console.log(`Private migration backup: ${backup}`);
    if (logical)
      for (const volume of [dbNew, meiliNew]) {
        if (await succeeds("podman", ["volume", "inspect", volume])) throw new Error("Target volume already exists");
        await run("podman", ["volume", "create", volume], { quiet: true });
      }
    writeFileSync(
      join(backup, "rollback.compose.yaml"),
      JSON.stringify({
        services: { db: { image: await inspectImage(db) }, meilisearch: { image: await inspectImage(meili) } },
      }) + "\n",
      { mode: 0o600 },
    );
    for (const [container, prefix, file] of [
      [db, "POSTGRES_", "db-runtime.env"],
      [meili, "MEILI_", "meilisearch-runtime.env"],
    ]) {
      const metadata = await capture("podman", ["inspect", container!]);
      await fileOutput(join(backup, file!), (output) =>
        node("bin/lib/container-environment.ts", [prefix!], { input: metadata, output }),
      );
    }
    if (rt.environment === "production") await maintenance(rt);
    else await rt.raw(["stop", "frontend", "directus"]);
    await run("podman", ["start", db, meili], { quiet: true });
    await waitDb(db);
    await fileOutput(join(backup, "source-password-check.log"), (output) =>
      containerExec(
        db,
        [
          "sh",
          "-ec",
          'PGPASSWORD="$POSTGRES_PASSWORD" psql -XqAt -v ON_ERROR_STOP=1 -h "$(hostname -i)" -U "$POSTGRES_USER" -d postgres -c "SELECT 1"',
        ],
        { output },
      ),
    );
    const user = await containerExec(db, ["sh", "-ec", 'printf "%s" "$POSTGRES_USER"'], { capture: true });
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(user))
      throw new Error("Database superuser name requires manual globals restore");
    if (
      (await dbCommand(db, "postgres", {
        capture: true,
        input: "SELECT count(*) FROM pg_tablespace WHERE spcname NOT IN ('pg_default','pg_global');",
      })) !== "0"
    )
      throw new Error("Custom tablespaces require manual migration.");
    if (
      (await dbCommand(db, "postgres", {
        capture: true,
        input:
          "SELECT count(*) FROM pg_authid WHERE rolcanlogin AND (rolpassword LIKE 'md5%' OR rolpassword IS NULL) AND rolname <> current_user;",
      })) !== "0"
    )
      throw new Error("Other login roles need SCRAM rotation before migration.");
    const databases = (
      await dbCommand(db, "postgres", {
        capture: true,
        input: "SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname;",
      })
    )
      .split("\n")
      .filter(Boolean);
    if (!databases.length) throw new Error("No databases found");
    await fileOutput(join(backup, "globals.sql"), (output) =>
      containerExec(db, ["sh", "-ec", 'exec pg_dumpall -U "$POSTGRES_USER" --globals-only --quote-all-identifiers'], {
        output,
      }),
    );
    writeFileSync(
      join(backup, "globals-restore.sql"),
      readFileSync(join(backup, "globals.sql"), "utf8")
        .split("\n")
        .filter((line) => line !== `CREATE ROLE "${user}";`)
        .join("\n"),
      { mode: 0o600 },
    );
    const checks = readFileSync(join(root, "bin/lib/core-upgrade-table-checks.sql"), "utf8");
    for (const [index, database] of databases.entries()) {
      writeFileSync(join(backup, `database-${index}.name`), database + "\n", { mode: 0o600 });
      await fileOutput(join(backup, `database-${index}.dump`), (output) =>
        containerExec(
          db,
          [
            "sh",
            "-ec",
            'exec pg_dump -U "$POSTGRES_USER" --format=custom --create --quote-all-identifiers -d "$1"',
            "sh",
            database,
          ],
          { output },
        ),
      );
      await fileOutput(join(backup, `database-${index}.before`), (output) =>
        dbCommand(db, database, { input: checks, output }),
      );
    }
    await meiliHelper(meili, "export");
    const dumpFile = readFileSync(join(backup, "meilisearch-dump-filename"), "utf8").trim();
    let dumpDir = await containerExec(meili, ["sh", "-ec", 'printf "%s" "${MEILI_DUMP_DIR:-/meili_data/dumps}"'], {
      capture: true,
    });
    if (!dumpDir.startsWith("/"))
      dumpDir = (await capture("podman", ["inspect", "--format", "{{.Config.WorkingDir}}", meili])) + "/" + dumpDir;
    await run("podman", ["cp", `${meili}:${dumpDir}/${dumpFile}`, join(backup, "meilisearch.dump")]);
    chmodSync(join(backup, "meilisearch.dump"), 0o600);
    if (!logical)
      await run("podman", [
        "run",
        "--rm",
        "--network",
        "none",
        "--entrypoint",
        "sh",
        "--mount",
        `type=bind,source=${join(root, "podman/data")},target=/storage`,
        pins.db,
        "-ec",
        'test ! -e "/storage/$1"; test ! -e "/storage/$2"; mkdir "/storage/$1" "/storage/$2"',
        "sh",
        basename(dbNew),
        basename(meiliNew),
      ]);
    await run(
      "podman",
      [
        "run",
        "-d",
        "--name",
        dbTarget,
        "--network",
        "none",
        "--env-file",
        join(backup, "db-runtime.env"),
        "--env",
        "POSTGRES_DB=postgres",
        "--env",
        "POSTGRES_HOST_AUTH_METHOD=scram-sha-256",
        "--mount",
        `type=${logical ? "volume" : "bind"},source=${dbNew},target=/var/lib/postgresql/data`,
        pins.db,
      ],
      { quiet: true },
    );
    await waitDb(dbTarget);
    await fileOutput(join(backup, "globals-restore.log"), (output) =>
      dbCommand(dbTarget, "template1", { input: readFileSync(join(backup, "globals-restore.sql"), "utf8"), output }),
    );
    await fileOutput(join(backup, "password-upgrade.log"), (output) =>
      containerExec(dbTarget, ["sh", "-ec", 'exec psql -Xq -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d template1'], {
        output,
        input:
          "\\getenv upgrade_user POSTGRES_USER\n\\getenv upgrade_password POSTGRES_PASSWORD\nSET password_encryption = 'scram-sha-256';\nALTER ROLE :\"upgrade_user\" PASSWORD :'upgrade_password';\n\\unset upgrade_password\n",
      }),
    );
    for (const [index, database] of databases.entries()) {
      const input = openSync(join(backup, `database-${index}.dump`), "r");
      try {
        await fileOutput(join(backup, `database-${index}.restore.log`), (output) =>
          containerExec(
            dbTarget,
            [
              "sh",
              "-ec",
              'exec pg_restore -U "$POSTGRES_USER" --clean --if-exists --create --exit-on-error -d template1',
            ],
            { input, output },
          ),
        );
      } finally {
        closeSync(input);
      }
      await fileOutput(join(backup, `database-${index}.after`), (output) =>
        dbCommand(dbTarget, database, { input: checks, output }),
      );
      if (
        !readFileSync(join(backup, `database-${index}.before`)).equals(
          readFileSync(join(backup, `database-${index}.after`)),
        )
      )
        throw new Error("Restored table counts/row hashes differ; original data was retained.");
      await dbCommand(dbTarget, database, { input: "ANALYZE;", quiet: true });
    }
    console.log(
      `Verified all ${databases.length} PostgreSQL databases: application table counts and row hashes match.`,
    );
    await run(
      "podman",
      [
        "run",
        "-d",
        "--name",
        meiliTarget,
        "--env-file",
        join(backup, "meilisearch-runtime.env"),
        "--mount",
        `type=${logical ? "volume" : "bind"},source=${meiliNew},target=/meili_data`,
        "--mount",
        `type=bind,source=${join(backup, "meilisearch.dump")},target=/migration.dump,readonly`,
        pins.meili,
        "meilisearch",
        "--import-dump",
        "/migration.dump",
      ],
      { quiet: true },
    );
    let ready = false;
    for (let attempt = 0; attempt < timeout; attempt++) {
      if (
        await succeeds("podman", ["exec", meiliTarget, "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:7700/health"])
      ) {
        ready = true;
        break;
      }
      if ((await capture("podman", ["inspect", "--format", "{{.State.Running}}", meiliTarget])) !== "true") break;
      await pause(1000);
    }
    await fileOutput(join(backup, "meilisearch-import.log"), (output) =>
      run("podman", ["logs", meiliTarget], { output }),
    );
    if (!ready) throw new Error("Meilisearch import did not become ready");
    await meiliHelper(meiliTarget, "validate");
    await run("podman", ["stop", dbTarget, meiliTarget], { quiet: true });
    await rt.raw(["stop", "db", "meilisearch"]);
    if (logical) {
      await run("podman", [
        "run",
        "--rm",
        "--network",
        "none",
        "--userns=keep-id",
        "--user",
        `${process.getuid!()}:${process.getgid!()}`,
        "--entrypoint",
        "node",
        "--mount",
        `type=bind,source=${join(root, "bin/lib/core-storage-overlay.ts")},target=/overlay.ts,readonly`,
        "--mount",
        `type=bind,source=${backup},target=/backup`,
        pins.frontend,
        "/overlay.ts",
        rt.environment,
        dbNew,
        meiliNew,
        dbMount.Type,
        dbMount.Source,
        dbMount.Name || "",
        meiliMount.Type,
        meiliMount.Source,
        meiliMount.Name || "",
        await inspectImage(db),
        await inspectImage(meili),
      ]);
      const storage = join(root, "podman/core-storage"),
        active = join(storage, `${rt.environment}.compose.json`);
      mkdirSync(storage, { recursive: true, mode: 0o700 });
      if (existsSync(active)) {
        copyFileSync(active, join(backup, "previous.compose.json"));
        copyFileSync(join(storage, `${rt.environment}.volumes`), join(backup, "previous.volumes"));
      }
      copyFileSync(join(backup, "target.volumes"), join(storage, `${rt.environment}.volumes`));
      copyFileSync(join(backup, "target.compose.json"), active + ".new");
      renameSync(active + ".new", active);
      await rt.useStorageOverlay(active);
    } else {
      await run("podman", [
        "run",
        "--rm",
        "--network",
        "none",
        "--entrypoint",
        "node",
        "--mount",
        `type=bind,source=${join(root, "podman/data")},target=/storage`,
        "--mount",
        `type=bind,source=${join(root, "bin/cli/core-cutover.ts")},target=/cutover.ts,readonly`,
        pins.frontend,
        "/cutover.ts",
        id,
      ]);
    }
    swapped = true;
    await rt.raw(["up", "-d", "--no-deps", "--force-recreate", "db", "meilisearch"]);
    await checkCoreData(rt);
    console.log(
      `Core data upgrade complete. Backups: ${backup}\nApplication services remain stopped. Original storage is preserved for recovery.`,
    );
  } catch (error) {
    console.error(
      `Upgrade stopped. Private diagnostics/backups: ${backup}. ${swapped ? "Cutover occurred; keep maintenance active." : "Original storage remains in place."}`,
    );
    throw error;
  } finally {
    await succeeds("podman", ["rm", "-f", dbTarget, meiliTarget]);
    rmdirSync(lock);
  }
}
