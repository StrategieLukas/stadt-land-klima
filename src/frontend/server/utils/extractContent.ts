import { PUBLIC_NUXT_ROUTES } from "../../shared/publicRoutes.ts";
import { staticSearchMessages } from "../../shared/staticSearchMessages.ts";
import { z } from "zod";
const text = z
  .string()
  .nullish()
  .transform((value) => value ?? "");
const content = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  slug: text,
  name: text,
  title: text,
  status: text,
  bio: text,
  first_name: text,
  last_name: text,
  show_on_team_page: z.boolean().optional(),
  teaser: text,
  contents: text,
  description: text,
  event_type: text,
  subtitle: text,
  abstract: text,
  article_text: text,
  sector: text,
  description_about: text,
  description_benefit: text,
  description_evaluation_criteria: text,
  description_implementation: text,
  description_legal: text,
  description_funding: text,
  description_verification: text,
});
const blockContent = z.object({
  uuid: z.string(),
  bundle: z.string(),
  entity_uuid: z.string(),
  props: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((value) => value ?? {}),
});
export function stripHtml(input: unknown): string {
  const s = typeof input === "string" ? input : "";
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripMd(input: unknown): string {
  const s = typeof input === "string" ? input : "";
  return (s || "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [label](url) → label
    .replace(/[#*_`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BUNDLE_LABELS: Record<string, string> = {
  text: "Text",
  richtext: "Fließtext",
  heading: "Überschrift",
  hero: "Hero",
  citation: "Zitat",
  stat: "Kennzahl",
  timeline: "Zeitstrahl",
  timeline_item: "Zeitleisten-Eintrag",
  button: "Schaltfläche",
  image: "Bild",
  video: "Video",
  progress_bar: "Fortschrittsbalken",
};

export function bundleLabel(bundle: string): string {
  return BUNDLE_LABELS[bundle] ?? bundle;
}

export function extractBlockText(bundle: string, props: Record<string, unknown>): string {
  const p = props || {};
  const parts: string[] = [];
  const add = (...vals: unknown[]) => {
    vals.forEach((value) => {
      if (typeof value === "string" || typeof value === "number") parts.push(String(value).trim());
    });
  };

  switch (bundle) {
    case "text":
      parts.push(stripHtml(p.content));
      break;
    case "richtext":
      parts.push(stripMd(p.content));
      break;
    case "heading":
      add(p.text);
      break;
    case "hero":
      add(p.title, p.subtitle);
      break;
    case "citation":
      add(p.quote, p.attribution);
      break;
    case "stat":
      add(p.label, p.description, p.value);
      break;
    case "timeline":
      add(p.title);
      break;
    case "timeline_item":
      add(p.title, p.description, p.date);
      break;
    case "button":
      add(p.label);
      break;
    case "image":
      add(p.caption, p.alt);
      break;
    case "video":
      add(p.caption);
      break;
    case "progress_bar":
      add(p.label, p.description);
      break;
    default:
      break;
  }

  return parts.filter(Boolean).join(" ");
}

export type SiteContentDoc = {
  id: string;
  type:
    | "block"
    | "page"
    | "event"
    | "article"
    | "measure"
    | "static_page"
    | "news_item"
    | "member"
    | "team"
    | "job"
    | "climate_tool"
    | "event_series"
    | "tour"
    | "tour_stop"
    | "election";
  title: string;
  text: string;
  url: string;
  meta: string | null;
  requiresPublishedReport?: boolean;
};

// Static (hardcoded Nuxt) pages that are not managed through Directus
export const STATIC_PAGES: Array<{ id: string; title: string; text: string; url: string; meta: string | null }> = [
  ...PUBLIC_NUXT_ROUTES.map((route) => ({
    id: route.id,
    title: staticSearchMessages["de-DE"][route.titleKey],
    text: [
      route.url,
      ...Object.values(staticSearchMessages).flatMap((messages) =>
        [route.titleKey, ...route.textKeys].map((key) => messages[key]),
      ),
    ].join(" "),
    url: route.url,
    meta: null,
  })),
];

export function buildMemberDoc(input: unknown): SiteContentDoc | null {
  const parsed = content.safeParse(input);
  if (!parsed.success) return null;
  const user = parsed.data;
  if (!user.show_on_team_page || user.id === undefined) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (!name) return null;
  return {
    id: `member_${user.id}`,
    type: "member",
    title: name,
    text: [name, stripHtml(user.bio || "")].filter(Boolean).join(" "),
    url: `/organisation#member-${user.id}`,
    meta: null,
  };
}

export function buildStaticPageDocs(): SiteContentDoc[] {
  return STATIC_PAGES.map((p) => ({ ...p, type: "static_page" as const }));
}

export function buildNewsItemDoc(input: unknown): SiteContentDoc | null {
  const parsed = content.safeParse(input);
  if (!parsed.success) return null;
  const item = parsed.data;
  if (item.status !== "published") return null;
  return {
    id: `news_item_${item.slug}`,
    type: "news_item",
    title: item.title || "",
    text: stripHtml(item.teaser || ""),
    url: `/news/${item.slug}`,
    meta: null,
  };
}

export function buildPageDoc(input: unknown): SiteContentDoc | null {
  const parsed = content.safeParse(input);
  if (!parsed.success) return null;
  const page = parsed.data;
  if (page.status !== "published" || !page.contents) return null;
  return {
    id: `page_${page.slug}`,
    type: "page",
    title: page.name || page.slug,
    text: stripHtml(page.contents),
    url: `/${page.slug}`,
    meta: null,
  };
}

export function buildEventDoc(input: unknown): SiteContentDoc | null {
  const parsed = content.safeParse(input);
  if (!parsed.success) return null;
  const event = parsed.data;
  if (event.status !== "published") return null;
  return {
    id: `event_${event.slug}`,
    type: "event",
    title: event.title || "",
    text: stripHtml(event.description || ""),
    url: `/events/${event.slug}`,
    meta: event.event_type || null,
  };
}

export function buildArticleDoc(input: unknown): SiteContentDoc | null {
  const parsed = content.safeParse(input);
  if (!parsed.success) return null;
  const article = parsed.data;
  if (article.status !== "published") return null;
  const text = [article.subtitle, stripMd(article.abstract || ""), stripMd(article.article_text || "")]
    .filter(Boolean)
    .join(" ");
  return {
    id: `article_${article.slug}`,
    type: "article",
    title: article.title || "",
    text,
    url: `/projects/${article.slug}`,
    meta: null,
  };
}

const MEASURE_DESC_FIELDS = [
  "description",
  "description_about",
  "description_benefit",
  "description_evaluation_criteria",
  "description_implementation",
  "description_legal",
  "description_funding",
  "description_verification",
];

export function buildMeasureDoc(input: unknown, catalogVersionName?: string): SiteContentDoc | null {
  const parsed = content.safeParse(input);
  if (!parsed.success) return null;
  const measure = parsed.data;
  if (measure.status !== "published") return null;
  const text = MEASURE_DESC_FIELDS.map((f) => stripHtml(measure[f as keyof typeof measure]))
    .filter(Boolean)
    .join(" ");
  const url = catalogVersionName
    ? `/measures/${measure.slug}?v=${encodeURIComponent(catalogVersionName)}`
    : `/measures/${measure.slug}`;
  return {
    id: `measure_${measure.slug}`,
    type: "measure",
    title: measure.name || "",
    text,
    url,
    meta: measure.sector || null,
  };
}

export function buildBlockDoc(
  input: unknown,
  pageName: string,
  baseUrl = "",
  entitySlug?: string,
): SiteContentDoc | null {
  const parsed = blockContent.safeParse(input);
  if (!parsed.success) return null;
  const block = parsed.data;
  const text = extractBlockText(block.bundle, block.props);
  if (!text) return null;
  return {
    id: `block_${block.uuid}`,
    type: "block",
    title: pageName || block.entity_uuid,
    text,
    url: `${baseUrl}/${entitySlug ?? block.entity_uuid}#block-${block.uuid}`,
    meta: bundleLabel(block.bundle),
  };
}

const jobContent = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,160}$/),
  role_title: z.string().min(1),
  status: z.literal("published"),
  tasks: text,
  qualifications: text,
  benefits: text,
  organisation: z.object({ name: z.string() }).nullish(),
});

/** Index only the public description, never application URLs or contact details. */
export function buildJobDoc(input: unknown): SiteContentDoc | null {
  const parsed = jobContent.safeParse(input);
  if (!parsed.success) return null;
  const job = parsed.data;
  return {
    id: `job_${job.slug}`,
    type: "job",
    title: job.role_title,
    text: [job.organisation?.name, job.tasks, job.qualifications, job.benefits]
      .map((value) => stripHtml(stripMd(value)))
      .filter(Boolean)
      .join(" "),
    url: `/jobs/${encodeURIComponent(job.slug)}`,
    meta: job.organisation?.name ?? null,
  };
}
