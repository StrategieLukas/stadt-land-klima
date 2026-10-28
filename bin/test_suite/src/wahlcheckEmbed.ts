import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { firefox, type Browser, type Page } from "playwright";
import { WahlcheckSchema } from "../../../src/frontend/shared/contracts/elections.js";
import { routeSlug } from "../../../src/frontend/shared/routeValues.js";
import { assert, assertEqual } from "./lib/assert.js";
import { collectPublicPageErrors, launchBrowser, newContext } from "./lib/browser.js";
import { waitFor } from "./lib/wait.js";

async function fittedHeight(page: Page): Promise<number> {
  return waitFor(
    "iframe height to fit its content without an internal scrollbar",
    async () => {
      if ((await page.locator("#wahlcheck").getAttribute("data-resized")) !== "true") return false;
      const height = await page.locator("#wahlcheck").evaluate((element) => element.clientHeight);
      const child = await page
        .frameLocator("#wahlcheck")
        .locator("main")
        .evaluate((element) => ({
          content: element.getBoundingClientRect().height,
          viewport: window.innerHeight,
          scroll: document.documentElement.scrollHeight,
          scrollY: window.scrollY,
        }));
      return Math.abs(height - child.content) <= 2 && child.scroll <= child.viewport + 1 && child.scrollY === 0
        ? height
        : false;
    },
    { intervalMs: 100 },
  );
}

