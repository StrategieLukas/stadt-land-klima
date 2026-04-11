import { createDirectus, rest, readItems, staticToken } from '@directus/sdk'
import {
  buildBlockDoc, buildPageDoc, buildEventDoc, buildArticleDoc, buildMeasureDoc,
  buildNewsItemDoc,
  buildStaticPageDocs,
  type SiteContentDoc,
} from '../utils/extractContent'

const SKIP_BUNDLES = ['container', 'carousel', 'directus_page', 'vega_chart', 'page_nav']
const BATCH_SIZE = 200
const REINDEX_INTERVAL_MS_DEV = 15 * 60 * 1000
const REINDEX_INTERVAL_MS_PROD = 60 * 60 * 1000

type ReindexGlobals = typeof globalThis & {
  __slkReindexTimer?: ReturnType<typeof setInterval>
  __slkReindexRunning?: boolean
}

async function upsertBatch(index: any, docs: SiteContentDoc[]) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    await index.addDocuments(docs.slice(i, i + BATCH_SIZE))
  }
}

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const ms = getMeilisearch()
  const index = ms.index('site_content')
  const reindexIntervalMs = process.env.NODE_ENV === 'production'
    ? REINDEX_INTERVAL_MS_PROD
    : REINDEX_INTERVAL_MS_DEV

  // Configure index (idempotent)
  try {
    await index.updateSettings({
      searchableAttributes: ['title', 'text', 'meta'],
      filterableAttributes: ['type'],
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
      },
      stopWords: ['der', 'die', 'das', 'und', 'oder', 'in', 'von', 'zu', 'mit', 'für', 'bei', 'an'],
    })
  } catch (e) {
    console.error('[reindex] Failed to configure Meilisearch index settings:', e)
    return
  }

  const directus = createDirectus(
    (config.public.serverDirectusUrl as string) || 'http://directus:8055',
  )
    .with(rest())
    .with(staticToken(config.public.directusToken as string))

  const g = globalThis as ReindexGlobals

  const runReindex = async () => {
    if (g.__slkReindexRunning) {
      console.log('[reindex] Previous run still in progress, skipping this cycle')
      return
    }

    g.__slkReindexRunning = true
    const counts: Record<string, number> = {}

    try {
      // --- Blocks ---
      const pages = await directus.request(
        (readItems as Function)('pages', { limit: -1, fields: ['slug', 'name'] }),
      ) as any[]
      const pageNameBySlug = Object.fromEntries((pages || []).map((p: any) => [p.slug, p.name]))

      const blocks = await directus.request(
        (readItems as Function)('blocks', {
          limit: -1,
          filter: {
            status: { _neq: 'archived' },
            entity_type: { _eq: 'pages' },
            field_name: { _eq: 'content' },
            bundle: { _nin: SKIP_BUNDLES },
          },
          fields: ['uuid', 'bundle', 'props', 'entity_uuid'],
        }),
      ) as any[]

      const blockDocs = (blocks || [])
        .map((b: any) => buildBlockDoc(b, pageNameBySlug[b.entity_uuid] || b.entity_uuid))
        .filter((d): d is SiteContentDoc => d !== null)
      await upsertBatch(index, blockDocs)
      counts.blocks = blockDocs.length

      // --- News blocks ---
      const newsItems = await directus.request(
        (readItems as Function)('news_items', {
          limit: -1,
          filter: { status: { _eq: 'published' } },
          fields: ['slug', 'title', 'teaser', 'status'],
        }),
      ) as any[]
      const newsTitleBySlug = Object.fromEntries((newsItems || []).map((n: any) => [n.slug, n.title]))

      const newsBlocks = await directus.request(
        (readItems as Function)('blocks', {
          limit: -1,
          filter: {
            status: { _neq: 'archived' },
            entity_type: { _eq: 'news_items' },
            field_name: { _eq: 'content' },
            bundle: { _nin: SKIP_BUNDLES },
          },
          fields: ['uuid', 'bundle', 'props', 'entity_uuid'],
        }),
      ) as any[]
      const newsBlockDocs = (newsBlocks || [])
        .map((b: any) => buildBlockDoc(b, newsTitleBySlug[b.entity_uuid] || b.entity_uuid, '/news'))
        .filter((d): d is SiteContentDoc => d !== null)
      await upsertBatch(index, newsBlockDocs)
      counts.news_blocks = newsBlockDocs.length

      // --- Pages (legacy HTML content only) ---
      const pageDocs = (pages || [])
        .filter((p: any) => p.status === 'published' || p.status === undefined)
        .map((p: any) => buildPageDoc(p))
        .filter((d): d is SiteContentDoc => d !== null)
      await upsertBatch(index, pageDocs)
      counts.pages = pageDocs.length

      // --- Events ---
      const events = await directus.request(
        (readItems as Function)('events', {
          limit: -1,
          filter: { status: { _eq: 'published' } },
          fields: ['slug', 'title', 'description', 'event_type', 'status'],
        }),
      ) as any[]
      const eventDocs = (events || [])
        .map((e: any) => buildEventDoc(e))
        .filter((d): d is SiteContentDoc => d !== null)
      await upsertBatch(index, eventDocs)
      counts.events = eventDocs.length

      // --- News items ---
      const newsItemDocs = (newsItems || [])
        .map((n: any) => buildNewsItemDoc(n))
        .filter((d): d is SiteContentDoc => d !== null)
      await upsertBatch(index, newsItemDocs)
      counts.news_items = newsItemDocs.length

      // --- Articles ---
      const articles = await directus.request(
        (readItems as Function)('articles', {
          limit: -1,
          filter: { status: { _eq: 'published' } },
          fields: ['slug', 'title', 'subtitle', 'abstract', 'article_text', 'status'],
        }),
      ) as any[]
      const articleDocs = (articles || [])
        .map((a: any) => buildArticleDoc(a))
        .filter((d): d is SiteContentDoc => d !== null)
      await upsertBatch(index, articleDocs)
      counts.articles = articleDocs.length

      // --- Measures ---
      // Fetch only from the isCurrentFrontend catalog so URLs always resolve correctly.
      const catalogVersions = await directus.request(
        (readItems as Function)('measure_catalog', {
          filter: { hidden: { _eq: false }, isCurrentFrontend: { _eq: true } },
          fields: ['id', 'name'],
          limit: 1,
        }),
      ) as any[]
      const frontendCatalog = catalogVersions?.[0]
      const measures = frontendCatalog
        ? await directus.request(
            (readItems as Function)('measures', {
              limit: -1,
              filter: { catalog_version: { _eq: frontendCatalog.id } },
              fields: [
                'slug', 'name', 'sector',
                'description', 'description_about', 'description_benefit',
                'description_evaluation_criteria', 'description_implementation',
                'description_legal', 'description_funding', 'description_verification',
              ],
            }),
          ) as any[]
        : []
      const measureDocs = (measures || [])
        .map((m: any) => buildMeasureDoc(m, frontendCatalog?.name))
        .filter((d): d is SiteContentDoc => d !== null)

      // Remove stale measure documents (IDs not in the current batch) by fetching + diffing.
      try {
        const newIds = new Set(measureDocs.map(d => d.id))
        const existing = await index.getDocuments({ filter: 'type = "measure"', limit: 200 })
        const toDelete = existing.results
          .map((d: any) => d.id as string)
          .filter((id: string) => !newIds.has(id))
        if (toDelete.length > 0) {
          const delTask = await index.deleteDocuments(toDelete)
          await ms.waitForTask(delTask.taskUid)
        }
      } catch (e) {
        console.warn('[reindex] Failed to delete stale measure docs:', e)
      }

      await upsertBatch(index, measureDocs)
      counts.measures = measureDocs.length

      // --- Static Nuxt pages ---
      const staticDocs = buildStaticPageDocs()
      await upsertBatch(index, staticDocs)
      counts.static_pages = staticDocs.length

      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      console.log(`[reindex] Indexed ${total} documents:`, counts)
    } catch (e) {
      console.error('[reindex] Failed to index content:', e)
    } finally {
      g.__slkReindexRunning = false
    }
  }

  // Run once on startup.
  await runReindex()

  // In dev/HMR, avoid multiple timers by replacing the previous interval.
  if (g.__slkReindexTimer) {
    clearInterval(g.__slkReindexTimer)
  }
  g.__slkReindexTimer = setInterval(() => {
    void runReindex()
  }, reindexIntervalMs)

  console.log(`[reindex] Periodic reindex enabled every ${Math.round(reindexIntervalMs / 60000)} minutes`)
})
