import { MeiliSearch } from 'meilisearch';
import type { Database, Logger } from '@directus/types';

const SKIP_BUNDLES = ['container', 'carousel', 'directus_page', 'vega_chart', 'page_nav'];

// ── Text extraction helpers ──

function stripHtml(s: string | null | undefined): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripMd(s: string | null | undefined): string {
  return (s || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const BUNDLE_LABELS: Record<string, string> = {
  text: 'Text',
  richtext: 'Fließtext',
  heading: 'Überschrift',
  hero: 'Hero',
  citation: 'Zitat',
  stat: 'Kennzahl',
  timeline: 'Zeitstrahl',
  timeline_item: 'Zeitleisten-Eintrag',
  button: 'Schaltfläche',
  image: 'Bild',
  video: 'Video',
  progress_bar: 'Fortschrittsbalken',
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
  const add = (...vals: (string | undefined)[]) => vals.forEach(v => v && parts.push(String(v).trim()));

  switch (bundle) {
    case 'text':          parts.push(stripHtml(p.content)); break;
    case 'richtext':      parts.push(stripMd(p.content)); break;
    case 'heading':       add(p.text); break;
    case 'hero':          add(p.title, p.subtitle); break;
    case 'citation':      add(p.quote, p.attribution); break;
    case 'stat':          add(p.label, p.description, String(p.value ?? '')); break;
    case 'timeline':      add(p.title); break;
    case 'timeline_item': add(p.title, p.description, p.date); break;
    case 'button':        add(p.label); break;
    case 'image':         add(p.caption, p.alt); break;
    case 'video':         add(p.caption); break;
    case 'progress_bar':  add(p.label, p.description); break;
    default: break;
  }

  return parts.filter(Boolean).join(' ');
}

interface SearchDoc {
  id: string;
  type: string;
  title: string;
  text: string;
  url: string;
  meta: string | null;
}

function buildBlockDoc(block: Block, pageName?: string): SearchDoc | null {
  const text = extractBlockText(block.bundle, block.props || {});
  if (!text) return null;
  return {
    id: `block:${block.uuid}`,
    type: 'block',
    title: pageName || block.entity_uuid || '',
    text,
    url: `/${block.entity_uuid}#block-${block.uuid}`,
    meta: bundleLabel(block.bundle),
  };
}

interface Page {
  slug: string;
  name?: string;
  contents?: string;
  status?: string;
}

function buildPageDoc(page: Page): SearchDoc | null {
  if (!page.contents) return null;
  return {
    id: `page:${page.slug}`,
    type: 'page',
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
  if (event.status !== 'published') return null;
  return {
    id: `event:${event.slug}`,
    type: 'event',
    title: event.title || '',
    text: stripHtml(event.description || ''),
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
  if (article.status !== 'published') return null;
  const text = [
    article.subtitle,
    stripMd(article.abstract || ''),
    stripMd(article.article_text || ''),
  ].filter(Boolean).join(' ');
  return {
    id: `article:${article.slug}`,
    type: 'article',
    title: article.title || '',
    text,
    url: `/projects/${article.slug}`,
    meta: null,
  };
}

const MEASURE_DESC_FIELDS = [
  'description', 'description_about', 'description_benefit',
  'description_evaluation_criteria', 'description_implementation',
  'description_legal', 'description_funding', 'description_verification',
];

interface Measure {
  slug: string;
  name?: string;
  sector?: string;
  [key: string]: any;
}

// Return type is SearchDoc (never null) — callers no longer need a null check.
function buildMeasureDoc(measure: Measure): SearchDoc {
  const text = MEASURE_DESC_FIELDS.map(f => stripHtml(measure[f] || '')).filter(Boolean).join(' ');
  return {
    id: `measure:${measure.slug}`,
    type: 'measure',
    title: measure.name || '',
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
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  if (!name) return null;
  return {
    id: `member_${user.id}`,
    type: 'member',
    title: name,
    text: [name, stripHtml(user.bio || '')].filter(Boolean).join(' '),
    url: `/organisation#member-${user.id}`,
    meta: 'Teammitglied',
  };
}

// ── Hook registration ──

interface HookContext {
  action: (event: string, handler: (...args: any[]) => void) => void;
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

export default ({ action }: HookContext, { logger, env }: { logger: Logger; env: Record<string, string> }) => {
  const ms = new MeiliSearch({
    host: env.MEILISEARCH_URL || 'http://meilisearch:7700',
    apiKey: env.MEILISEARCH_MASTER_KEY || '',
  });
  const index = ms.index('site_content');

  async function upsert(doc: SearchDoc): Promise<void> {
    try {
      await index.addDocuments([doc]);
    } catch (e: any) {
      logger.error('[search-index] upsert failed:', e?.message ?? e);
    }
  }

  /**
   * Deletes a document from the index.
   * MeiliSearch raises an error when the document does not exist; we suppress
   * only that specific case and re-log everything else.
   */
  async function remove(id: string): Promise<void> {
    try {
      await index.deleteDocument(id);
    } catch (e: any) {
      // MeiliSearch returns "document_not_found" for missing docs — not a real error.
      if (e?.code !== 'document_not_found') {
        logger.error('[search-index] delete failed:', e?.message ?? e);
      }
    }
  }

  // ── blocks ──

  async function syncBlock(row: BlockRow, database: Database): Promise<void> {
    if (SKIP_BUNDLES.includes(row.bundle)) return;
    if (row.entity_type !== 'pages' || row.field_name !== 'content') return;

    if (row.status === 'archived') {
      await remove(`block:${row.uuid}`);
      return;
    }

    const pageRows = await database('pages').where('slug', row.entity_uuid).select('name').limit(1);
    const pageName = pageRows[0]?.name || row.entity_uuid;
    const doc = buildBlockDoc(row as unknown as Block, pageName);
    if (doc) await upsert(doc);
  }

  /**
   * Fetches a full block row by UUID or (fallback) numeric ID.
   * Returns null when nothing is found.
   */
  async function fetchBlockRow(key: string | number, database: Database): Promise<BlockRow | null> {
    const cols = ['uuid', 'bundle', 'props', 'entity_uuid', 'entity_type', 'field_name', 'status'] as const;
    // Prefer UUID lookup (string keys); fall back to numeric ID.
    const byUuid = await database('blocks').where('uuid', key).select(cols).limit(1);
    if (byUuid[0]) return byUuid[0] as BlockRow;

    const byId = await database('blocks').where('id', key).select(cols).limit(1);
    return byId[0] ? (byId[0] as BlockRow) : null;
  }

  action('items.create', async ({ collection, payload, key }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'blocks') return;
    // payload.uuid is the stable UUID; key is the numeric auto-increment id and
    // must NOT be used as the block identifier for the search index.
    const uuid: string | undefined = payload?.uuid;
    if (!uuid) {
      logger.warn('[search-index] blocks create: payload missing uuid, skipping');
      return;
    }
    // Re-fetch from DB so we have all fields, not just what was in the create payload.
    try {
      const row = await fetchBlockRow(uuid, database);
      if (row) await syncBlock(row, database);
    } catch (e: any) {
      logger.error('[search-index] blocks create fetch failed:', e?.message ?? e);
    }
  });

  action('items.update', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'blocks') return;
    for (const key of keys as (string | number)[]) {
      try {
        const row = await fetchBlockRow(key, database);
        if (row) await syncBlock(row, database);
      } catch (e: any) {
        logger.error('[search-index] blocks update fetch failed:', e?.message ?? e);
      }
    }
  });

  action('items.delete', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'blocks') return;
    // keys may be numeric IDs at this point since the rows are already gone.
    // We stored documents as `block:<uuid>`, so we need to resolve uuid before
    // deletion. If the row is already gone we fall back to treating the key as
    // a uuid (covers the case where a uuid string was passed as the key).
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database('blocks').where('id', key).select('uuid').limit(1);
        const uuid = rows[0]?.uuid ?? key;
        await remove(`block:${uuid}`);
      } catch {
        // Row already deleted — treat key as uuid as a best-effort fallback.
        await remove(`block:${key}`);
      }
    }
  });

  // ── pages ──

  action('items.create', async ({ collection, payload }: ActionPayload) => {
    if (collection !== 'pages') return;
    const page = payload as Page;
    if (!page?.slug) return;
    const doc = buildPageDoc(page);
    if (doc) await upsert(doc);
  });

  action('items.update', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'pages') return;
    for (const key of keys as (string | number)[]) {
      try {
        // Directus always passes numeric IDs in `keys` for items.update.
        const rows = await database('pages')
          .where('id', key)
          .select('slug', 'name', 'contents', 'status')
          .limit(1);
        if (!rows[0]) continue;
        const page = rows[0] as Page;
        if (page.status !== 'published') {
          await remove(`page:${page.slug}`);
        } else {
          const doc = buildPageDoc(page);
          if (doc) await upsert(doc);
          else await remove(`page:${page.slug}`);
        }
      } catch (e: any) {
        logger.error('[search-index] pages update fetch failed:', e?.message ?? e);
      }
    }
  });

  action('items.delete', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'pages') return;
    // Rows are gone by the time this hook fires; resolve slug from a pre-delete
    // snapshot if available, otherwise fall back to treating the key as a slug.
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database('pages').where('id', key).select('slug').limit(1);
        const slug = rows[0]?.slug ?? key;
        await remove(`page:${slug}`);
      } catch {
        await remove(`page:${key}`);
      }
    }
  });

  // ── events ──

  action('items.create', async ({ collection, payload }: ActionPayload) => {
    if (collection !== 'events') return;
    const doc = buildEventDoc(payload as Event);
    if (doc) await upsert(doc);
  });

  action('items.update', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'events') return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database('events')
          .where('id', key)
          .select('slug', 'title', 'description', 'event_type', 'status')
          .limit(1);
        if (!rows[0]) continue;
        const event = rows[0] as Event;
        if (event.status !== 'published') {
          await remove(`event:${event.slug}`);
        } else {
          const doc = buildEventDoc(event);
          if (doc) await upsert(doc);
        }
      } catch (e: any) {
        logger.error('[search-index] events update fetch failed:', e?.message ?? e);
      }
    }
  });

  action('items.delete', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'events') return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database('events').where('id', key).select('slug').limit(1);
        const slug = rows[0]?.slug ?? key;
        await remove(`event:${slug}`);
      } catch {
        await remove(`event:${key}`);
      }
    }
  });

  // ── articles ──

  action('items.create', async ({ collection, payload }: ActionPayload) => {
    if (collection !== 'articles') return;
    const doc = buildArticleDoc(payload as Article);
    if (doc) await upsert(doc);
  });

  action('items.update', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'articles') return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database('articles')
          .where('id', key)
          .select('slug', 'title', 'subtitle', 'abstract', 'article_text', 'status')
          .limit(1);
        if (!rows[0]) continue;
        const article = rows[0] as Article;
        if (article.status !== 'published') {
          await remove(`article:${article.slug}`);
        } else {
          const doc = buildArticleDoc(article);
          if (doc) await upsert(doc);
        }
      } catch (e: any) {
        logger.error('[search-index] articles update fetch failed:', e?.message ?? e);
      }
    }
  });

  action('items.delete', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'articles') return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database('articles').where('id', key).select('slug').limit(1);
        const slug = rows[0]?.slug ?? key;
        await remove(`article:${slug}`);
      } catch {
        await remove(`article:${key}`);
      }
    }
  });

  // ── measures ──

  action('items.create', async ({ collection, payload }: ActionPayload) => {
    if (collection !== 'measures') return;
    await upsert(buildMeasureDoc(payload as Measure));
  });

  action('items.update', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'measures') return;
    for (const key of keys as (string | number)[]) {
      try {
        const fields = ['slug', 'name', 'sector', ...MEASURE_DESC_FIELDS];
        const rows = await database('measures').where('id', key).select(fields).limit(1);
        if (!rows[0]) continue;
        await upsert(buildMeasureDoc(rows[0] as Measure));
      } catch (e: any) {
        logger.error('[search-index] measures update fetch failed:', e?.message ?? e);
      }
    }
  });

  action('items.delete', async ({ collection, keys }: ActionPayload, { database }: ActionContext) => {
    if (collection !== 'measures') return;
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database('measures').where('id', key).select('slug').limit(1);
        const slug = rows[0]?.slug ?? key;
        await remove(`measure:${slug}`);
      } catch {
        await remove(`measure:${key}`);
      }
    }
  });

  // ── directus_users (team members) ──

  action('users.create', async ({ payload, key }: ActionPayload) => {
    const user: User = { ...payload, id: payload?.id ?? key };
    const doc = buildMemberDoc(user);
    if (doc) await upsert(doc);
  });

  action('users.update', async ({ keys, payload }: ActionPayload, { database }: ActionContext) => {
    for (const key of keys as (string | number)[]) {
      try {
        const rows = await database('directus_users')
          .where('id', key)
          .select('id', 'first_name', 'last_name', 'bio', 'show_on_team_page')
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
        logger.error('[search-index] users update fetch failed:', e?.message ?? e);
      }
    }
  });

  /**
   * FIX: Directus passes deleted user IDs via `keys`, not `payload`.
   * The original code read `payload` which is always undefined here.
   */
  action('users.delete', async ({ keys }: ActionPayload) => {
    for (const id of keys as (string | number)[]) {
      await remove(`member_${id}`);
    }
  });
};
