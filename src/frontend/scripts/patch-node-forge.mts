import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Backport of digitalbazaar/forge#1152, commit ceba34402e329f0365134f23fe19898756527d65.
// Also require ASN.1 NULL parameters to be empty: the open proposal misses that padding variant.
// Keep the actual 1.4.0 version visible to audit tools until an upstream release.
const originalHash = "fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50";
const before = `          // validate DigestInfo structure and element count
          var capture = {};
          var errors = [];
          if(!asn1.validate(obj, digestInfoValidator, capture, errors) ||
            obj.value.length !== 2) {`;
const after = `          // validate DigestInfo structure and element counts (outer DigestInfo
          // and nested DigestAlgorithm). asn1.validate ignores extra children,
          // so length must be checked explicitly at each nesting level to
          // prevent low-exponent PKCS#1 v1.5 signature forgery (CVE-2026-85393).
          var capture = {};
          var errors = [];
          if(!asn1.validate(obj, digestInfoValidator, capture, errors) ||
            obj.value.length !== 2 ||
            obj.value[0].value.length !==
              (('parameters' in capture) ? 2 : 1) ||
            (('parameters' in capture) && capture.parameters !== '')) {`;
const hash = (source: string) => createHash("sha256").update(source).digest("hex");

export function patchNodeForge(directory: string, checkOnly = false): void {
  const metadata: unknown = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !("name" in metadata) ||
    metadata.name !== "node-forge" ||
    !("version" in metadata) ||
    metadata.version !== "1.4.0"
  )
    throw new Error("Reassess the node-forge backport against the installed upstream version");
  const path = join(directory, "lib/rsa.js");
  const source = readFileSync(path, "utf8");
  if (source.includes(after)) {
    if (hash(source.replace(after, before)) !== originalHash) throw new Error("Unexpected patched node-forge source");
    return;
  }
  if (hash(source) !== originalHash || source.split(before).length !== 2)
    throw new Error("Unexpected node-forge source; refusing to patch");
  if (checkOnly) throw new Error("node-forge security backport missing; run npm ci with lifecycle scripts enabled");
  writeFileSync(path, source.replace(before, after));
  patchNodeForge(directory, true);
}

export function installedNodeForge(): string {
  // Resolve through Nitro's actual listener, including a future nested installation.
  const nitro = createRequire(import.meta.resolve("nitropack"));
  const listener = createRequire(nitro.resolve("listhen"));
  return dirname(listener.resolve("node-forge/package.json"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  patchNodeForge(installedNodeForge(), process.argv.includes("--check"));
  console.log("node-forge CVE-2026-85393 backport verified.");
}
