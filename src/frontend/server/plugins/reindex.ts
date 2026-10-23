import { z } from "zod";
import type { Index } from "meilisearch";
import { parseCms } from "../utils/parseCms";
import { cmsRows } from "~/server/utils/cmsValue";
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
} from "../utils/extractContent";

const identity = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string().nullish(),
  title: z.string().nullish(),
});
const blockIdentity = z.looseObject({ entity_uuid: z.string() });
const SKIP_BUNDLES = ["container", "carousel", "directus_page", "vega_chart", "page_nav"];
const BATCH_SIZE = 200;
const REINDEX_INTERVAL_MS_DEV = 15 * 60 * 1000;
const REINDEX_INTERVAL_MS_PROD = 60 * 60 * 1000;

type ReindexGlobals = typeof globalThis & {
  __slkReindexTimer?: ReturnType<typeof setInterval>;
  __slkReindexRunning?: boolean;
};

async function upsertBatch(index: Index<SiteContentDoc>, docs: SiteContentDoc[]) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    await index.addDocuments(docs.slice(i, i + BATCH_SIZE));
  }
}

// Nitro 2 declares void plugins; retain the existing asynchronous background setup. Owner: app maintainers.
// eslint-disable-next-line @typescript-eslint/no-misused-promises
export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig();
  const ms = getMeilisearch();
  const index = ms.index<SiteContentDoc>("site_content");
  const reindexIntervalMs = process.env.APP_ENV === "production" ? REINDEX_INTERVAL_MS_PROD : REINDEX_INTERVAL_MS_DEV;

  // Configure index (idempotent)
  try {
    await index.updateSettings({
      searchableAttributes: ["title", "text", "meta"],
      filterableAttributes: ["type"],
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
      },
      stopWords: ["der", "die", "das", "und", "oder", "in", "von", "zu", "mit", "für", "bei", "an"],
    });
  } catch (e) {
    console.error("[reindex] Failed to configure Meilisearch index settings:", e);
    return;
  }

  const serverToken = config.directusFrontendServerToken as string | undefined;
  if (!serverToken) throw new Error("Reindexing requires the private server token");
  const directus = createDirectus(config.directusServerUrl || "http://directus:8055")
    .with(rest())
    .with(staticToken(serverToken));

  const g = globalThis as ReindexGlobals;

  const runReindex = async () => {
    if (g.__slkReindexRunning) {
      console.log("[reindex] Previous run still in progress, skipping this cycle");
      return;
    }

    g.__slkReindexRunning = true;
    const counts: Record<string, number> = {};

    try {
      // --- Blocks ---
      const pages = await directus
        .request(readItems("pages", { limit: -1, fields: ["id", "slug", "name", "contents"] }))
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
              status: { _neq: "archived" },
              entity_type: { _eq: "pages" },
              field_name: { _eq: "content" },
              bundle: { _nin: SKIP_BUNDLES },
            },
            fields: ["uuid", "bundle", "props", "entity_uuid"],
          }),
        )
        .then(cmsRows);

      const blockDocs = parseCms(z.array(blockIdentity), blocks)
        .map((block) => {
          const page = pageByEntity[block.entity_uuid];
          return buildBlockDoc(block, page?.name || block.entity_uuid, "", page?.slug || block.entity_uuid);
        })
        .filter((d): d is SiteContentDoc => d !== null);
      await upsertBatch(index, blockDocs);
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
              status: { _neq: "archived" },
              entity_type: { _eq: "news_items" },
              field_name: { _eq: "content" },
              bundle: { _nin: SKIP_BUNDLES },
            },
            fields: ["uuid", "bundle", "props", "entity_uuid"],
          }),
        )
        .then(cmsRows);
      const newsBlockDocs = parseCms(z.array(blockIdentity), newsBlocks)
        .map((block) => {
          const newsItem = newsByEntity[block.entity_uuid];
          return buildBlockDoc(
            block,
            newsItem?.title || block.entity_uuid,
            "/news",
            newsItem?.slug || block.entity_uuid,
          );
        })
        .filter((d): d is SiteContentDoc => d !== null);
      await upsertBatch(index, newsBlockDocs);
      counts.news_blocks = newsBlockDocs.length;

      // --- Pages (legacy HTML content only) ---
      const pageDocs = (pages || [])
        .filter((p) => p.status === "published" || p.status === undefined)
        .map((p) => buildPageDoc(p))
        .filter((d): d is SiteContentDoc => d !== null);
      await upsertBatch(index, pageDocs);
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
      await upsertBatch(index, eventDocs);
      counts.events = eventDocs.length;

      // --- News items ---
      const newsItemDocs = (newsItems || [])
        .map((n) => buildNewsItemDoc(n))
        .filter((d): d is SiteContentDoc => d !== null);
      await upsertBatch(index, newsItemDocs);
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
      const articleDocs = (articles || [])
        .map((a) => buildArticleDoc(a))
        .filter((d): d is SiteContentDoc => d !== null);
      await upsertBatch(index, articleDocs);
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
                filter: { catalog_version: { _eq: frontendCatalog.id } },
                fields: [
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

      // Remove stale measure documents (IDs not in the current batch) by fetching + diffing.
      try {
        const newIds = new Set(measureDocs.map((d) => d.id));
        const existing = await index.getDocuments({ filter: 'type = "measure"', limit: 200 });
        const toDelete = existing.results.map((d) => d.id).filter((id: string) => !newIds.has(id));
        if (toDelete.length > 0) {
          const delTask = await index.deleteDocuments(toDelete);
          await ms.tasks.waitForTask(delTask.taskUid);
        }
      } catch (e) {
        console.warn("[reindex] Failed to delete stale measure docs:", e);
      }

      await upsertBatch(index, measureDocs);
      counts.measures = measureDocs.length;

      // --- Static Nuxt pages (incl. organisation page + team entries) ---
      const staticDocs = buildStaticPageDocs();
      await upsertBatch(index, staticDocs);
      counts.static_pages = staticDocs.length;

      // --- Team members (directus_users with show_on_team_page = true) ---
      try {
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
        await upsertBatch(index, memberDocs);
        counts.members = memberDocs.length;
      } catch (e) {
        console.warn("[reindex] Failed to index team members:", e);
      }

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      console.log(`[reindex] Indexed ${total} documents:`, counts);
    } catch (e) {
      console.error("[reindex] Failed to index content:", e);
    } finally {
      g.__slkReindexRunning = false;
    }
  };

  // Run once on startup.
  await runReindex();

  // In dev/HMR, avoid multiple timers by replacing the previous interval.
  if (g.__slkReindexTimer) {
    clearInterval(g.__slkReindexTimer);
  }
  g.__slkReindexTimer = setInterval(() => {
    void runReindex();
  }, reindexIntervalMs);

  console.log(`[reindex] Periodic reindex enabled every ${Math.round(reindexIntervalMs / 60000)} minutes`);
});
