import type { Locale } from "./i18n";

export const CONTENT_LOCALE_QUERY = "contentLocale";
export const CONTENT_SOURCE_LOCALE: Locale = "de-DE";
export type ContentFormat = "text" | "html" | "markdown";
export type ContentField = { path: string; format: ContentFormat; context?: string };
export type ContentTranslationPolicy = {
  fields: readonly ContentField[];
  blocks?: boolean;
  navigation?: boolean;
};

const fields = (prefix: string, format: ContentFormat, names: string[]): ContentField[] =>
  names.map((name) => ({ path: prefix ? `${prefix}.${name}` : name, format, context: name }));
const text = (prefix: string, ...names: string[]) => fields(prefix, "text", names);
const html = (prefix: string, ...names: string[]) => fields(prefix, "html", names);
const markdown = (prefix: string, ...names: string[]) => fields(prefix, "markdown", names);
const measure = (prefix: string) => [
  ...text(prefix, "name"),
  ...html(
    prefix,
    "description",
    "description_about",
    "description_benefit",
    "description_contribution",
    "description_implementation",
    "description_funding",
    "description_legal",
    "description_evaluation_criteria",
    "description_verification",
    "description_tutorial",
  ),
];
const project = (prefix: string) => [
  ...text(prefix, "title", "subtitle", "abstract"),
  ...markdown(prefix, "article_text"),
  ...text(`${prefix}.measures.*.measures_id`, "name"),
];
const event = (prefix: string) => [
  ...text(prefix, "title", "cta_label"),
  ...html(prefix, "description"),
  ...text(`${prefix}.series`, "title"),
];
const tour = (prefix: string) => [...text(prefix, "title"), ...html(prefix, "introduction", "closing_reflection")];
const stop = (prefix: string) => [
  ...text(prefix, "title", "report_title", "teaser"),
  ...html(prefix, "visit_details"),
  ...text(`${prefix}.tour`, "title"),
  ...text(`${prefix}.media.*`, "alt", "caption"),
];
const job = (prefix: string) => [
  ...text(prefix, "role_title", "weekly_hours", "salary", "hourly_wage"),
  ...markdown(prefix, "tasks", "qualifications", "benefits", "contact_notes"),
];
const municipality = (prefix: string) => markdown(prefix, "description", "overall_status_comment");
const rating = (prefix: string) => markdown(prefix, "why_not_applicable", "current_progress");

/** Exact public DTO paths. Names, credits, enums, URLs, identifiers and source code are intentionally excluded. */
export const CONTENT_TRANSLATION_POLICIES: Record<string, ContentTranslationPolicy> = {
  "/api/public/pages/:slug": { fields: [...text("page", "name"), ...html("page", "contents")] },
  "/api/public/blocks": { fields: [], blocks: true },
  "/api/public/site-layout": {
    fields: [...text("pages.*", "name"), ...html("pages.*", "contents")],
    navigation: true,
  },
  "/api/public/articles": { fields: project("articles.*") },
  "/api/public/articles/:slug": { fields: project("article") },
  "/api/public/climate-tools": { fields: text("tools.*", "title", "description") },
  "/api/public/jobs": { fields: job("jobs.*") },
  "/api/public/jobs/:slug": { fields: job("job") },
  "/api/public/events": { fields: event("events.*") },
  "/api/public/events/:slug": { fields: [...event("event"), ...text("eventProjects.*", "title")] },
  "/api/public/event-series/:slug": { fields: [...tour("series"), ...event("events.*")] },
  "/api/public/news": {
    fields: [
      ...text("news.*", "title", "teaser"),
      ...project("articles.*"),
      ...event("events.*"),
      ...municipality("municipalities.*"),
      ...stop("visitReports.*"),
    ],
  },
  "/api/public/news/:slug": {
    fields: [
      ...text("item", "title", "teaser"),
      ...text("item.tour_stop.tour", "title"),
      ...text("item.report_event", "title"),
      ...text("item.report_event.series", "title"),
    ],
  },
  "/api/public/measures": { fields: measure("measures.*") },
  "/api/public/measures/:slug": { fields: measure("measure") },
  "/api/public/stats/:catalog": {
    fields: [...measure("measures.*"), ...municipality("municipalities.*"), ...municipality("scores.*.municipality")],
  },
  "/api/public/municipalities/:slug": {
    fields: [
      ...municipality("directusData.municipalityScore.municipality"),
      ...rating("directusData.ratingsBySector.*.*"),
      ...measure("directusData.ratingsBySector.*.*.measure"),
    ],
  },
  "/api/public/ratings": { fields: [...text("ratings.*.measure_id", "name"), ...text("ratings.*.measure", "name")] },
  "/api/public/organisation-teams": { fields: text("*", "label", "tasks.*") },
  "/api/org-members": { fields: html("*", "bio") },
  "/api/public/data-page-config": { fields: markdown("config", "under_construction_explanation") },
  "/api/public/tours": { fields: tour("tours.*") },
  "/api/public/tours/:slug": { fields: [...tour("tour"), ...stop("stops.*")] },
  "/api/public/tour-detail": { fields: tour("series") },
  "/api/public/tour-stops-by-tour": { fields: stop("stops.*") },
  "/api/public/tour-stop-articles": { fields: text("*.articles_id", "title") },
  "/api/public/projects-tours": { fields: text("series.*", "title") },
  "/api/public/article-tour-visits": {
    fields: [
      ...text("visits.*.stop", "title"),
      ...text("visits.*.tour", "title"),
      ...text("visits.*.stop.tour", "title"),
    ],
  },
  "/api/public/wahlcheck": { fields: text("*", "descriptor") },
  "/api/public/wahlcheck/:municipalitySlug": {
    fields: [
      ...text("election", "descriptor"),
      ...text("questions.*", "title", "thesis"),
      ...markdown("questions.*", "background_information"),
      ...text("candidates.*.answers.*", "explanation"),
    ],
  },
  "/api/public/elections": { fields: text("elections.*", "descriptor") },
  "/api/content-search": { fields: html("hits.*", "title", "excerpt") },
};

export function contentTranslationPolicy(path: string): ContentTranslationPolicy | undefined {
  const pathname = path.split(/[?#]/)[0]?.replace(/\/$/, "");
  if (!pathname?.startsWith("/api/")) return undefined;
  for (const [route, policy] of Object.entries(CONTENT_TRANSLATION_POLICIES)) {
    const pattern = route
      .split("/")
      .map((part) => (part.startsWith(":") ? "[^/]+" : part))
      .join("/");
    if (new RegExp(`^${pattern}$`).test(pathname)) return policy;
  }
  return undefined;
}
