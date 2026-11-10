import assert from "node:assert/strict";
import { test } from "node:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { legacyCmsHtml } from "../../../src/frontend/utils/legacyCmsHtml.js";
import { prepareCmsOrigin, restoreCmsOrigin, replaceEnvironment } from "../../lib/cms-origin.js";
import { retireCmsOriginSessions } from "../../../src/directus/cli/retireCmsOriginSessions.js";

test("legacy participation steps keep numbered heading/text rows and nested authored sections without forced breaks", () => {
  const result = legacyCmsHtml(
    `<div id="mitmachen_1"><h3>Start</h3><div style="float:left;width:20%"><h2>1.</h2></div><div style="float:left;width:60%"><p>Authored text<br><a href="/register_localteam">Register</a></p></div></div>
    <div id="mitmachen_2"><h3>Research</h3><div><h2>2.</h2></div><div><p>Sources</p></div>
    <div id="mitmachen_3"><h3>Assess</h3><div><h2>3.</h2></div><div><p>Evidence</p></div></div>`,
    "https://cms.example",
  );
  assert.equal((result.match(/slk-cms-step-row/g) || []).length, 3);
  for (const text of ["Authored text", "Register", "Sources", "Evidence", "Research"]) assert(result.includes(text));
  assert(!result.includes("float:") && !result.includes("width:20%"));
  for (const number of [1, 2, 3]) assert(result.includes(`class="slk-cms-step-marker">${number}</div>`));
  assert(result.includes('class="slk-cms-step-body"><h3>Start</h3><p>Authored text <a'));
  assert(!/<img|<br|aria-hidden/.test(result));
});

test("legacy CMS URLs move to the configured origin without accepting executable HTML or rewriting foreign sites", () => {
  const result = legacyCmsHtml(
    `<img alt="Illustrationen Anmeldung" src="https://www.stadt-land-klima.de/backend/assets/image" onerror="alert(1)"><video controls poster="/backend/assets/poster" src="/backend/assets/video"></video><a href="https://future.stadt-land-klima.de/backend/admin/files">Files</a><a href="https://external.example/backend/a">External</a><video poster="javascript:alert(1)"></video><img src="javascript:alert(1)"><script>bad()</script>`,
    "https://directus.stadt-land-klima.de",
  );
  assert(result.includes('class="slk-cms-illustration"'));
  for (const file of ["image", "poster", "video"])
    assert(result.includes(`https://directus.stadt-land-klima.de/assets/${file}`));
  assert(result.includes("https://directus.stadt-land-klima.de/admin/files"));
  assert(result.includes("https://external.example/backend/a"));
  assert(result.includes("<video controls"));
  assert(!/onerror|javascript:|<script|bad\(\)/.test(result));
});

test("CMS origin migration changes only private URL/cookie/CORS settings and restores them on rollback", () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-origin-"));
  chmodSync(directory, 0o700);
  try {
    const config = join(directory, "future.env"),
      frontend = join(directory, "frontend.env"),
      cms = join(directory, "cms.env");
    const original = `SLK_PODMAN_FRONTEND_ENV_FILE=${frontend}\nSLK_PODMAN_DIRECTUS_ENV_FILE=${cms}\nSLK_PODMAN_TAG=release-aaaaaaaa\nSLK_ALLOWED_ORIGINS=https://future.stadt-land-klima.de\n`;
    writeFileSync(config, original, { mode: 0o600 });
    writeFileSync(
      frontend,
      "PUBLIC_URL=https://future.stadt-land-klima.de\nCLIENT_DIRECTUS_URL=/backend\nPRIVATE_SECRET=keep-me\n",
      { mode: 0o600 },
    );
    writeFileSync(cms, "PUBLIC_URL=https://future.stadt-land-klima.de/backend\nSECRET=keep-this-too\n", {
      mode: 0o600,
    });
    prepareCmsOrigin(config, directory, "https://directus.stadt-land-klima.de");
    assert(readFileSync(frontend, "utf8").includes("CLIENT_DIRECTUS_URL=https://directus.stadt-land-klima.de"));
    const updated = readFileSync(cms, "utf8");
    for (const setting of [
      "SECRET=keep-this-too",
      "SESSION_COOKIE_SECURE=true",
      "CORS_CREDENTIALS=false",
      "SESSION_COOKIE_DOMAIN=",
      "SESSION_COOKIE_NAME=__Host-slk-directus-session",
    ])
      assert(updated.includes(setting));
    writeFileSync(config, readFileSync(config, "utf8").replace("release-aaaaaaaa", "release-bbbbbbbb"), {
      mode: 0o600,
    });
    restoreCmsOrigin(config, directory);
    assert.equal(readFileSync(config, "utf8"), original);
    assert(readFileSync(frontend, "utf8").includes("PRIVATE_SECRET=keep-me"));
    assert(!readFileSync(cms, "utf8").includes("__Host-"));
    assert.throws(() => replaceEnvironment("URL=a\nURL=b", { URL: "c" }));
    assert.throws(() => replaceEnvironment("", { URL: "$(unsafe)" }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("old-origin session retirement defaults to planning and preserves shares, static tokens and other origins", async () => {
  const calls: { sql: string; values: string[] }[] = [];
  const query = async (sql: string, values: string[]) => {
    calls.push({ sql, values });
    return { rowCount: sql.startsWith("DELETE") ? 3 : 1, rows: [{ count: "3" }] };
  };
  const old = "https://future.stadt-land-klima.de",
    current = "https://directus.stadt-land-klima.de";
  assert.deepEqual(await retireCmsOriginSessions(query, old, current), { apply: false, sessions: 3, retired: 0 });
  assert.equal(calls.length, 1);
  assert.deepEqual(await retireCmsOriginSessions(query, old, current, true), { apply: true, sessions: 3, retired: 3 });
  assert(calls.at(-1)!.sql.startsWith("DELETE FROM directus_sessions"));
  assert(
    calls.every(
      ({ sql, values }) =>
        sql.includes('"user" IS NOT NULL AND "share" IS NULL AND origin = $1') &&
        values.length === 1 &&
        values[0] === old,
    ),
  );
  await assert.rejects(retireCmsOriginSessions(query, old, old, true));
});
