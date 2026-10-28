import { defineEventHandler, setResponseHeader } from "h3";
import { resolveSiteOrigin } from "~/shared/serviceUrl";

export default defineEventHandler((event) => {
  const origin = resolveSiteOrigin(useRuntimeConfig().public.siteUrl);
  setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=300");
  // Public pages remain crawlable, including noindex preview responses.
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
});