/** Exercise the actual static parent and live checked API without recording a completion. */
export async function assertWahlcheckEmbed(
  browser: Browser,
  origin: string,
  slug: string,
  mode: "standard" | "blocked-storage" = "standard",
): Promise<void> {
  assert(routeSlug(slug), "Expected a municipality slug");
  const standalone = new URL(`/elections/wahlcheck/${slug}`, origin);
  const response = await fetch(new URL(`/api/public/wahlcheck/${slug}`, origin));
  assert(response.ok, `Public Wahlcheck data must load: HTTP ${response.status}`);
  const data = WahlcheckSchema.parse(await response.json());
  const question = data.questions[0];
  assert(question, "The published Wahlcheck needs at least one question");
  const html = readFileSync(new URL("../../wahlcheck-iframe/index.html", import.meta.url));
  const server = createServer((_request, output) => {
    output.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    output.end(html);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string", "Static test server needs a TCP port");
  const parent = new URL(`http://127.0.0.1:${address.port}`);
  parent.searchParams.set("url", standalone.href);
  const context = await newContext(browser);
  try {
    await context.addInitScript(() => {
      for (const name of ["error", "unhandledrejection"]) {
        window.addEventListener(name, () => {
          document.documentElement.dataset.embedRuntimeFailure = "true";
        });
      }
    });
    // Opening a result link is read-only; no production tracking or other writes are permitted.
    await context.route("**/*", async (route) => {
      if (["GET", "HEAD"].includes(route.request().method())) await route.continue();
      else await route.abort();
    });
    const page = await context.newPage();
    const failures = collectPublicPageErrors(page);
    const navigationResponse = await page.goto(parent.href, { waitUntil: "domcontentloaded" });
    assertEqual(navigationResponse?.status(), 200, "Static parent must load");
    const frame = page.frameLocator("#wahlcheck");
    if (mode === "blocked-storage") {
      const denied = await frame.locator("body").evaluate(() => {
        try {
          window.localStorage.getItem("slk_theme_preference");
          return false;
        } catch {
          return true;
        }
      });
      assert(denied, "Firefox must actually deny storage inside the frame");
    }
    await frame.locator(`input[name="question-${question.id}"]`).first().waitFor({ timeout: 30_000 });
    const questionHeight = await fittedHeight(page);
    if (mode === "standard") {
      await page.evaluate((childOrigin) => {
        const iframe = document.querySelector<HTMLIFrameElement>("#wahlcheck");
        if (!iframe) throw new Error("Missing iframe");
        // Valid-looking messages from the wrong window/origin and malformed heights
        // must never resize the host page.
        for (const event of [
          { origin: childOrigin, source: window, height: 9 },
          { origin: "https://untrusted.example", source: iframe.contentWindow, height: 9 },
          { origin: childOrigin, source: iframe.contentWindow, height: -1 },
          { origin: childOrigin, source: iframe.contentWindow, height: 1_000_001 },
        ]) {
          window.dispatchEvent(
            new MessageEvent("message", {
              origin: event.origin,
              source: event.source,
              data: { type: "slk:wahlcheck:resize", version: 1, height: event.height },
            }),
          );
        }
      }, standalone.origin);
      assertEqual(
        await page.locator("#wahlcheck").evaluate((element) => element.clientHeight),
        questionHeight,
        "Forged/malformed messages must not resize the frame",
      );
    }
    assertEqual(
      await frame.locator(".slk-header-surface, footer, #page-drawer").count(),
      0,
      "Embed excludes site chrome",
    );
    const initialViewport = page.viewportSize();
    assert(initialViewport, "The host needs a viewport");
    await page.setViewportSize({ width: 390, height: 844 });
    await fittedHeight(page);
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "The mobile host page must not overflow horizontally",
    );
    await page.setViewportSize(initialViewport);
    await fittedHeight(page);
    await frame.locator(`input[name="question-${question.id}"]`).first().check({ force: true });
    assert(await frame.locator(`input[name="question-${question.id}"]`).first().isChecked(), "Answer is selectable");

    // A shared result must survive the parent URL, render inside the embed, and copy a standalone link.
    const state = {
      electionId: data.election.id,
      answers: { [question.id]: 4 },
      doubleWeighted: [],
    };
    standalone.searchParams.set("share", Buffer.from(encodeURIComponent(JSON.stringify(state))).toString("base64"));
    parent.searchParams.set("url", standalone.href);
    if (mode === "standard") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: parent.origin });
      await context.grantPermissions(["clipboard-write"], { origin: standalone.origin });
    }
    await page.goto(parent.href, { waitUntil: "domcontentloaded" });
    const results = page.frameLocator("#wahlcheck");
    await results.getByTestId("wahlcheck-results-overview").waitFor({ timeout: 30_000 });
    const resultHeight = await fittedHeight(page);
    assertEqual(
      await results.locator(".slk-header-surface, footer, #page-drawer").count(),
      0,
      "Results exclude site chrome",
    );
    if (mode === "standard") {
      await results.getByRole("button", { name: "Link kopieren", exact: true }).click();
      const copiedValue = await waitFor(
        "clipboard to receive the standalone result link",
        async () => {
          const value = await page.evaluate(() => navigator.clipboard.readText());
          return value.startsWith(standalone.origin) ? value : false;
        },
        { intervalMs: 100, timeoutMs: 5_000 },
      );
      const copied = new URL(copiedValue);
      assertEqual(copied.origin, standalone.origin, "Copied result keeps its origin");
      assertEqual(copied.pathname, standalone.pathname, "Copied result opens the normal public page");
      assert(copied.searchParams.has("share"), "Copied result retains answers");
    }
    await results.getByTestId("wahlcheck-result-toggle").first().click();
    await results.getByTestId("wahlcheck-match-details").waitFor({ timeout: 10_000 });
    await fittedHeight(page);
    const reasoning = results.getByRole("button", { name: /Begründung|Keine Begründung/ }).first();
    await reasoning.click();
    const viewport = page.viewportSize();
    assert(viewport, "The host needs a viewport");
    await waitFor(
      "explanation dialog to stay in the visible host viewport",
      async () => {
        const box = await results.locator("dialog[open] .modal-box").boundingBox();
        return box && box.y >= -1 && box.y + box.height <= viewport.height + 1;
      },
      { intervalMs: 100, timeoutMs: 5_000 },
    );
    await page.keyboard.press("Escape");
    await results.getByRole("button", { name: "Neu starten", exact: true }).click();
    await results.locator(`input[name="question-${question.id}"]`).first().waitFor({ timeout: 10_000 });
    const restartedHeight = await fittedHeight(page);
    assert(restartedHeight < resultHeight, "Restart shrinks the iframe after the long results view");
    await waitFor(
      "step navigation to scroll the host rather than the iframe",
      async () => {
        const top = await page.locator("#wahlcheck").boundingBox();
        return top && Math.abs(top.y) < 300;
      },
      { intervalMs: 100 },
    );
    assertEqual(
      await results.locator("html").getAttribute("data-embed-runtime-failure"),
      null,
      "Startup and shared results must not throw even when browser storage is blocked",
    );
    assertEqual(failures.length, 0, "Embed must have no runtime or public API errors: " + failures.join("; "));

    const normalPage = await context.newPage();
    const normalResponse = await normalPage.goto(new URL(standalone.pathname, origin).href, {
      waitUntil: "domcontentloaded",
    });
    assertEqual(normalResponse?.status(), 200, "Normal Wahlcheck still renders");
    await normalPage.locator(".slk-header-surface").first().waitFor({ timeout: 30_000 });
  } finally {
    await context.close();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = new URL(process.argv[2] ?? "http://localhost:8080");
  assert(["http:", "https:"].includes(target.protocol) && !target.username && !target.password, "Expected HTTP(S)");
  const browser = await launchBrowser(true);
  try {
    await assertWahlcheckEmbed(browser, target.origin, process.argv[3] ?? "nettetal");
    console.log("Wahlcheck embed: questions, shared results, clipboard and standalone layout passed.");
  } finally {
    await browser.close();
  }
  const restrictedBrowser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: { "network.cookie.cookieBehavior": 2 },
  });
  try {
    await assertWahlcheckEmbed(restrictedBrowser, target.origin, process.argv[3] ?? "nettetal", "blocked-storage");
    console.log("Wahlcheck embed: Firefox with cookies/storage blocked loads questions and shared results.");
  } finally {
    await restrictedBrowser.close();
  }
}
