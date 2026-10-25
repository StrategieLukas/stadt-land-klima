import { extensionLog, extensionError } from "../../shared/securityLogger.ts";
import { Meilisearch } from "meilisearch";
import type { ApiExtensionContext } from "@directus/types";

type Database = ApiExtensionContext["database"];
type Logger = ApiExtensionContext["logger"];

const SKIP_BUNDLES = ["container", "carousel", "directus_page", "vega_chart", "page_nav"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Text extraction helpers ──

function stripHtml(s: string | null | undefined): string {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMd(s: string | null | undefined): string {
  return (s || "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
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

function bundleLabel(bundle: string): string {
  return BUNDLE_LABELS[bundle] ?? bundle;
}

interface BlockProps {
  content?: string;
  text?: string;
  subtitle?: string;
  title?: string;
  quote?: string;
  attribution?: string;
  label?: string;
  description?: string;
  value?: string | number;
  date?: string;
  caption?: string;
  alt?: string;
  [key: string]: any;
}

interface Block {
  uuid: string;
  bundle: string;
  props?: BlockProps;
  entity_uuid?: string;
}

function extractBlockText(bundle: string, props?: BlockProps): string {
  const p = props || {};
  const parts: string[] = [];
  const add = (...vals: (string | undefined)[]) => vals.forEach((v) => v && parts.push(String(v).trim()));

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
      add(p.label, p.description, String(p.value ?? ""));
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

interface SearchDoc {
  id: string;
  type: string;
  title: string;
  text: string;
  url: string;
  meta: string | null;
}

function buildBlockDoc(block: Block, pageName?: string, entitySlug = block.entity_uuid): SearchDoc | null {
  const text = extractBlockText(block.bundle, block.props || {});
  if (!text) return null;
  return {
    id: `block_${block.uuid}`,
    type: "block",
    title: pageName || block.entity_uuid || "",
    text,
    url: `/${entitySlug}#block-${block.uuid}`,
    meta: bundleLabel(block.bundle),
  };
}

interface Page {
  id?: string;
  slug: string;
  name?: string;
  contents?: string;
  status?: string;
}

function buildPageDoc(page: Page): SearchDoc | null {
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

interface Event {
  slug: string;
  title?: string;
  description?: string;
  status?: string;
  event_type?: string;
}

function buildEventDoc(event: Event): SearchDoc | null {
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

interface Article {
  slug: string;
  title?: string;
  subtitle?: string;
  abstract?: string;
  article_text?: string;
  status?: string;
}

function buildArticleDoc(article: Article): SearchDoc | null {
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

interface Measure {
  slug: string;
  name?: string;
  sector?: string;
  [key: string]: any;
}

// Return type is SearchDoc (never null) — callers no longer need a null check.
function buildMeasureDoc(measure: Measure): SearchDoc {
  const text = MEASURE_DESC_FIELDS.map((f) => stripHtml(measure[f] || ""))
    .filter(Boolean)
    .join(" ");
  return {
    id: `measure_${measure.slug}`,
    type: "measure",
    title: measure.name || "",
    text,
    url: `/measures/${measure.slug}`,
    meta: measure.sector || null,
  };
}

interface User {
  id: number | string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  show_on_team_page?: boolean;
}

function buildMemberDoc(user: User): SearchDoc | null {
  if (!user.show_on_team_page) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (!name) return null;
  return {
    id: `member_${user.id}`,
    type: "member",
    title: name,
    text: [name, stripHtml(user.bio || "")].filter(Boolean).join(" "),
    url: `/organisation#member-${user.id}`,
    meta: "Teammitglied",
  };
}

// ── Hook registration ──

interface HookContext {
  action: (event: string, handler: (...args: any[]) => void) => void;
  filter: (
    event: string,
    handler: (keys: (string | number)[], meta: ActionPayload, context: ActionContext) => Promise<(string | number)[]>,
  ) => void;
  logger: Logger;
  env: Record<string, string>;
}

interface ActionPayload {
  collection?: string;
  payload?: any;
  key?: string | number;
  keys?: (string | number)[];
}

interface ActionContext {
  database: Database;
}

interface BlockRow {
  uuid: string;
  bundle: string;
  props?: BlockProps;
  entity_uuid: string;
  entity_type: string;
  field_name: string;
  status: string;
}

export default (
  { action, filter }: HookContext,
  {
    logger,
    env,
    emitter,
  }: {
    logger: Logger;
    env: Record<string, string>;
    emitter: {
      onAction: (event: string, handler: (meta: any, context: ActionContext) => Promise<void>) => void;
    };
  },
) => {
  const ms = new Meilisearch({
    host: env.MEILISEARCH_URL || "http://meilisearch:7700",
    apiKey: env.MEILISEARCH_MASTER_KEY || env.MEILI_MASTER_KEY || "",
  });
  const index = ms.index("site_content");

  async function upsert(doc: SearchDoc): Promise<void> {
    try {
      await index.addDocuments([doc]);
      extensionLog(logger, "info", "directus.search.upsert_queued", {
        resource: "search_documents",
        count: 1,
        outcome: "success",
      });
    } catch (e: any) {
      extensionError(logger, "app.hook-search-index.index.upsert.failed", e);
    }
  }

  /**
   * Deletes a document from the index.
   * Meilisearch raises an error when the document does not exist; we suppress
   * only that specific case and re-log everything else.
   */
  async function remove(id: string): Promise<void> {
    try {
      await index.deleteDocument(id);
      extensionLog(logger, "info", "directus.search.removal_queued", {
        resource: "search_documents",
        count: 1,
        outcome: "success",
      });
    } catch (e: any) {
      // Meilisearch returns "document_not_found" for missing docs — not a real error.
      if (e?.code !== "document_not_found") {
        extensionError(logger, "app.hook-search-index.index.remove.failed", e);
      }
    }
  }

  // Resolve identifiers while records still exist. Removal before deletion is
  // conservative: failed DB deletions can hide a result, never disclose a draft.
  filter("items.delete", async (keys, { collection }, { database }) => {
    if (!collection || !["blocks", "pages", "events", "articles", "measures"].includes(collection)) return keys;
    const rows = await database(collection).whereIn("id", keys).select("*");
    for (const row of rows) {
      if (collection === "blocks") await remove(`block_${row.uuid}`);
      else {
        const prefix = { pages: "page", events: "event", articles: "article", measures: "measure" }[collection];
        await remove(`${prefix}_${row.slug}`);
        if (collection === "pages") await removeBlocksForPage(row as Page, database);
      }
    }
    return keys;
  });

  // ── blocks ──

  async function syncBlock(row: BlockRow, database: Database): Promise<void> {
    if (SKIP_BUNDLES.includes(row.bundle) || row.entity_type !== "pages" || row.field_name !== "content") {
      await remove(`block_${row.uuid}`);
      return;
    }

    if (row.status !== "published") {
      await remove(`block_${row.uuid}`);
      return;
    }

    const pageRows = await database("pages")
      .where((builder) => {
        if (UUID_PATTERN.test(row.entity_uuid)) {
          builder.where("id", row.entity_uuid);
        } else {
          builder.where("slug", row.entity_uuid);
        }
      })
      .select("name", "slug", "status")
      .limit(1);

    // Don't index blocks belonging to unpublished pages
    if (!pageRows[0] || pageRows[0].status !== "published") {
      await remove(`block_${row.uuid}`);
      return;
    }

    const pageName = pageRows[0]?.name || row.entity_uuid;
    const doc = buildBlockDoc(row as unknown as Block, pageName, pageRows[0]?.slug || row.entity_uuid);
    if (doc) await upsert(doc);
    else await remove(`block_${row.uuid}`);
  }

  /**
   * Removes all indexed block documents belonging to a page, called when a page
   * is unpublished or deleted so draft blocks cannot escape through search.
   */
  async function removeBlocksForPage(page: Page, database: Database): Promise<void> {
    try {
      const rows = await database("blocks")
        .where("entity_type", "pages")
        .where("field_name", "content")
        .whereIn(
          "entity_uuid",
          [page.id, page.slug].filter((value): value is string => Boolean(value)),
        )
        .select("uuid");
      for (const row of rows) {
        await remove(`block_${row.uuid}`);
      }
    } catch (e: any) {
      extensionError(logger, "app.hook-search-index.index.removeBlocksForPage.failed", e);
    }
  }

  /**
   * Fetches a full block row by UUID or (fallback) numeric ID.
   * Returns null when nothing is found.
   */
  async function fetchBlockRow(key: string | number, database: Database): Promise<BlockRow | null> {
    const cols = ["uuid", "bundle", "props", "entity_uuid", "entity_type", "field_name", "status"] as const;
    if (typeof key === "string" && UUID_PATTERN.test(key)) {
      const byUuid = await database("blocks").where("uuid", key).select(cols).limit(1);
      return byUuid[0] ? (byUuid[0] as BlockRow) : null;
    }

    const numericId = Number(key);
    if (!Number.isInteger(numericId)) return null;
    const byId = await database("blocks").where("id", numericId).select(cols).limit(1);
    return byId[0] ? (byId[0] as BlockRow) : null;
  }

  emitter.onAction(
    "blokkli.blocks.committed",
    async (
      { createdUuids = [], updatedIds = [] }: { createdUuids?: string[]; updatedIds?: number[] },
      { database }: ActionContext,
    ) => {
      for (const key of [...createdUuids, ...updatedIds]) {
        try {
          const row = await fetchBlockRow(key, database);
          if (row) await syncBlock(row, database);
        } catch (e: any) {
          extensionError(logger, "app.hook-search-index.index.failed", e);
        }
      }
    },
  );

  action("items.create", async ({ collection, payload, key }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "blocks") return;
    const blockKey: string | number | undefined = payload?.uuid ?? key;
    if (blockKey == null) {
      extensionLog(logger, "warn", "app.hook-search-index.index.degraded");
      return;
    }
    // Re-fetch from DB so we have all fields, not just what was in the create payload.
    try {
      const row = await fetchBlockRow(blockKey, database);
      if (row) await syncBlock(row, database);
    } catch (e: any) {
      extensionError(logger, "app.hook-search-index.index.failed", e);
    }
  });

  action("items.update", async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "blocks") return;
    for (const key of keys as (string | number)[]) {
      try {
        const row = await fetchBlockRow(key, database);
        if (row) await syncBlock(row, database);
      } catch (e: any) {
        extensionError(logger, "app.hook-search-index.index.failed", e);
      }
    }
  });

  action("items.delete", async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "blocks") return;
    // keys may be numeric IDs at this point since the rows are already gone.
    // We stored documents as `block_<uuid>`, so we need to resolve uuid before
    // deletion. If the row is already gone we fall back to treating the key as
    // a uuid (covers the case where a uuid string was passed as the key).
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database("blocks").where("id", key).select("uuid").limit(1);
        const uuid = rows[0]?.uuid ?? key;
        await remove(`block_${uuid}`);
      } catch {
        // Row already deleted — treat key as uuid as a best-effort fallback.
        await remove(`block_${key}`);
      }
    }
  });

  // ── pages ──

  action("items.create", async ({ collection, payload }: ActionPayload) => {
    if (collection !== "pages") return;
    const page = payload as Page;
    if (!page?.slug) return;
    const doc = buildPageDoc(page);
    if (doc) await upsert(doc);
  });

  action("items.update", async ({ collection, key, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "pages") return;
    const pageKeys = keys ?? (key != null ? [key] : []);
    for (const key of pageKeys) {
      try {
        const rows = await database("pages")
          .where((builder: any) => {
            builder.where("id", key).orWhere("slug", key);
          })
          .select("id", "slug", "name", "contents", "status")
          .limit(1);
        if (!rows[0]) continue;
        const page = rows[0] as Page;
        if (page.status !== "published") {
          await remove(`page_${page.slug}`);
          // Remove child blocks when page is unpublished
          await removeBlocksForPage(page, database);
        } else {
          const doc = buildPageDoc(page);
          if (doc) await upsert(doc);
          else await remove(`page_${page.slug}`);
          const blocks = await database("blocks")
            .where("entity_type", "pages")
            .where("field_name", "content")
            .whereIn(
              "entity_uuid",
              [page.id, page.slug].filter((value): value is string => Boolean(value)),
            )
            .select("*");
          for (const block of blocks) await syncBlock(block as BlockRow, database);
        }
      } catch (e: any) {
        extensionError(logger, "app.hook-search-index.index.failed", e);
      }
    }
  });

  action("items.delete", async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "pages") return;
    // Rows are gone by the time this hook fires; resolve slug from a pre-delete
    // snapshot if available, otherwise fall back to treating the key as a slug.
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database("pages").where("id", key).select("slug").limit(1);
        const slug = rows[0]?.slug ?? key;
        await remove(`page_${slug}`);
        // Remove child blocks when page is deleted
        if (rows[0]?.slug) {
          await removeBlocksForPage(rows[0] as Page, database);
        }
      } catch {
        await remove(`page_${key}`);
      }
    }
  });

  // ── events ──

  action("items.create", async ({ collection, payload }: ActionPayload) => {
    if (collection !== "events") return;
    const doc = buildEventDoc(payload as Event);
    if (doc) await upsert(doc);
  });

  action("items.update", async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "events") return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database("events")
          .where("id", key)
          .select("slug", "title", "description", "event_type", "status")
          .limit(1);
        if (!rows[0]) continue;
        const event = rows[0] as Event;
        if (event.status !== "published") {
          await remove(`event_${event.slug}`);
        } else {
          const doc = buildEventDoc(event);
          if (doc) await upsert(doc);
        }
      } catch (e: any) {
        extensionError(logger, "app.hook-search-index.index.failed", e);
      }
    }
  });

  action("items.delete", async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "events") return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database("events").where("id", key).select("slug").limit(1);
        const slug = rows[0]?.slug ?? key;
        await remove(`event_${slug}`);
      } catch {
        await remove(`event_${key}`);
      }
    }
  });

  // ── articles ──

  action("items.create", async ({ collection, payload }: ActionPayload) => {
    if (collection !== "articles") return;
    const doc = buildArticleDoc(payload as Article);
    if (doc) await upsert(doc);
  });

  action("items.update", async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "articles") return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database("articles")
          .where("id", key)
          .select("slug", "title", "subtitle", "abstract", "article_text", "status")
          .limit(1);
        if (!rows[0]) continue;
        const article = rows[0] as Article;
        if (article.status !== "published") {
          await remove(`article_${article.slug}`);
        } else {
          const doc = buildArticleDoc(article);
          if (doc) await upsert(doc);
        }
      } catch (e: any) {
        extensionError(logger, "app.hook-search-index.index.failed", e);
      }
    }
  });

  action("items.delete", async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "articles") return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database("articles").where("id", key).select("slug").limit(1);
        const slug = rows[0]?.slug ?? key;
        await remove(`article_${slug}`);
      } catch {
        await remove(`article_${key}`);
      }
    }
  });

  // ── measures ──

  action("items.create", async ({ collection, payload }: ActionPayload) => {
    if (collection !== "measures") return;
    await upsert(buildMeasureDoc(payload as Measure));
  });

  action("items.update", async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "measures") return;
    for (const key of keys as (string | number)[]) {
      try {
        const fields = ["slug", "name", "sector", ...MEASURE_DESC_FIELDS];
        const rows = await database("measures").where("id", key).select(fields).limit(1);
        if (!rows[0]) continue;
        await upsert(buildMeasureDoc(rows[0] as Measure));
      } catch (e: any) {
        extensionError(logger, "app.hook-search-index.index.failed", e);
      }
    }
  });

  action("items.delete", async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== "measures") return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database("measures").where("id", key).select("slug").limit(1);
        const slug = rows[0]?.slug ?? key;
        await remove(`measure_${slug}`);
      } catch {
        await remove(`measure_${key}`);
      }
    }
  });

  // ── directus_users (team members) ──

  action("users.create", async ({ payload, key }: ActionPayload) => {
    const user: User = { ...payload, id: payload?.id ?? key };
    const doc = buildMemberDoc(user);
    if (doc) await upsert(doc);
  });

  action("users.update", async ({ keys }: ActionPayload, { database }: ActionContext) => {
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database("directus_users")
          .where("id", key)
          .select("id", "first_name", "last_name", "bio", "show_on_team_page")
          .limit(1);
        if (!rows[0]) continue;
        const user = rows[0] as User;
        if (!user.show_on_team_page) {
          await remove(`member_${user.id}`);
        } else {
          const doc = buildMemberDoc(user);
          if (doc) await upsert(doc);
        }
      } catch (e: any) {
        extensionError(logger, "app.hook-search-index.index.failed", e);
      }
    }
  });

  /**
   * FIX: Directus passes deleted user IDs via `keys`, not `payload`.
   * The original code read `payload` which is always undefined here.
   */
  action("users.delete", async ({ keys }: ActionPayload) => {
    for (const id of keys as (string | number)[]) {
      await remove(`member_${id}`);
    }
  });
};
