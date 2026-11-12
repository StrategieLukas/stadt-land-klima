/** Reproducible private-environment migration. No tracked deployment file is edited. */
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { lstatSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPrivatePodmanFile } from "./podman-security.ts";

type Snapshot = { path: string; before: string; after: string };
const require = createRequire(new URL("../../src/directus/cli/package.json", import.meta.url));
const dotenv = require("dotenv") as { parse: (source: string) => Record<string, string> };
function readPrivate(path: string): string {
  if (!isAbsolute(path)) throw Error("Private configuration path must be absolute");
  assertPrivatePodmanFile(lstatSync(path), process.getuid!());
  return readFileSync(path, "utf8");
}
function writePrivate(path: string, contents: string) {
  const temporary = path + "." + randomUUID();
  writeFileSync(temporary, contents, { mode: 0o600, flag: "wx" });
  renameSync(temporary, path);
}
export function replaceEnvironment(source: string, updates: Record<string, string>): string {
  for (const [name, value] of Object.entries(updates)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || /[\r\n$`"'\\]/.test(value)) throw Error("Unsafe environment update");
    const expression = new RegExp(`^${name}=.*$`, "gm");
    const matches = source.match(expression);
    if (matches && matches.length !== 1) throw Error("Duplicate environment key");
    source = matches ? source.replace(expression, `${name}=${value}`) : source.trimEnd() + `\n${name}=${value}\n`;
  }
  return source;
}
export function prepareCmsOrigin(config: string, state: string, cmsOrigin: string) {
  const directory = lstatSync(state);
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    directory.uid !== process.getuid!() ||
    (directory.mode & 0o777) !== 0o700
  )
    throw Error("Owned private release directory required");
  const url = new URL(cmsOrigin);
  if (url.protocol !== "https:" || url.origin !== cmsOrigin || !/^[a-z0-9.-]+$/.test(url.hostname))
    throw Error("HTTPS CMS origin required");
  const checkpoint = resolve(state, "cms-origin.before.json");
  if (existsSync(checkpoint)) throw Error("Preserve the existing migration checkpoint");
  const host = readPrivate(config);
  const inputs = dotenv.parse(host);
  const frontendPath = inputs.SLK_PODMAN_FRONTEND_ENV_FILE;
  const directusPath = inputs.SLK_PODMAN_DIRECTUS_ENV_FILE;
  if (!frontendPath || !directusPath || new Set([config, frontendPath, directusPath]).size !== 3)
    throw Error("Distinct private frontend/CMS/host files required");
  const frontend = readPrivate(frontendPath);
  const directus = readPrivate(directusPath);
  const website = new URL(dotenv.parse(frontend).PUBLIC_URL || "").origin;
  if (website === cmsOrigin) throw Error("Website and CMS origins must differ");
  const updates: Snapshot[] = [
    { path: frontendPath, before: frontend, after: replaceEnvironment(frontend, { CLIENT_DIRECTUS_URL: cmsOrigin }) },
    {
      path: directusPath,
      before: directus,
      after: replaceEnvironment(directus, {
        PUBLIC_URL: cmsOrigin,
        CORS_ENABLED: "true",
        CORS_ORIGIN: cmsOrigin,
        CORS_CREDENTIALS: "false",
        SESSION_COOKIE_DOMAIN: "",
        REFRESH_TOKEN_COOKIE_DOMAIN: "",
        SESSION_COOKIE_SECURE: "true",
        REFRESH_TOKEN_COOKIE_SECURE: "true",
        SESSION_COOKIE_SAME_SITE: "strict",
        REFRESH_TOKEN_COOKIE_SAME_SITE: "strict",
        SESSION_COOKIE_NAME: "__Host-slk-directus-session",
        REFRESH_TOKEN_COOKIE_NAME: "__Host-slk-directus-refresh",
      }),
    },
    { path: config, before: host, after: replaceEnvironment(host, { SLK_ALLOWED_ORIGINS: cmsOrigin }) },
  ];
  writePrivate(checkpoint, JSON.stringify({ version: 1, config, website, cmsOrigin, files: updates }) + "\n");
  for (const item of updates) writePrivate(item.path, item.after);
  return { website, cmsOrigin, changedFiles: updates.length };
}
export function restoreCmsOrigin(config: string, state: string) {
  const checkpoint: unknown = JSON.parse(readPrivate(resolve(state, "cms-origin.before.json")));
  if (
    !checkpoint ||
    typeof checkpoint !== "object" ||
    !("version" in checkpoint) ||
    checkpoint.version !== 1 ||
    !("config" in checkpoint) ||
    checkpoint.config !== config ||
    !("files" in checkpoint) ||
    !Array.isArray(checkpoint.files) ||
    checkpoint.files.length !== 3 ||
    !checkpoint.files.every((item: unknown): item is Snapshot =>
      Boolean(
        item &&
        typeof item === "object" &&
        "path" in item &&
        typeof item.path === "string" &&
        "before" in item &&
        typeof item.before === "string" &&
        "after" in item &&
        typeof item.after === "string",
      ),
    )
  )
    throw Error("Invalid migration checkpoint");
  for (const item of checkpoint.files) {
    const current = readPrivate(item.path);
    const comparable = (text: string) =>
      item.path === config ? text.replace(/^SLK_PODMAN_TAG=.*$/gm, "SLK_PODMAN_TAG=<release>") : text;
    if (comparable(current) !== comparable(item.after) && current !== item.before)
      throw Error("Private configuration changed since migration; refusing overwrite");
  }
  for (const item of checkpoint.files) writePrivate(item.path, item.before);
  writePrivate(
    resolve(state, "cms-origin.restored"),
    createHash("sha256").update(readPrivate(config)).digest("hex") + "\n",
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, config, state, origin] = process.argv.slice(2);
    if (!config || !state) throw Error("Configuration and state paths required");
    if (action === "prepare" && origin) console.log(JSON.stringify(prepareCmsOrigin(config, state, origin)));
    else if (action === "restore") {
      restoreCmsOrigin(config, state);
      console.log("Private origin configuration restored");
    } else
      throw Error(
        "Usage: cms-origin.ts prepare|restore /private/host.env /private/release-state [https://cms.example]",
      );
  } catch {
    console.error("CMS origin migration failed; private configuration values are withheld");
    process.exitCode = 1;
  }
}
