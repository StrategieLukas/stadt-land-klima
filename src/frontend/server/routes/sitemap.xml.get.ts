import { defineEventHandler, setResponseHeader } from "h3";
import { SiteLayoutSchema } from "~/shared/contracts/navigation";
import { canonicalUrl } from "~/shared/seo";

export default defineEventHandler(async (event) => {
  // Reuse the checked, published-only contract; never read authenticated editor content.
  const { pages } = SiteLayoutSchema.parse(await $fetch("/api/public/site-layout", { timeout: 5000 }));
  const paths = new Set([
    "/",
    "/ki",
    "/municipalities",
    "/measures",
    "/projects",
    "/events",
    "/news",
    "/stats",
    "/map",
    "/data",
    "/jobs",
    "/organisation",
    "/contact",
    "/tools",
    "/spenden",
    "/elections/wahlcheck",
    ...pages.filter((page) => page.slug && page.slug !== "index").map((page) => `/${encodeURIComponent(page.slug)}`),
  ]);
  const origin = useRuntimeConfig().public.siteUrl;
  const urls = [...paths].map(
    (path) =>
      `<url><loc>${canonicalUrl(origin, path, {}).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;")}</loc></url>`,
  );
  setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=300");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
});
