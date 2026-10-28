import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as seo from "../../../src/frontend/shared/seo.js";
import { seoMessages } from "../../../src/frontend/shared/seoMessages.js";
import type { EditorBlock } from "../../../src/frontend/shared/editorBlocks.js";
import type { Locale } from "../../../src/frontend/shared/i18n.js";

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const vue = frontend("vue") as typeof import("../../../src/frontend/node_modules/vue/dist/vue.d.mts");
const unhead = frontend(
  "@unhead/vue",
) as typeof import("../../../src/frontend/node_modules/@unhead/vue/dist/index.d.mts");
const { createHead, renderSSRHead } = frontend(
  "@unhead/vue/server",
) as typeof import("../../../src/frontend/node_modules/@unhead/vue/dist/server.d.mts");
const { renderToString } = frontend(
  "@vue/server-renderer",
) as typeof import("../../../src/frontend/node_modules/@vue/server-renderer/dist/server-renderer.d.ts");

function loadComposables(route: { path: string; query: Record<string, unknown> }, locale: Locale) {
  const source = readFileSync(new URL("../../../src/frontend/composables/usePageSeo.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} as { useSiteSeo(): void; usePageSeo(options: unknown): void } };
  const dependencies: Record<string, unknown> = {
    vue,
    "#imports": {
      ...unhead,
      useRoute: () => route,
      useRuntimeConfig: () => ({
        public: { siteUrl: "https://future.stadt-land-klima.de", clientDirectusUrl: "/backend" },
      }),
      useNuxtApp: () => ({ $locale: locale, $t: (key: string) => key }),
    },
    "~/shared/seo": seo,
    "~/shared/seoMessages": { seoMessages },
    "~/assets/images/Stadt-Land-Klima-Logo_quad_bordered.png": "/_nuxt/logo.png",
  };
  runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    URL,
    URLSearchParams,
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}

async function renderMetadata(
  path: string,
  options: unknown = {},
  locale: Locale = "de-DE",
  query: Record<string, unknown> = {},
) {
  const head = createHead();
  head.push({ link: [{ rel: "stylesheet", href: "/app.css" }], style: [{ textContent: "x".repeat(40_000) }] });
  const hooks = loadComposables({ path, query }, locale);
  const page = {
    setup() {
      hooks.usePageSeo(options);
      return () => vue.h("main", "Public page");
    },
  };
  const app = vue.createSSRApp({
    setup() {
      hooks.useSiteSeo();
      return () => vue.h(page);
    },
  });
  app.use(head);
  await renderToString(app);
  return (await renderSSRHead(head)).headTags;
}

function meta(html: string, key: string): string {
  const tags = html.match(/<meta\b[^>]+>/g) ?? [];
  const matches = tags.filter((tag) => tag.includes(`="${key}"`));
  assert.equal(matches.length, 1, `Exactly one ${key}`);
  return (matches[0]?.match(/content="([^"]*)"/)?.[1] ?? "").replaceAll("&amp;", "&");
}

test("crawler SSR includes localized, deduplicated previews without JavaScript or CMS translations", async () => {
  for (const locale of ["de-DE", "en-GB", "it-IT"] as const) {
    const html = await renderMetadata("/", {}, locale);
    assert.ok(
      html.indexOf('property="og:title"') < html.indexOf('rel="stylesheet"'),
      "Crawler metadata precedes large styles/preloads",
    );
    assert.equal(meta(html, "description"), seoMessages[locale]["seo.description"]);
    assert.equal(meta(html, "og:description"), meta(html, "description"));
    assert.equal(meta(html, "twitter:description"), meta(html, "description"));
    assert.equal(meta(html, "og:title"), `${seoMessages[locale]["seo.title"]} - ${seo.SITE_NAME}`);
    assert.equal(meta(html, "twitter:title"), meta(html, "og:title"));
    assert.equal(meta(html, "og:locale"), locale.replace("-", "_"));
    assert.equal(meta(html, "og:image"), "https://future.stadt-land-klima.de/_nuxt/logo.png");
    assert.equal(meta(html, "twitter:card"), "summary");
    assert.ok(!html.includes("Description") && !html.includes("seo.description"));
  }
});

test("public detail SSR uses checked CMS text and public raster images with matching canonical and OG URLs", async () => {
  const html = await renderMetadata(
    "/news/klimaschutz/",
    {
      title: "Klimaschutz & Kommunen",
      description: "<p>Mehr <strong>Klimaschutz</strong>.</p><p>Jetzt mitmachen!</p>",
      image: { id: "56a814bb-fac4-4b80-88d7-a6fc8bd71580", type: "image/jpeg" },
      type: "article",
    },
    "de-DE",
    { utm_source: "telegram", v: "2026" },
  );
  assert.match(html, /<title>Klimaschutz &(?:amp;)? Kommunen - Stadt.Land.Klima!<\/title>/);
  assert.equal(meta(html, "og:title"), "Klimaschutz & Kommunen - Stadt.Land.Klima!");
  assert.equal(meta(html, "description"), "Mehr Klimaschutz. Jetzt mitmachen!");
  assert.equal(meta(html, "og:type"), "article");
  assert.equal(meta(html, "og:url"), "https://future.stadt-land-klima.de/news/klimaschutz?v=2026");
  assert.match(html, /rel="canonical" href="https:\/\/future.stadt-land-klima.de\/news\/klimaschutz\?v=2026"/);
  assert.equal(
    meta(html, "og:image"),
    "https://future.stadt-land-klima.de/backend/assets/56a814bb-fac4-4b80-88d7-a6fc8bd71580?width=1200&height=630&fit=cover&format=jpg",
  );
  assert.equal(meta(html, "og:image:width"), "1200");
  assert.equal(meta(html, "twitter:card"), "summary_large_image");
});

test("section defaults and isolated requests do not reuse another page's title or image", async () => {
  const [projects, news] = await Promise.all([
    renderMetadata("/projects", { title: "Projekte" }),
    renderMetadata("/news", { title: "Neuigkeiten" }),
  ]);
  assert.equal(meta(projects, "description"), seoMessages["de-DE"]["seo.projects.description"]);
  assert.equal(meta(news, "description"), seoMessages["de-DE"]["seo.news.description"]);
  assert.equal(meta(news, "og:title"), "Neuigkeiten - Stadt.Land.Klima!");
});

test("preview/candidate URLs emit no canonical or secret-bearing social identifiers and only generic sharing text", async () => {
  for (const [path, query] of [
    ["/elections/thesen/secret-token", {}],
    ["/news/draft", { preview: "secret-token" }],
    ["/news/draft", { blokkliPreview: "1" }],
  ] as const) {
    const html = await renderMetadata(
      path,
      { title: "Private draft title", description: "Private draft prose" },
      "de-DE",
      query,
    );
    assert.equal(meta(html, "robots"), "noindex, nofollow, noarchive");
    assert.equal(meta(html, "og:title"), seo.SITE_NAME);
    assert.equal(meta(html, "og:description"), seoMessages["de-DE"]["seo.description"]);
    assert.ok(
      !html.includes('rel="canonical"') &&
        !html.includes('property="og:url"') &&
        !html.includes("secret-token") &&
        !html.includes("Private draft prose"),
    );
  }
});

test("metadata prose preserves Unicode and word boundaries while discarding markup, scripts and CMS placeholders", () => {
  assert.equal(
    seo.metadataText(
      "<p>Äußere Wärme &amp; Klimaschutz</p><script>secret()</script><p>[[[ONBOARDING_BOX]]] für Kommunen</p>",
    ),
    "Äußere Wärme & Klimaschutz für Kommunen",
  );
  const value = seo.metadataText("🌍 Kommunaler Klimaschutz ".repeat(40));
  assert.ok(Array.from(value).length <= 180 && value.endsWith("…") && !value.includes("\ufffd"));
  assert.equal(seo.metadataText('<img src="x" onerror="alert(1)">'), "");
  assert.equal(seo.metadataTitle(seo.SITE_NAME), seo.SITE_NAME);
  assert.equal(seo.metadataTitle(`Titel - ${seo.SITE_NAME}`), `Titel - ${seo.SITE_NAME}`);
});

test("CMS pages derive summaries from prose blocks, ignoring actions, embeds, forms and private references", () => {
  const blocks = [
    { bundle: "button", props: { label: "Login" } },
    {
      bundle: "container",
      props: { blocks: [{ bundle: "richtext", props: { content: "<p>Gemeinsam Klimaschutz gestalten.</p>" } }] },
    },
    { bundle: "form", props: { description: "Private form introduction" } },
  ] as EditorBlock[];
  assert.equal(seo.contentDescription(null, blocks), "Gemeinsam Klimaschutz gestalten.");
  assert.equal(seo.contentDescription("<p>Legacy content</p>", blocks), "Legacy content");
});

test("canonical origins and raster URLs reject credentials, arbitrary asset URLs and query injection", () => {
  assert.equal(seo.resolveSiteOrigin("https://user:secret@example.com"), "https://stadt-land-klima.de");
  assert.equal(seo.resolveSiteOrigin("javascript:alert(1)"), "https://stadt-land-klima.de");
  assert.equal(
    seo.canonicalUrl("https://stadt-land-klima.de", "//evil.example/path", { token: "secret", v: ["2025", "2026"] }),
    "https://stadt-land-klima.de//evil.example/path",
  );
  assert.equal(
    seo.socialAssetUrl("/backend", "https://evil.example/private?token=secret", "https://stadt-land-klima.de"),
    null,
  );
  assert.equal(
    seo.socialAssetUrl(
      "https://user:secret@example.com",
      "56a814bb-fac4-4b80-88d7-a6fc8bd71580",
      "https://stadt-land-klima.de",
    ),
    null,
  );
  assert.equal(
    seo.socialAssetUrl(
      "/backend",
      { id: "56a814bb-fac4-4b80-88d7-a6fc8bd71580", type: "image/svg+xml" },
      "https://stadt-land-klima.de",
    ),
    null,
  );
});
