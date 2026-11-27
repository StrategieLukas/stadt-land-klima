import type { PublicJobDetail } from "./contracts/jobs";
import type { Locale, TranslationParams } from "./i18n";
import { jobCompensation } from "./jobCompensation";
import { jobShareMessages } from "./jobShareMessages";
import { canonicalUrl, metadataText } from "./seo";

export const JOB_SHARE_FORMATS = {
  story: { width: 1080, height: 1920, left: 72, top: 288, right: 72, bottom: 672 },
  feed: { width: 1080, height: 1350, left: 72, top: 72, right: 72, bottom: 72 },
  link: { width: 1200, height: 630, left: 48, top: 36, right: 48, bottom: 36 },
} as const;
export type JobShareFormat = keyof typeof JOB_SHARE_FORMATS;
export type JobShareMessageKey = keyof (typeof jobShareMessages)["de-DE"];

/** Bundled YAML-derived labels also work for crawlers and before a CMS import. */
export function jobShareText(locale: Locale, key: JobShareMessageKey, params: TranslationParams = {}): string {
  let message: string = jobShareMessages[locale][key];
  for (const [placeholder, value] of Object.entries(params))
    message = message.replaceAll(placeholder, String(value ?? ""));
  return message;
}

function calendarDate(value: string | null): Date | null {
  const date = value?.match(/^\d{4}-\d{2}-\d{2}(?:$|T)/)?.[0].replace(/T$/, "");
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? parsed : null;
}

export function jobSharePeriod(job: Pick<PublicJobDetail, "start_date" | "end_date">, locale: Locale): string {
  if (!job.start_date) return jobShareText(locale, "jobs.date.flexible");
  const start = calendarDate(job.start_date);
  const end = calendarDate(job.end_date);
  if (!start || (job.end_date && (!end || end < start))) return "";
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(value);
  if (end && end.getTime() !== start.getTime()) return `${date(start)} – ${date(end)}`;
  return jobShareText(locale, "jobs.share.from", { ":date": date(start) });
}

export function resolveJobShareContent(job: PublicJobDetail, locale: Locale, siteUrl: string, excerpt = "") {
  const compensation = jobCompensation(job);
  const url = canonicalUrl(siteUrl, `/jobs/${job.slug}`, {});
  const title = metadataText(job.role_title, 280) || jobShareText(locale, "jobs.title");
  const organisation = metadataText(job.organisation?.name, 160);
  const type = jobShareText(locale, `jobs.type.${job.type}`);
  const hours = metadataText(job.weekly_hours, 100);
  const pay = compensation ? metadataText(compensation.value, 140) : "";
  const period = jobSharePeriod(job, locale);
  const cta = jobShareText(locale, job.type === "volunteer" ? "jobs.share.volunteer_cta" : "jobs.share.cta");
  return {
    title,
    organisation,
    type,
    hours,
    pay,
    period,
    cta,
    url,
    family:
      job.type === "volunteer"
        ? ("volunteer" as const)
        : ["internship", "working_student"].includes(job.type)
          ? ("earlyCareer" as const)
          : ("employment" as const),
    hoursLabel: jobShareText(locale, "jobs.weekly_hours"),
    payLabel: compensation ? jobShareText(locale, compensation.label) : "",
    periodLabel: jobShareText(locale, "jobs.period"),
    excerpt: metadataText(excerpt, 220),
    caption: [title, organisation, type, [hours, pay].filter(Boolean).join(" · "), period, cta, url]
      .filter(Boolean)
      .join("\n"),
  };
}
export type JobShareContent = ReturnType<typeof resolveJobShareContent>;

export function jobShareImagePath(slug: string, locale: Locale, format: JobShareFormat): string {
  return `/api/public/jobs/${encodeURIComponent(slug)}/social-image?${new URLSearchParams({ format, lang: locale })}`;
}

export function jobShareLinks(url: string, caption: string) {
  return {
    whatsapp: `https://api.whatsapp.com/send?${new URLSearchParams({ text: caption })}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`,
  };
}
