/** Load private release settings as dotenv data; never evaluate a host file as shell code. */
import dotenv from "dotenv";
import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPrivatePodmanFile } from "../lib/podman-security.ts";
export function hostEnvironment(path: string, keepSelectedTag = true): NodeJS.ProcessEnv {
  if (!isAbsolute(path)) throw new Error("An absolute private host configuration is required");
  assertPrivatePodmanFile(lstatSync(path), process.getuid!());
  const environment = { ...process.env, ...dotenv.parse(readFileSync(path)) };
  if (keepSelectedTag && process.env.SLK_PODMAN_TAG) environment.SLK_PODMAN_TAG = process.env.SLK_PODMAN_TAG;
  return environment;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [config, command, ...args] = process.argv.slice(2);
    if (!config || !command || !process.execve) throw new Error("Host configuration and command required");
    process.execve("/usr/bin/env", ["env", command, ...args], hostEnvironment(config));
  } catch {
    process.stderr.write("Release configuration could not be loaded; private values are withheld.\n");
    process.exitCode = 1;
  }
}
