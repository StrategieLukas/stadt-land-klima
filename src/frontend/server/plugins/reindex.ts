import { createDirectus, rest, readItems, staticToken } from '@directus/sdk'
import {
  buildBlockDoc, buildPageDoc, buildEventDoc, buildArticleDoc, buildMeasureDoc,
  buildStaticPageDocs,
  type SiteContentDoc,
} from '../utils/extractContent'

const SKIP_BUNDLES = ['container', 'carousel', 'directus_page', 'vega_chart', 'page_nav']
const BATCH_SIZE = 200

async function upsertBatch(index: any, docs: SiteContentDoc[]) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    await index.addDocuments(docs.slice(i, i + BATCH_SIZE))
  }
}

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const ms = getMeilisearch()
  const index = ms.index('site_content')

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
    const measures = await directus.request(
      (readItems as Function)('measures', {
        limit: -1,
        fields: [
          'slug', 'name', 'sector',
          'description', 'description_about', 'description_benefit',
          'description_evaluation_criteria', 'description_implementation',
          'description_legal', 'description_funding', 'description_verification',
        ],
      }),
    ) as any[]
    const measureDocs = (measures || [])
      .map((m: any) => buildMeasureDoc(m))
      .filter((d): d is SiteContentDoc => d !== null)
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
  }
})
