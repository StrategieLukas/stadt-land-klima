/** Disposable local UI fixture; never contacts DeepL or writes to a remote CMS. */
import assert from "node:assert/strict";
import { loadConfig } from "./lib/config.js";
import { createAdminClient } from "./lib/directus.js";
import { launchBrowser } from "./lib/browser.js";

const config = loadConfig(process.argv.slice(2));
for (const target of [config.backendUrl, config.frontendUrl]) {
  const url = new URL(target);
  assert(
    ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password,
    "This writable fixture supports loopback targets only",
  );
}
const admin = await createAdminClient(config.backendUrl, config.env);
const slug = `test-image-buttons-${Date.now().toString(36)}`;
const id = "6e20397d-50b3-46fe-be6e-4fa425c65eb5";
const content = `<h1>Legacy action fixture</h1><table><tr><td><a id="join-cta" href="/mitmachen"><img src="https://www.stadt-land-klima.de/backend/assets/${id}" alt="German artwork"></a></td></tr></table>`;
const fixture = await admin.createItem<{ id: string; slug: string; status: string }>("pages", {
  name: "Legacy action fixture",
  slug,
  contents: content,
  status: "published",
});
const browser = await launchBrowser(config.headless);
try {
  for (const [locale, label] of [
    ["de-DE", "Klimachecker:in werden"],
    ["en-GB", "Become a climate checker"],
    ["it-IT", "Diventa un controllore del clima"],
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      await context.addCookies([{ name: "slk_locale", value: locale!, url: config.frontendUrl }]);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("console", (message) => {
        if (/hydration.*(?:mismatch|error)|mismatch.*hydration/i.test(message.text())) errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto(`${config.frontendUrl}/${fixture.slug}`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      const button = page.locator("#join-cta");
      assert.equal(await page.getByRole("link", { name: label, exact: true }).count(), 1);
      assert.match((await button.getAttribute("class")) ?? "", /canonical-button/);
      assert.equal(await button.getAttribute("href"), "/mitmachen");
      assert.equal(await page.locator(`img[src*="${id}"]`).count(), 0);
      assert.equal(await page.locator("article table tbody tr").count(), 1);
      assert.deepEqual(errors, [], "SSR/client hydration must preserve table and button markup");
      process.stdout.write(`${locale}: translated canonical button and table hydration passed\n`);
    } finally {
      await context.close();
    }
  }
  const stored = await admin.request<{ contents: string }>("GET", `/items/pages/${fixture.id}`);
  assert.equal(stored.contents, content, "Rendering must never migrate or overwrite editor source HTML");
} finally {
  await browser.close();
  await admin.deleteItem("pages", fixture.id);
}
