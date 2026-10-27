import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { parseEnvFile } from "./lib/config.js";
import { createAdminClient } from "./lib/directus.js";
import { contentTranslationKey } from "../../../src/frontend/server/utils/contentTranslation.js";
import { deepLNamespace } from "../../../src/frontend/server/utils/deepLTranslation.js";

/** Run after stopping other Nuxt dev servers: they share the generated .nuxt directory.
 * This test starts its own frontend with BOTH key variables explicitly empty. It cannot
 * call DeepL, even if a key is present in private .env or the caller's environment.
 */
test(
  "keyless Nuxt serves persisted EN/IT fields and notices, reuses them after restart/revert, and respects source revocation",
  { skip: process.env.SLK_TRANSLATION_READER_TEST !== "1", timeout: 180_000 },
  async (t) => {
    const env = parseEnvFile(fileURLToPath(new URL("../../../src/directus/.env", import.meta.url)));
    assert.notEqual(env.SLK_ENV, "production");
    const frontend = fileURLToPath(new URL("../../../src/frontend/", import.meta.url));
    const front = parseEnvFile(`${frontend}/.env`);
    const search = parseEnvFile(fileURLToPath(new URL("../../../docker/meilisearch/.env", import.meta.url)));
    const admin = await createAdminClient("http://127.0.0.1:8081", env);
    const probe = createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const address = probe.address();
    assert(address && typeof address === "object");
    const port = address.port;
    await new Promise<void>((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
    const base = `http://127.0.0.1:${port}`;
    let child: ChildProcess | undefined;
    let log = "";
    const stop = async () => {
      if (!child || child.exitCode !== null || !child.pid) return;
      const current = child;
      const exited = once(current, "exit");
      try {
        process.kill(-current.pid!, "SIGTERM");
      } catch {
        return;
      }
      const timeout = setTimeout(() => {
        try {
          process.kill(-current.pid!, "SIGKILL");
        } catch {}
      }, 10_000);
      try {
        await exited;
      } finally {
        clearTimeout(timeout);
      }
      child = undefined;
    };
    const start = async () => {
      child = spawn(
        process.execPath,
        ["node_modules/@nuxt/cli/bin/nuxi.mjs", "dev", "--host", "127.0.0.1", "--port", String(port)],
        {
          cwd: frontend,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            ...search,
            ...front,
            SERVER_DIRECTUS_URL: "http://127.0.0.1:8081",
            NUXT_DIRECTUS_SERVER_URL: "http://127.0.0.1:8081",
            CONTENT_TRANSLATION_ENABLED: "true",
            NUXT_CONTENT_TRANSLATION_ENABLED: "true",
            DEEPL_API_KEY: "",
            NUXT_DEEPL_API_KEY: "",
            DEEPL_MODEL: "prefer_quality_optimized",
            NUXT_DEEPL_MODEL: "prefer_quality_optimized",
            DEEPL_GLOSSARY_EN: "",
            NUXT_DEEPL_GLOSSARY_EN: "",
            DEEPL_GLOSSARY_IT: "",
            NUXT_DEEPL_GLOSSARY_IT: "",
            DEEPL_POLICY_REVISION: "v1",
            NUXT_DEEPL_POLICY_REVISION: "v1",
          },
        },
      );
      child.stdout?.on("data", (chunk: Buffer) => {
        log = (log + chunk.toString()).slice(-100_000);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        log = (log + chunk.toString()).slice(-100_000);
      });
      for (let attempt = 0; attempt < 120; attempt++) {
        t.signal.throwIfAborted();
        if (child.exitCode !== null) throw new Error("Keyless frontend exited during startup");
        try {
          const response = await fetch(`${base}/api/public/climate-tools`, {
            signal: AbortSignal.any([t.signal, AbortSignal.timeout(1000)]),
          });
          if (response.ok) return;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("Keyless frontend did not become ready");
    };
    const id = randomUUID();
    const sourceTitle = `Deutsches Werkzeug ${id}`;
    const description = `Deutsche Beschreibung ${id}`;
    const namespace = deepLNamespace({});
    const rows: string[] = [];
    let toolCreated = false;
    const api = async (locale: string) => {
      const response = await fetch(`${base}/api/public/climate-tools?contentLocale=${locale}`, {
        signal: AbortSignal.any([t.signal, AbortSignal.timeout(15_000)]),
      });
      assert.equal(response.status, 200);
      const result = (await response.json()) as { tools: { id: string; title: string; description: string }[] };
      return result.tools.find((tool) => tool.id === id);
    };
    try {
      await start();
      await admin.createItem("climate_tools", {
        id,
        title: sourceTitle,
        description,
        status: "published",
        link: "https://example.org",
        category: "other",
        vendor: "Fixture",
      });
      toolCreated = true;
      for (const locale of ["en-GB", "it-IT"] as const)
        for (const [context, text] of [
          ["title", sourceTitle],
          ["description", description],
        ]) {
          const key = contentTranslationKey(namespace, locale, { text, format: "text", context });
          await admin.createItem("content_translation_memory", {
            id: key,
            namespace,
            kind: "field",
            locale,
            format: "text",
            state: "ready",
            translated_text: `${locale}|${text}`,
            reserved_characters: 0,
            billed_characters: 0,
            attempts: 0,
            updated_at: new Date().toISOString(),
          });
          rows.push(key);
        }
      assert.equal((await api("en-GB"))?.title, `en-GB|${sourceTitle}`);
      assert.equal((await api("it-IT"))?.title, `it-IT|${sourceTitle}`);
      assert.equal((await api("de-DE"))?.title, sourceTitle);
      const page = await fetch(`${base}/tools`, {
        headers: { cookie: "slk_locale=en-GB" },
        signal: AbortSignal.any([t.signal, AbortSignal.timeout(30_000)]),
      });
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.match(html, /Machine translated content may differ/);
      assert(html.includes(`en-GB|${sourceTitle}`));
      for (const secret of [
        front.DIRECTUS_FRONTEND_SERVER_TOKEN,
        front.CONTENT_TRANSLATION_WORKER_TOKEN,
        front.DIRECTUS_ADMIN_TOKEN,
      ])
        if (secret) assert(!html.includes(secret), "Private credentials must stay outside HTML/payloads");
      await stop();
      await start();
      assert.equal(
        (await api("en-GB"))?.title,
        `en-GB|${sourceTitle}`,
        "Prepared rows survive a frontend restart without generation",
      );
      await admin.updateItem("climate_tools", id, { title: `Korrigiert ${id}` });
      const changed = await api("en-GB");
      assert.equal(changed?.title, `Korrigiert ${id}`, "Changed field falls back independently");
      assert.equal(changed?.description, `en-GB|${description}`);
      await admin.updateItem("climate_tools", id, { title: sourceTitle });
      assert.equal(
        (await api("en-GB"))?.title,
        `en-GB|${sourceTitle}`,
        "Revert reuses stored field without another call",
      );
      await admin.updateItem("climate_tools", id, { status: "draft" });
      assert.equal(await api("en-GB"), undefined, "Retained memory never bypasses current publication checks");
      assert.match(log, /content.translation.generation_paused/);
      assert(!log.includes("content.translation.prepared"), "This acceptance server never generates translations");
    } finally {
      await stop();
      if (toolCreated) await admin.deleteItem("climate_tools", id).catch(() => {});
      for (const key of rows) await admin.deleteItem("content_translation_memory", key).catch(() => {});
    }
  },
);
