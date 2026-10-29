import { z } from "zod";
import { parseCms } from "./parseCms";
import { cmsRows } from "./cmsValue";
import { createDirectus, rest, readItems, readUsers, staticToken } from "@directus/sdk";
import {
  buildBlockDoc,
  buildPageDoc,
  buildEventDoc,
  buildArticleDoc,
  buildMeasureDoc,
  buildNewsItemDoc,
  buildMemberDoc,
  buildStaticPageDocs,
  type SiteContentDoc,
} from "./extractContent";

const identity = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string().nullish(),
  title: z.string().nullish(),
  status: z.literal("published"),
});
const blockIdentity = z.looseObject({ entity_uuid: z.string() });
const SKIP_BUNDLES = ["container", "carousel", "directus_page", "vega_chart", "page_nav"];

export function createSearchCms(url: string, token: string) {
  return createDirectus(url).with(rest()).with(staticToken(token));
}
/** Finish all CMS reads before modifying the index. A partial snapshot must never prune it. */
export async function collectSearchSnapshot(directus: ReturnType<typeof createSearchCms>) {
  const docs: SiteContentDoc[] = [];
  const counts: Record<string, number> = {};
  // --- Blocks ---
  const pages = await directus
    .request(
      readItems("pages", {
        limit: -1,
        filter: { status: { _eq: "published" } },
        fields: ["id", "slug", "name", "contents", "status"],
      }),
    )
    .then(cmsRows);
  const pageByEntity = Object.fromEntries(
    parseCms(z.array(identity), pages).flatMap((page) => [
      [page.id, page],
      // Transitional fallback for deliberately unmigrated legacy blocks.
      [page.slug, page],
    ]),
  );

  const blocks = await directus
    .request(
      readItems("blocks", {
        limit: -1,
        filter: {
          status: { _eq: "published" },
          entity_type: { _eq: "pages" },
          field_name: { _eq: "content" },
          bundle: { _nin: SKIP_BUNDLES },
        },
        fields: ["uuid", "bundle", "props", "entity_uuid"],
      }),
    )
    .then(cmsRows);

  const blockDocs = parseCms(z.array(blockIdentity), blocks)
    .filter((block) => Boolean(pageByEntity[block.entity_uuid]))
    .map((block) => {
      const page = pageByEntity[block.entity_uuid];
      return buildBlockDoc(block, page?.name || block.entity_uuid, "", page?.slug || block.entity_uuid);
    })
    .filter((d): d is SiteContentDoc => d !== null);
  docs.push(...blockDocs);
  counts.blocks = blockDocs.length;

  // --- News blocks ---
  const newsItems = await directus
    .request(
      readItems("news_items", {
        limit: -1,
        filter: { status: { _eq: "published" } },
        fields: ["id", "slug", "title", "teaser", "status"],
      }),
    )
    .then(cmsRows);
  const newsByEntity = Object.fromEntries(
    parseCms(z.array(identity), newsItems).flatMap((newsItem) => [
      [newsItem.id, newsItem],
      [newsItem.slug, newsItem],
    ]),
  );

  const newsBlocks = await directus
    .request(
      readItems("blocks", {
        limit: -1,
        filter: {
          status: { _eq: "published" },
          entity_type: { _eq: "news_items" },
          field_name: { _eq: "content" },
          bundle: { _nin: SKIP_BUNDLES },
        },
        fields: ["uuid", "bundle", "props", "entity_uuid"],
      }),
    )
    .then(cmsRows);
  const newsBlockDocs = parseCms(z.array(blockIdentity), newsBlocks)
    .filter((block) => Boolean(newsByEntity[block.entity_uuid]))
    .map((block) => {
      const newsItem = newsByEntity[block.entity_uuid];
      return buildBlockDoc(block, newsItem?.title || block.entity_uuid, "/news", newsItem?.slug || block.entity_uuid);
    })
    .filter((d): d is SiteContentDoc => d !== null);
  docs.push(...newsBlockDocs);
  counts.news_blocks = newsBlockDocs.length;

  // --- Pages (legacy HTML content only) ---
  const pageDocs = (pages || [])
    .filter((p) => p.status === "published")
    .map((p) => buildPageDoc(p))
    .filter((d): d is SiteContentDoc => d !== null);
  docs.push(...pageDocs);
  counts.pages = pageDocs.length;

  // --- Events ---
  const events = await directus
    .request(
      readItems("events", {
        limit: -1,
        filter: { status: { _eq: "published" } },
        fields: ["slug", "title", "description", "event_type", "status"],
      }),
    )
    .then(cmsRows);
  const eventDocs = (events || []).map((e) => buildEventDoc(e)).filter((d): d is SiteContentDoc => d !== null);
  docs.push(...eventDocs);
  counts.events = eventDocs.length;

  // --- News items ---
  const newsItemDocs = (newsItems || []).map((n) => buildNewsItemDoc(n)).filter((d): d is SiteContentDoc => d !== null);
  docs.push(...newsItemDocs);
  counts.news_items = newsItemDocs.length;

  // --- Articles ---
  const articles = await directus
    .request(
      readItems("articles", {
        limit: -1,
        filter: { status: { _eq: "published" } },
        fields: ["slug", "title", "subtitle", "abstract", "article_text", "status"],
      }),
    )
    .then(cmsRows);
  const articleDocs = (articles || []).map((a) => buildArticleDoc(a)).filter((d): d is SiteContentDoc => d !== null);
  docs.push(...articleDocs);
  counts.articles = articleDocs.length;

  // --- Measures ---
  // Fetch only from the isCurrentFrontend catalog so URLs always resolve correctly.
  const catalogVersions = await directus
    .request(
      readItems("measure_catalog", {
        filter: { hidden: { _eq: false }, isCurrentFrontend: { _eq: true } },
        fields: ["id", "name"],
        limit: 1,
      }),
    )
    .then(cmsRows);
  const frontendCatalog = catalogVersions?.[0];
  const measures = frontendCatalog
    ? await directus
        .request(
          readItems("measures", {
            limit: -1,
            filter: { status: { _eq: "published" }, catalog_version: { _eq: frontendCatalog.id } },
            fields: [
              "status",
              "slug",
              "name",
              "sector",
              "description",
              "description_about",
              "description_benefit",
              "description_evaluation_criteria",
              "description_implementation",
              "description_legal",
              "description_funding",
              "description_verification",
            ],
          }),
        )
        .then(cmsRows)
    : [];
  const measureDocs = (measures || [])
    .map((m) => buildMeasureDoc(m, typeof frontendCatalog?.name === "string" ? frontendCatalog.name : undefined))
    .filter((d): d is SiteContentDoc => d !== null);

  docs.push(...measureDocs);
  counts.measures = measureDocs.length;

  // --- Static Nuxt pages (incl. organisation page + team entries) ---
  const staticDocs = buildStaticPageDocs();
  docs.push(...staticDocs);
  counts.static_pages = staticDocs.length;

  // --- Team members (directus_users with show_on_team_page = true) ---
  {
    const members = await directus
      .request(
        readUsers({
          filter: { show_on_team_page: { _eq: true } },
          fields: ["id", "first_name", "last_name", "bio", "show_on_team_page"],
          limit: -1,
        }),
      )
      .then(cmsRows);
    const memberDocs = (members || []).map((u) => buildMemberDoc(u)).filter((d): d is SiteContentDoc => d !== null);
    docs.push(...memberDocs);
    counts.members = memberDocs.length;
  }

  return { docs, counts };
}
