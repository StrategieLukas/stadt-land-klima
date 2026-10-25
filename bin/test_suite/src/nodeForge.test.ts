import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, privateEncrypt, constants, createHash, X509Certificate } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { get } from "node:https";
import { installedNodeForge, patchNodeForge } from "../../../src/frontend/scripts/patch-node-forge.mjs";

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));

test("installed RSA verifier rejects nested DigestAlgorithm garbage and non-empty NULL parameters but accepts valid signatures with or without NULL", () => {
  patchNodeForge(installedNodeForge(), true);
  const forge = frontend("node-forge");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 1024, publicExponent: 3 });
  const verifier = forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" }));
  const digest = createHash("sha256").update("CVE-2026-85393 regression").digest();
  const signature = (prefix: string) =>
    privateEncrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
      Buffer.concat([Buffer.from(prefix, "hex"), digest]),
    ).toString("binary");
  for (const prefix of ["3031300d060960864801650304020105000420", "302f300b06096086480165030402010420"]) {
    assert.equal(verifier.verify(digest.toString("binary"), signature(prefix)), true);
    assert.equal(verifier.verify(Buffer.alloc(32).toString("binary"), signature(prefix)), false);
  }
  for (const prefix of [
    "30343010060960864801650304020105000401000420",
    "3032300e06096086480165030402010401000420",
    "3032300e06096086480165030402010501000420",
    "30343010060960864801650304020105038888880420",
  ]) {
    assert.throws(() => verifier.verify(digest.toString("binary"), signature(prefix)), /DigestInfo/);
  }
});

test("backport check is idempotent and refuses missing patches, source tampering and version drift", () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-forge-"));
  try {
    mkdirSync(join(directory, "lib"));
    const metadata = JSON.stringify({ name: "node-forge", version: "1.4.0" });
    const source = readFileSync(join(installedNodeForge(), "lib/rsa.js"), "utf8");
    writeFileSync(join(directory, "package.json"), metadata);
    writeFileSync(join(directory, "lib/rsa.js"), source);
    patchNodeForge(directory);
    patchNodeForge(directory, true);
    assert.equal(readFileSync(join(directory, "lib/rsa.js"), "utf8"), source);
    // Reconstruct the exact upstream bytes to prove --check refuses an unpatched install.
    const original = source
      .replace(
        /          \/\/ validate DigestInfo structure and element counts \(outer DigestInfo[\s\S]*?          var capture = \{\};/,
        "          // validate DigestInfo structure and element count\n          var capture = {};",
      )
      .replace(
        "obj.value.length !== 2 ||\n            obj.value[0].value.length !==\n              (('parameters' in capture) ? 2 : 1) ||\n            (('parameters' in capture) && capture.parameters !== '')",
        "obj.value.length !== 2",
      );
    writeFileSync(join(directory, "lib/rsa.js"), original);
    assert.throws(() => patchNodeForge(directory, true), /backport missing/);
    patchNodeForge(directory);
    assert.equal(readFileSync(join(directory, "lib/rsa.js"), "utf8"), source);
    writeFileSync(join(directory, "lib/rsa.js"), source + "\n// unexpected modification");
    assert.throws(() => patchNodeForge(directory), /Unexpected patched/);
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "node-forge", version: "1.4.1" }));
    assert.throws(() => patchNodeForge(directory), /Reassess/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Nitro listener still generates working localhost HTTPS certificates with the backport", async () => {
  const { listen } = await import(pathToFileURL(frontend.resolve("listhen")).href);
  const listener = await listen(
    (_request: unknown, response: { end: (body: string) => void }) => response.end("secure listener"),
    {
      hostname: "127.0.0.1",
      port: 0,
      https: { domains: ["localhost", "127.0.0.1"] },
      showURL: false,
      clipboard: false,
    },
  );
  try {
    assert.equal(new X509Certificate(listener.https.cert).checkHost("localhost"), "localhost");
    const body = await new Promise<string>((resolve, reject) => {
      const request = get(listener.url, { rejectUnauthorized: false, agent: false }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += String(chunk);
        });
        response.on("end", () => resolve(body));
        response.on("error", reject);
      });
      request.setTimeout(5000, () => request.destroy(new Error("HTTPS handshake timed out")));
      request.on("error", reject);
    });
    assert.equal(body, "secure listener");
  } finally {
    await listener.close();
  }
});
