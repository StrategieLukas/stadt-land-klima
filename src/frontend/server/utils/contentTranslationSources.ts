import { contentTranslationPolicy } from "../../shared/contentTranslation";
import { isRecord } from "../../shared/editorBlocks";

export type PublicTranslationSnapshot = { path: string; data: unknown };
export type TranslationSourceReader = {
  records: (
    collection: string,
    fields: string[],
    filter: Record<string, unknown>,
  ) => Promise<Record<string, unknown>[]>;
  /** Must call the checked, German public Nuxt route; undefined means a revoked/removed 404. */
  fetch: (path: string) => Promise<unknown>;
  progress?: () => Promise<void>;
};
const string = (value: unknown) => (typeof value === "string" && value.length ? value : undefined);
const encoded = (value: string) => encodeURIComponent(value);

/** Enumeration uses private service projections, while every body goes through the existing
 * checked public endpoint. No draft, preview, candidate session or raw CMS export is translated.
 * Full CMS pagination prevents a fixed list-page limit from silently omitting old records.
 */
export async function* collectPublicTranslationSnapshots(
  source: TranslationSourceReader,
): AsyncGenerator<PublicTranslationSnapshot> {
  const seen = new Set<string>();
  async function* emit(path: string) {
    if (seen.has(path)) return;
    if (!contentTranslationPolicy(path)) throw new Error("Unregistered translation source route");
    if (seen.size >= 20_000) throw new Error("Translation source limit exceeded");
    seen.add(path);
    await source.progress?.();
    const data = await source.fetch(path);
    if (data !== undefined) yield { path, data };
  }
  for (const path of [
    "/api/public/site-layout",
    "/api/public/climate-tools",
    "/api/public/data-page-config",
    "/api/public/organisation-teams",
    "/api/org-members",
    "/api/public/elections",
    "/api/public/news",
    "/api/public/articles",
    "/api/public/jobs",
    "/api/public/events",
    "/api/public/tours?limit=100",
  ])
    yield* emit(path);
  const elections = await source.fetch("/api/public/wahlcheck");
  if (elections !== undefined) yield { path: "/api/public/wahlcheck", data: elections };
  if (Array.isArray(elections))
    for (const election of elections) {
      if (!isRecord(election)) continue;
      const slug = string(election.municipalitySlug);
      if (slug) yield* emit(`/api/public/wahlcheck/${encoded(slug)}`);
    }
  const entityRoutes = [
    ["pages", "/api/public/pages", true],
    ["articles", "/api/public/articles", true],
    ["news_items", "/api/public/news", true],
    ["events", "/api/public/events", false],
    ["event_series", "/api/public/event-series", false],
    ["job_offers", "/api/public/jobs", false],
    ["success_project_tours", "/api/public/tours", true],
  ] as const;
  for (const [collection, route, blocks] of entityRoutes) {
    const rows = await source.records(collection, ["id", "slug", "status"], { status: { _eq: "published" } });
    for (const row of rows) {
      if (row.status !== "published") continue;
      const slug = string(row.slug);
      if (slug) yield* emit(`${route}/${encoded(slug)}`);
      const id = string(row.id);
      if (blocks && id)
        yield* emit(`/api/public/blocks?${new URLSearchParams({ entityType: collection, entityUuid: id })}`);
      if (collection === "success_project_tours" && id)
        yield* emit(`/api/public/tour-stops-by-tour?${new URLSearchParams({ tourId: id })}`);
    }
  }
  const stops = await source.records("success_project_tour_stops", ["id", "status", "report_status"], {
    status: { _eq: "published" },
    report_status: { _eq: "published" },
    tour: { status: { _eq: "published" } },
  });
  for (const stop of stops) {
    const id = string(stop.id);
    if (id && stop.status === "published" && stop.report_status === "published")
      yield* emit(
        `/api/public/blocks?${new URLSearchParams({ entityType: "success_project_tour_stops", entityUuid: id })}`,
      );
  }
  const catalogs = await source.records("measure_catalog", ["id", "name", "hidden"], { hidden: { _eq: false } });
  for (const catalog of catalogs) {
    const id = string(catalog.id);
    const name = string(catalog.name);
    if (!id || !name || catalog.hidden === true) continue;
    const query = new URLSearchParams({ v: name });
    yield* emit(`/api/public/measures?${query}`);
    const measures = await source.records("measures", ["slug", "status"], {
      status: { _eq: "published" },
      catalog_version: { _eq: id },
    });
    for (const measure of measures) {
      const slug = string(measure.slug);
      if (slug && measure.status === "published") yield* emit(`/api/public/measures/${encoded(slug)}?${query}`);
    }
    const scores = await source.records("municipality_scores", ["municipality.slug", "published"], {
      published: { _eq: true },
      catalog_version: { _eq: id },
      municipality: { status: { _eq: "published" } },
    });
    for (const score of scores) {
      const slug = isRecord(score.municipality) ? string(score.municipality.slug) : undefined;
      if (score.published === true && slug) yield* emit(`/api/public/municipalities/${encoded(slug)}?${query}`);
    }
  }
}
