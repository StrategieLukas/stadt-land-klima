import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  invalidateProductionOutput,
  productionInputHash,
  stampProductionOutput,
  verifyProductionOutput,
} from "../../../src/frontend/scripts/productionOutput.mts";

function fixture(t: { after: (callback: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "slk-output-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const frontend = join(root, "frontend"),
    translations = join(root, "translations");
  for (const directory of [".output/server", "public/vendor/dist", ".nuxt", "node_modules"])
    mkdirSync(join(frontend, directory), { recursive: true });
  mkdirSync(translations);
  writeFileSync(join(frontend, "package-lock.json"), "locked source");
  writeFileSync(join(frontend, "public/vendor/dist/widget.js"), "public code");
  writeFileSync(join(frontend, ".output/server/index.mjs"), "production code");
  writeFileSync(join(translations, "de.yaml"), "translated text");
  const environment = { PRIVATE_SECRET: "never-copy-this-secret", HOSTNAME: "container-one" };
  const stamp = () =>
    stampProductionOutput(
      frontend,
      translations,
      productionInputHash(frontend, translations, environment),
      environment,
    );
  const verify = (env = environment) => verifyProductionOutput(frontend, translations, env);
  return { root, frontend, translations, environment, stamp, verify };
}

test("verified production output survives ordinary restarts without persisting secrets", (t) => {
  const f = fixture(t);
  assert.equal(f.verify(), false);
  f.stamp();
  assert.equal(f.verify(), true);
  assert.equal(f.verify({ ...f.environment, HOSTNAME: "container-two" }), true);
  writeFileSync(join(f.frontend, ".nuxt/generated.ts"), "generated");
  writeFileSync(join(f.frontend, "node_modules/package.js"), "installed");
  assert.equal(f.verify(), true);
  const marker = readFileSync(join(f.frontend, ".output/.slk-production.json"), "utf8");
  assert.doesNotMatch(marker, /PRIVATE_SECRET|never-copy-this-secret/);
  assert.equal(f.verify({ ...f.environment, PRIVATE_SECRET: "changed" }), false);
  invalidateProductionOutput(f.frontend);
  assert.equal(f.verify(), false);
});

test("source, lockfile, public dist assets, translations and output drift invalidate the build", (t) => {
  const f = fixture(t);
  for (const file of [
    join(f.frontend, "package-lock.json"),
    join(f.frontend, "public/vendor/dist/widget.js"),
    join(f.translations, "de.yaml"),
    join(f.frontend, ".output/server/index.mjs"),
  ]) {
    f.stamp();
    assert.equal(f.verify(), true);
    writeFileSync(file, "changed " + file);
    assert.equal(f.verify(), false, file);
  }
  f.stamp();
  rmSync(join(f.frontend, ".output/server/index.mjs"));
  assert.equal(f.verify(), false);
});

test("failed or changing builds cannot acquire a valid output stamp", (t) => {
  const f = fixture(t);
  const input = productionInputHash(f.frontend, f.translations, f.environment);
  writeFileSync(join(f.frontend, "app.vue"), "new application");
  assert.throws(() => stampProductionOutput(f.frontend, f.translations, input, f.environment), /inputs changed/);
  assert.equal(f.verify(), false);
  f.stamp();
  writeFileSync(join(f.frontend, ".output/.slk-production.json"), "malformed");
  assert.equal(f.verify(), false);
});

test("output symlinks cannot hide dependencies outside the verified artifact", (t) => {
  const f = fixture(t);
  symlinkSync(join(f.frontend, "package-lock.json"), join(f.frontend, ".output/external-file"));
  assert.throws(f.stamp, /symlink escapes/);
  assert.equal(f.verify(), false);
});
