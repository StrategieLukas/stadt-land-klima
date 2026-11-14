import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Verify the upstream fixed release instead of mutating installed dependencies. */
export function checkNodeForge(directory: string): void {
  const metadata: unknown = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !("name" in metadata) ||
    metadata.name !== "node-forge" ||
    !("version" in metadata) ||
    metadata.version !== "1.4.3"
  )
    throw new Error("Reassess the node-forge security check against the installed upstream version");
  const digest = createHash("sha256")
    .update(readFileSync(join(directory, "lib/rsa.js")))
    .digest("hex");
  if (digest !== "6632e195295ce76f6bb9131ee770dcd6cc1ee4ffac7906302208b00faf95a87f")
    throw new Error("Unexpected node-forge verifier source");
}

export function installedNodeForge(): string {
  const nitro = createRequire(import.meta.resolve("nitropack"));
  const listener = createRequire(nitro.resolve("listhen"));
  return dirname(listener.resolve("node-forge/package.json"));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkNodeForge(installedNodeForge());
  console.log("Upstream node-forge 1.4.3 verifier integrity checked.");
}
