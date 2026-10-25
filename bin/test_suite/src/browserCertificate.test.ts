import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { chromiumCertificateArguments } from "./lib/browser.js";

test("local TLS testing opts into a certificate-specific pin and never blanket TLS bypass", () => {
  assert.deepEqual(chromiumCertificateArguments(), []);
  // Public fixture only: no private key is included or needed by this test.
  const certificate = fileURLToPath(new URL("./fixtures/tls-pin.crt", import.meta.url));
  const arguments_ = chromiumCertificateArguments(certificate);
  assert.equal(arguments_.length, 1);
  assert.match(arguments_[0]!, /^--ignore-certificate-errors-spki-list=[A-Za-z0-9+/]{43}=$/);
  assert.ok(!arguments_.includes("--ignore-certificate-errors"));
  assert.throws(() => chromiumCertificateArguments(`${certificate}.missing`), /ENOENT/);
});
