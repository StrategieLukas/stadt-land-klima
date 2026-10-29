import assert from "node:assert/strict";
import { launchBrowser, waitForHydration, collectPublicPageErrors } from "./lib/browser.js";
import { waitFor } from "./lib/wait.js";
import { MunicipalityUpdatesSchema } from "../../../src/frontend/shared/contracts/municipalityUpdates.js";

const base = new URL(process.argv[2] ?? "http://localhost:8080").origin;
const history = await waitFor(
  "public frontend readiness",
  async () => {
    const response = await fetch(`${base}/api/public/municipality-updates`);
    return response.ok ? MunicipalityUpdatesSchema.parse(await response.json()) : false;
  },
  { timeoutMs: 60_000, intervalMs: 2_000 },
);
const initial = history.updates[0];
assert.ok(initial, "Seed at least one complete published assessment before running UX acceptance");
const browser = await launchBrowser(true);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = collectPublicPageErrors(page);
  const detail = `${base}/municipalities/${initial.municipality.slug}?v=${encodeURIComponent(initial.catalog)}`;
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(detail, { waitUntil: "networkidle" });
    await waitForHydration(page);
    const canvas = page.locator('[data-testid="municipality-polar-chart"] canvas:visible').first();
    await canvas.waitFor();
    await waitFor("first-load chart renders visible sectors", () =>
      canvas.evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        return (
          canvas.width > 50 &&
          canvas.height > 50 &&
          canvas
            .getContext("2d")!
            .getImageData(0, 0, canvas.width, canvas.height)
            .data.some((value, index) => index % 4 === 3 && value > 0)
        );
      }),
    );
    const group = page.getByRole("radiogroup", { name: "Darstellung" }).filter({ visible: true }).first();
    await group.getByRole("radio").first().focus();
    await page.keyboard.press("End");
    await waitFor(
      "toggle selects treemap",
      async () => (await group.getByRole("radio").last().getAttribute("aria-checked")) === "true",
    );
    await page.keyboard.press("Home");
    await canvas.waitFor();
    assert.equal(await group.getByRole("radio", { checked: true }).count(), 1);
    await page.screenshot({ path: `/tmp/slk-municipality-ux-${viewport.width}.png`, fullPage: false });
    const pdfResponse = context.waitForEvent("response", {
      predicate: (response) =>
        response.request().method() === "POST" && response.url().includes("/api/pdf/municipality/"),
      timeout: 90_000,
    });
    const viewerPromise = context.waitForEvent("page");
    await page.getByRole("button", { name: "PDF", exact: true }).first().click();
    const viewer = await viewerPromise;
    const pdf = await pdfResponse;
    assert.equal(pdf.status(), 200);
    assert.ok(pdf.request().isNavigationRequest());
    assert.match(
      pdf.headers()["content-disposition"] ?? "",
      /^inline; filename="StadtLandKlima-Bewertung_.+_vom-\d{4}-\d{2}-\d{2}\.pdf"/,
    );
    assert.equal(pdf.headers()["content-type"], "application/pdf");
    assert.ok(Number(pdf.headers()["content-length"]) > 1_000);
    await viewer.close();
  }
  const imageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
  assert.ok(imageUrl);
  assert.ok(imageUrl.includes("/social-image?"));
  const response = await fetch(imageUrl);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  const png = Buffer.from(await response.arrayBuffer());
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.equal(
    (
      await fetch(
        `${base}/api/public/municipalities/${initial.municipality.slug}/social-image?v=unknown-private-version`,
      )
    ).status,
    404,
  );
  for (const path of ["news", "events"]) {
    await page.goto(`${base}/${path}`, { waitUntil: "networkidle" });
    await waitForHydration(page);
    await page.evaluate(() => window.scrollTo(0, 650));
    await waitFor("timeline sticks to visible header", () =>
      page
        .locator("nav.sticky:visible")
        .first()
        .evaluate(
          (nav) => Math.abs(nav.getBoundingClientRect().top - Number.parseFloat(getComputedStyle(nav).top)) < 2,
        ),
    );
    const geometry = await page
      .locator("nav.sticky:visible")
      .first()
      .evaluate((nav) => ({
        left: nav.getBoundingClientRect().left,
        width: nav.getBoundingClientRect().width,
        viewport: nav.closest("main")!.getBoundingClientRect().width,
      }));
    assert.equal(geometry.left, 0);
    assert.equal(geometry.width, geometry.viewport);
    await page.screenshot({ path: `/tmp/slk-timeline-${path}.png` });
  }
  const news = (await (await fetch(`${base}/api/public/news`)).json()) as Record<string, unknown>;
  assert.equal("municipalities" in news, false);
  await page.goto(`${base}/municipalities/updates`, { waitUntil: "networkidle" });
  await waitForHydration(page);
  await page.getByRole("heading", { name: "Bewertungsverlauf", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    "PASS native PDF documents with descriptive filenames on desktop/mobile, first-load polar charts on desktop/mobile, keyboard toggle group, real sector PNG, private image exclusion, history page and mobile timeline geometry",
  );
} finally {
  await browser.close();
}
