/** Reconcile private website identities before a development frontend starts. */
import dotenv from "dotenv";
import { lstatSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { assertPrivatePodmanFile } from "../lib/podman-security.ts";
import { root } from "./process.ts";
import type { Runtime } from "./stack.ts";

const serviceKeys = ["DIRECTUS_FRONTEND_SERVER_TOKEN", "DIRECTUS_FRONTEND_PUBLIC_TOKEN", "DIRECTUS_PREVIEW_TOKEN"];

export async function reconcileDevelopmentServiceUsers(rt: Runtime): Promise<void> {
  if (rt.environment !== "development") return;
  const path = resolve(rt.env.SLK_PODMAN_FRONTEND_ENV_FILE || resolve(root, "src/frontend/.env"));
  const cmsPath = resolve(rt.env.SLK_PODMAN_DIRECTUS_ENV_FILE || resolve(root, "src/directus/.env"));
  for (const file of [path, cmsPath]) assertPrivatePodmanFile(lstatSync(file), process.getuid!());
  const source = readFileSync(path, "utf8");
  const settings = dotenv.parse(source);
  const adminToken = dotenv.parse(readFileSync(cmsPath)).CLI_DIRECTUS_STATIC_TOKEN;
  if (!adminToken || !/^[A-Za-z0-9_-]{32,255}$/.test(adminToken))
    throw new Error("Development service setup requires a valid private CLI administrator credential.");
  let output: string;
  try {
    output = await rt.compose(
      [
        "exec",
        "-T",
        "-e",
        "DIRECTUS_URL=http://127.0.0.1:8055",
        "directus",
        "node",
        "/directus/cli/tasks/provisionServiceUsers.ts",
      ],
      { capture: true },
    );
  } catch {
    throw new Error(
      "Development service-user provisioning failed; check the imported roles and private CLI administrator credential.",
    );
  }
  const values = dotenv.parse(output);
  if (
    Object.keys(values).length !== serviceKeys.length ||
    serviceKeys.some((key) => !/^[a-f0-9]{64}$/.test(values[key] || ""))
  )
    throw new Error("Development service-user provisioning returned invalid credentials; private output withheld.");
  values.DIRECTUS_ADMIN_TOKEN = adminToken;
  if (
    Object.entries(values).every(
      ([key, value]) =>
        settings[key] === value && (settings[`NUXT_${key}`] === undefined || settings[`NUXT_${key}`] === value),
    )
  )
    return;
  const keys = new Set(Object.keys(values).flatMap((key) => [key, `NUXT_${key}`]));
  const next =
    source
      .split(/\r?\n/)
      .filter((line) => {
        const match = /^\s*(?:export\s+)?([A-Z_]+)\s*=/.exec(line);
        return !match || !keys.has(match[1]!);
      })
      .join("\n")
      .replace(/\n*$/, "\n") +
    Object.entries(values)
      .flatMap(([key, value]) => [`${key}=${value}`, `NUXT_${key}=${value}`])
      .join("\n") +
    "\n";
  const temporary = `${path}.${randomUUID()}`;
  try {
    writeFileSync(temporary, next, { mode: 0o600, flag: "wx" });
    if (
      readFileSync(path, "utf8") !== source ||
      dotenv.parse(readFileSync(cmsPath)).CLI_DIRECTUS_STATIC_TOKEN !== adminToken
    )
      throw new Error("Private development environment changed during service setup; retry startup.");
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
