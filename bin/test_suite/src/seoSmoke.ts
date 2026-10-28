import assert from "node:assert/strict";
import { launchBrowser, waitForHydration } from "./lib/browser.js";
import { ProjectListSchema, NewsListSchema, EventSchema } from "../../../src/frontend/shared/contracts/content.js";
import { SiteLayoutSchema } from "../../../src/frontend/shared/contracts/navigation.js";

/** Read-only acceptance against the actual Nuxt server, including JS-disabled crawler requests. */
const target = new URL(process.argv[2] ?? "http://localhost:8080");
assert.ok(["http:", "https:"].includes(target.protocol) && !target.username && !target.password);
const base = target.origin;
const browser = await launchBrowser(true);
const crawler = await browser.newContext({
  javaScriptEnabled: false,
  locale: "de-DE",
  userAgent: "TelegramBot (like TwitterBot)",
  serviceWorkers: "block",
});
try {
  const page = await crawler.newPage();
  const paths = ["/", "/news", "/measures", "/projects", "/spenden"];
  const projectResponse: { articles?: unknown } = await (
    await crawler.request.get(`${base}/api/public/articles?limit=100`)
  ).json();
  const projects = ProjectListSchema.array().parse(projectResponse.articles);
  // Historic disposable fixture images can be deliberately malformed; prefer actual published content.
  const project = projects.find((item) => !item.slug.startsWith("automated-")) ?? projects[0];
  if (project) paths.push(`/projects/${project.slug}`);
  const newsResponse: { news?: unknown; events?: unknown } = await (
    await crawler.request.get(`${base}/api/public/news`)
  ).json();
  const news = NewsListSchema.array().parse(newsResponse.news)[0];
  if (news) paths.push(`/news/${news.slug}`);
  const eventsResponse: { events?: unknown } = await (
    await crawler.request.get(`${base}/api/public/events?limit=1`)
  ).json();
  const event = EventSchema.array().parse(eventsResponse.events)[0];
  if (event) paths.push(`/events/${event.slug}`);
  for (const path of paths) {
    const response = await page.goto(`${base}${path}?utm_source=telegram`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `${path}: public SSR`);
    const html = await response!.text();
    assert.ok(html.indexOf('property="og:title"') < 8192, `${path}: preview tags precede large styles/preloads`);
    const read = async (key: string) => {
      const tag = page.locator(`head meta[name="${key}"],head meta[property="${key}"]`);
      assert.equal(await tag.count(), 1, `${path}: one ${key}`);
      return await tag.getAttribute("content");
    };
    const description = await read("description");
    assert.ok(
      description && description.length > 0 && !description.includes(" Description") && !description.includes("seo."),
      `${path}: useful summary`,
    );
    assert.equal(await read("og:description"), description);
    assert.equal(await read("twitter:description"), description);
    assert.equal(await read("og:title"), await page.title());
    assert.equal(await read("twitter:title"), await page.title());
    const canonical = await page.locator('head link[rel="canonical"]').getAttribute("href");
    assert.ok(canonical && new URL(canonical).pathname === path && !new URL(canonical).search);
    assert.equal(await read("og:url"), canonical);
    const image = await read("og:image");
    assert.ok(image && /^https?:/.test(image));
    const imageResponse = await crawler.request.get(image);
    assert.equal(imageResponse.status(), 200, `${path}: anonymous preview image`);
    assert.match(imageResponse.headers()["content-type"] ?? "", /^image\//);
    console.log(`PASS crawler SSR: ${path}`);
  }
  const preview = await page.goto(`${base}/?blokkliPreview=1&preview_token=seo-test-sentinel`, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(preview?.status(), 200);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow, noarchive");
  assert.equal(await page.locator('head link[rel="canonical"],head meta[property="og:url"]').count(), 0);
  assert.ok(!(await page.locator("head").innerHTML()).includes("seo-test-sentinel"));

  const missing = await page.goto(`${base}/seo-missing-page-issue-123`, { waitUntil: "domcontentloaded" });
  assert.equal(missing?.status(), 404);
  assert.match((await page.locator('head meta[name="robots"]').getAttribute("content")) ?? "", /noindex/);
  const sitemap = await crawler.request.get(`${base}/sitemap.xml`);
  assert.equal(sitemap.status(), 200);
  assert.match(sitemap.headers()["content-type"] ?? "", /xml/);
  const sitemapText = await sitemap.text();
  const urls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((entry) => new URL(entry[1]!));
  assert.ok(
    urls.length > 10 && urls.every((url) => !url.search && !url.hash && !url.pathname.startsWith("/elections/thesen")),
  );
  assert.equal(new Set(urls.map((url) => url.href)).size, urls.length);
  assert.equal(new Set(urls.map((url) => url.origin)).size, 1);
  const sitemapOrigin = urls[0]!.origin;
  const layout = SiteLayoutSchema.parse(await (await crawler.request.get(`${base}/api/public/site-layout`)).json());
  for (const item of layout.pages) {
    if (item.slug && item.slug !== "index")
      assert.ok(urls.some((url) => url.pathname === `/${encodeURIComponent(item.slug)}`));
  }
  const robots = await crawler.request.get(`${base}/robots.txt`);
  assert.equal(robots.status(), 200);
  assert.ok((await robots.text()).includes(`Sitemap: ${sitemapOrigin}/sitemap.xml`));
  const aiRegister = await crawler.request.get(`${base}/ki`);
  assert.equal(aiRegister.status(), 200);
  assert.ok((await aiRegister.text()).includes(`rel="canonical" href="${sitemapOrigin}/ki"`));
  console.log("PASS configured robots/sitemap and preview exclusions");

  const context = await browser.newContext({ locale: "de-DE", serviceWorkers: "block" });
  const interactive = await context.newPage();
  await interactive.goto(`${base}/`);
  await waitForHydration(interactive);
  for (const path of ["/projects", "/municipalities"]) {
    await interactive.locator(`a[href="${path}"]`).first().click();
    await interactive.waitForURL(`${base}${path}`);
    await interactive.waitForFunction((expectedPath) => {
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
      return canonical && new URL(canonical).pathname === expectedPath;
    }, path);
    await interactive.waitForFunction(
      () => document.querySelector('meta[property="og:title"]')?.getAttribute("content") === document.title,
    );
    assert.equal(await interactive.locator('head meta[name="description"]').count(), 1);
    assert.equal(
      await interactive.locator('head meta[property="og:description"]').getAttribute("content"),
      await interactive.locator('head meta[name="description"]').getAttribute("content"),
    );
    assert.equal(
      new URL((await interactive.locator('head link[rel="canonical"]').getAttribute("href"))!).pathname,
      path,
    );
    console.log(`PASS hydrated navigation: ${path}`);
  }
  await context.close();
} finally {
  await crawler.close();
  await browser.close();
}
