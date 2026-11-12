/** Explicit, disposable Podman integration test. Never mounts this checkout's data. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { symlinkSync, mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "slk-logical-"));
const checkout = join(directory, "checkout");
mkdirSync(checkout);
const project = "slk-logical-" + randomBytes(6).toString("hex");
const environment = {
  ...process.env,
  COMPOSE_PROJECT_NAME: project,
  SLK_PODMAN_PROJECT: project,
  CORE_UPGRADE_TIMEOUT_SECONDS: "120",
};
const podman = (...args: string[]) =>
  execFileSync("podman", args, {
    cwd: checkout,
    env: environment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 240000,
  }).trim();
const compose = (...args: string[]) =>
  execFileSync(
    "podman-compose",
    ["--in-pod=false", "-p", project, "-f", "podman-compose.yaml", "-f", "podman-compose.dev.yaml", ...args],
    { cwd: checkout, env: environment, encoding: "utf8", timeout: 240000 },
  ).trim();
const dbImage = /^FROM (docker\.io\/postgis\/postgis:\S+)/m.exec(
  readFileSync(join(root, "podman/database/Containerfile"), "utf8"),
)![1]!;
const meiliImage = /^FROM (docker\.io\/getmeili\/meilisearch:\S+)/m.exec(
  readFileSync(join(root, "podman/meilisearch/Containerfile"), "utf8"),
)![1]!;
const nodeImage = /^FROM (node:\S+)/m.exec(
  readFileSync(join(root, "podman/frontend/RuntimeContainerfile"), "utf8"),
)![1]!;
let targetVolumes: string[] = [];
try {
  cpSync(join(root, "bin"), join(checkout, "bin"), {
    recursive: true,
    filter: (path) => !/\/(node_modules|test_suite)(\/|$)/.test(path),
  });
  mkdirSync(join(checkout, "podman/frontend"), { recursive: true });
  cpSync(join(root, "podman/frontend/RuntimeContainerfile"), join(checkout, "podman/frontend/RuntimeContainerfile"));
  for (const name of ["database", "meilisearch"]) {
    mkdirSync(join(checkout, "podman", name), { recursive: true });
    cpSync(join(root, "podman", name, "Containerfile"), join(checkout, "podman", name, "Containerfile"));
  }
  mkdirSync(join(checkout, "src/directus/cli"), { recursive: true });
  symlinkSync(join(root, "src/directus/cli/node_modules"), join(checkout, "src/directus/cli/node_modules"), "dir");
  // This disposable data fixture has its own Compose file, separate from application confinement/mounts.
  writeFileSync(
    join(checkout, "bin/podman.sh"),
    '#!/bin/bash\nshift 2\nfiles=(-f podman-compose.yaml -f podman-compose.dev.yaml)\nif [[ -f podman/core-storage/development.compose.json ]]; then files+=(-f podman/core-storage/development.compose.json); fi\nexec podman-compose --in-pod=false -p "$SLK_PODMAN_PROJECT" "${files[@]}" "$@"\n',
    { mode: 0o755 },
  );
  const customSearch = join(checkout, "custom search");
  mkdirSync(customSearch);
  writeFileSync(
    join(checkout, "podman-compose.yaml"),
    JSON.stringify({
      services: {
        db: {
          image: dbImage,
          environment: {
            POSTGRES_USER: "slk_fixture",
            POSTGRES_PASSWORD: randomBytes(20).toString("hex"),
            POSTGRES_DB: "directus",
          },
          volumes: ["original-db:/var/lib/postgresql/data"],
        },
        meilisearch: {
          image: meiliImage,
          environment: { MEILI_MASTER_KEY: project, MEILI_ENV: "development" },
          volumes: [{ type: "bind", source: customSearch, target: "/meili_data" }],
          ports: ["127.0.0.1::7700"],
        },
        frontend: { image: nodeImage },
        directus: { image: nodeImage },
      },
      volumes: { "original-db": {} },
    }),
    { mode: 0o600 },
  );
  writeFileSync(join(checkout, "podman-compose.dev.yaml"), "services: {}\n");
  compose("up", "-d", "db", "meilisearch");
  const db = compose("ps", "-q", "db"),
    meili = compose("ps", "-q", "meilisearch");
  for (let attempt = 0; ; attempt++) {
    try {
      podman("exec", db, "pg_isready", "-q", "-h", "127.0.0.1", "-U", "slk_fixture");
      break;
    } catch {
      if (attempt === 100) throw Error("Fixture DB did not start");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const sql = (database: string, statement: string) =>
    podman("exec", db, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-U", "slk_fixture", "-d", database, "-c", statement);
  sql(
    "directus",
    "CREATE TABLE fixture (id int PRIMARY KEY, name text, shape geometry(Point,4326)); INSERT INTO fixture VALUES (1,'Grüße',ST_GeomFromText('POINT(1 2)',4326)); CREATE ROLE fixture_readonly; GRANT SELECT ON fixture TO fixture_readonly;",
  );
  sql("postgres", "CREATE DATABASE secondary");
  sql("secondary", "CREATE TABLE second_fixture (id int); INSERT INTO second_fixture VALUES (42)");
  const port = compose("port", "meilisearch", "7700").split(":").at(-1);
  const request = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { Authorization: `Bearer ${project}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.ok(response.ok, `Fixture search ${path}: ${response.status}`);
    return response.json();
  };
  for (let attempt = 0; ; attempt++) {
    try {
      await request("/health");
      break;
    } catch {
      if (attempt === 100)
        throw Error(
          "Fixture search did not start on port " +
            port +
            ": " +
            podman("inspect", meili, "--format", "{{json .State}}") +
            podman("logs", meili),
        );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  await request("/indexes", "POST", { uid: "fixture", primaryKey: "id" });
  await request("/indexes/fixture/documents", "POST", [{ id: "one", title: "search fixture" }]);
  console.log("Running the real logical migration against disposable named/custom mounts…");
  const output = execFileSync(
    "bash",
    [join(checkout, "bin/upgrade_core_services.sh"), "development", "--logical", "--apply"],
    { cwd: checkout, env: environment, encoding: "utf8", timeout: 240000, maxBuffer: 4 * 1024 * 1024 },
  );
  process.stdout.write(output);
  const overlay = JSON.parse(readFileSync(join(checkout, "podman/core-storage/development.compose.json"), "utf8"));
  targetVolumes = Object.values(overlay.volumes as Record<string, { name: string }>).map((volume) => volume.name);
  const migrated = (...args: string[]) => compose("-f", "podman/core-storage/development.compose.json", ...args);
  const newDb = migrated("ps", "-q", "db");
  assert.notEqual(newDb, db);
  assert.equal(
    podman(
      "exec",
      newDb,
      "psql",
      "-XqAt",
      "-U",
      "slk_fixture",
      "-d",
      "secondary",
      "-c",
      "SELECT id FROM second_fixture",
    ),
    "42",
  );
  assert.equal(
    podman("exec", newDb, "psql", "-XqAt", "-U", "slk_fixture", "-d", "directus", "-c", "SELECT name FROM fixture"),
    "Grüße",
  );
  // Source storage was never mounted into the target versions during validation.
  assert.ok(podman("volume", "inspect", `${project}_original-db`));
  const searchFiles = podman(
    "run",
    "--rm",
    "--network",
    "none",
    "--entrypoint",
    "sh",
    "--mount",
    `type=bind,source=${customSearch},target=/source,readonly`,
    dbImage,
    "-ec",
    "test -f /source/data.ms/VERSION; cat /source/data.ms/VERSION",
  );
  assert.ok(searchFiles);
  migrated("rm", "-sf", "db", "meilisearch"); // Prove the guard reads persisted volume metadata without containers.
  execFileSync("bash", [join(checkout, "bin/check_core_service_data.sh"), "development"], {
    cwd: checkout,
    env: environment,
    stdio: "pipe",
  });
  console.log(
    "Logical migration: multiple databases, spatial rows, roles, named/custom mounts, search restore and container-free startup guard passed.",
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  if (process.env.TEST_KEEP_CORE_FIXTURE === "1") {
    console.log("Retained disposable fixture: " + directory);
    process.exitCode = 1;
  } else
    try {
      const overlayFile = join(checkout, "podman/core-storage/development.compose.json");
      try {
        const overlay = JSON.parse(readFileSync(overlayFile, "utf8"));
        targetVolumes = Object.values(overlay.volumes as Record<string, { name: string }>).map((volume) => volume.name);
        compose("-f", overlayFile, "down", "--volumes", "--remove-orphans");
      } catch {
        /* Pre-cutover failure. */
      }
      compose("down", "--volumes", "--remove-orphans");
      for (const volume of targetVolumes) podman("volume", "rm", volume);
    } finally {
      podman(
        "run",
        "--rm",
        "--network",
        "none",
        "--userns=keep-id",
        "--user",
        "0",
        "--entrypoint",
        "sh",
        "--mount",
        `type=bind,source=${directory},target=/cleanup`,
        nodeImage,
        "-ec",
        'chown -R "$1:$2" /cleanup',
        "sh",
        String(process.getuid!()),
        String(process.getgid!()),
      );
      rmSync(directory, { recursive: true, force: true });
    }
}
