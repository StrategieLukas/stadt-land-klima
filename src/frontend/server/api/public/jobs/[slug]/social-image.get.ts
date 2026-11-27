import { createHash } from "node:crypto";
import MarkdownIt from "markdown-it";
import {
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  getRouterParam,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import { JobsDetailResponseSchema } from "~/shared/contracts/jobs";
import { locales } from "~/shared/i18n";
import { resolveJobShareContent } from "~/shared/jobSharing";
import { metadataText } from "~/shared/seo";
import { jobShareFont, jobShareLogo } from "~/server/utils/jobShareAssets";
import { JOB_IMAGE_REVISION, renderJobShareImage } from "~/server/utils/jobShareImage";
import { createJobImageCache } from "~/server/utils/jobShareImageCache";
import { queryChoice } from "~/server/utils/publicQuery";
import { rateLimit } from "~/server/utils/rateLimit";

const cachedImage = createJobImageCache();
const markdown = new MarkdownIt({ html: false });

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");
  if (!(await rateLimit(event, "job-social-image")))
    throw createError({ statusCode: 429, statusMessage: "Too many image requests" });
  const slug = getRouterParam(event, "slug") ?? "";
  const query = getQuery(event);
  if (!/^[a-z0-9-]{1,160}$/.test(slug) || Object.keys(query).some((key) => !["format", "lang"].includes(key)))
    throw createError({ statusCode: 400, statusMessage: "Invalid job image request" });
  const format = queryChoice(query.format, ["story", "feed", "link"] as const, "link") ?? "link";
  const locale = queryChoice(query.lang, locales, "de-DE") ?? "de-DE";
  // Reuse checked, publication-filtered data and its read-only prepared translations.
  // This happens before every render-cache hit, including conditional requests.
  const parsed = JobsDetailResponseSchema.safeParse(
    await event.$fetch(`/api/public/jobs/${slug}`, { query: { contentLocale: locale } }),
  );
  if (!parsed.success) throw createError({ statusCode: 502, statusMessage: "Invalid job response" });
  const detail = parsed.data;
  const excerpt = metadataText(markdown.render((detail.job.tasks || detail.job.benefits || "").slice(0, 10_000)), 220);
  const content = resolveJobShareContent(detail.job, locale, useRuntimeConfig().public.siteUrl, excerpt);
  const logo = await jobShareLogo(detail.job.organisation?.logo?.id);
  const key = createHash("sha256")
    .update(JSON.stringify({ content, format, revision: JOB_IMAGE_REVISION }))
    .update(logo ?? "")
    .digest("hex");
  const png = await cachedImage(key, async () => {
    const brand = await useStorage("assets:job-brand").getItemRaw<Buffer>("Stadt-Land-Klima-Logo.svg");
    if (!brand) throw new Error("Job sharing logo unavailable");
    return renderJobShareImage(content, format, await jobShareFont(), brand.toString("utf8"), logo);
  });
  const etag = `"${createHash("sha256").update(png).digest("hex")}"`;
  setResponseHeader(event, "Content-Type", "image/png");
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  setResponseHeader(event, "Cache-Control", "public, max-age=60, must-revalidate");
  setResponseHeader(event, "ETag", etag);
  setResponseHeader(event, "Content-Disposition", `inline; filename="job-${slug.slice(0, 80)}-${format}.png"`);
  if (getHeader(event, "if-none-match") === etag) {
    setResponseStatus(event, 304);
    return null;
  }
  return png;
});
