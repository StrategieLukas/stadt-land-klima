import { MeiliSearch } from 'meilisearch'

const SKIP_BUNDLES = ['container', 'carousel', 'directus_page', 'vega_chart', 'page_nav']

// ── Text extraction helpers (intentionally duplicated from server/utils/extractContent.ts) ──

function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function stripMd(s) {
  return (s || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const BUNDLE_LABELS = {
  text: 'Text', richtext: 'Fließtext', heading: 'Überschrift', hero: 'Hero',
  citation: 'Zitat', stat: 'Kennzahl', timeline: 'Zeitstrahl',
  timeline_item: 'Zeitleisten-Eintrag', button: 'Schaltfläche',
  image: 'Bild', video: 'Video', progress_bar: 'Fortschrittsbalken',
}

function bundleLabel(bundle) {
  return BUNDLE_LABELS[bundle] ?? bundle
}

function extractBlockText(bundle, props) {
  const p = props || {}
  const parts = []
  const add = (...vals) => vals.forEach(v => v && parts.push(String(v).trim()))

  switch (bundle) {
    case 'text':          parts.push(stripHtml(p.content)); break
    case 'richtext':      parts.push(stripMd(p.content)); break
    case 'heading':       add(p.text); break
    case 'hero':          add(p.title, p.subtitle); break
    case 'citation':      add(p.quote, p.attribution); break
    case 'stat':          add(p.label, p.description, p.value); break
    case 'timeline':      add(p.title); break
    case 'timeline_item': add(p.title, p.description, p.date); break
    case 'button':        add(p.label); break
    case 'image':         add(p.caption, p.alt); break
    case 'video':         add(p.caption); break
    case 'progress_bar':  add(p.label, p.description); break
    default: break
  }

  return parts.filter(Boolean).join(' ')
}

function buildBlockDoc(block, pageName) {
  const text = extractBlockText(block.bundle, block.props || {})
  if (!text) return null
  return {
    id: `block:${block.uuid}`,
    type: 'block',
    title: pageName || block.entity_uuid,
    text,
    url: `/${block.entity_uuid}#block-${block.uuid}`,
    meta: bundleLabel(block.bundle),
  }
}

function buildPageDoc(page) {
  if (!page.contents) return null
  return {
    id: `page:${page.slug}`,
    type: 'page',
    title: page.name || page.slug,
    text: stripHtml(page.contents),
    url: `/${page.slug}`,
    meta: null,
  }
}

function buildEventDoc(event) {
  if (event.status !== 'published') return null
  return {
    id: `event:${event.slug}`,
    type: 'event',
    title: event.title || '',
    text: stripHtml(event.description || ''),
    url: `/events/${event.slug}`,
    meta: event.event_type || null,
  }
}

function buildArticleDoc(article) {
  if (article.status !== 'published') return null
  const text = [
    article.subtitle,
    stripMd(article.abstract || ''),
    stripMd(article.article_text || ''),
  ].filter(Boolean).join(' ')
  return {
    id: `article:${article.slug}`,
    type: 'article',
    title: article.title || '',
    text,
    url: `/projects/${article.slug}`,
    meta: null,
  }
}

const MEASURE_DESC_FIELDS = [
  'description', 'description_about', 'description_benefit',
  'description_evaluation_criteria', 'description_implementation',
  'description_legal', 'description_funding', 'description_verification',
]

function buildMeasureDoc(measure) {
  const text = MEASURE_DESC_FIELDS.map(f => stripHtml(measure[f] || '')).filter(Boolean).join(' ')
  return {
    id: `measure:${measure.slug}`,
    type: 'measure',
    title: measure.name || '',
    text,
    url: `/measures/${measure.slug}`,
    meta: measure.sector || null,
  }
}

// ── Hook registration ──

export default ({ action }, { logger, env }) => {
  const ms = new MeiliSearch({
    host: env.MEILISEARCH_URL || 'http://meilisearch:7700',
    apiKey: env.MEILISEARCH_MASTER_KEY || '',
  })
  const index = ms.index('site_content')

  async function upsert(doc) {
    try {
      await index.addDocuments([doc])
    } catch (e) {
      logger.error('[search-index] upsert failed:', e?.message ?? e)
    }
  }

  async function remove(id) {
    try {
      await index.deleteDocument(id)
    } catch (e) {
      logger.error('[search-index] delete failed:', e?.message ?? e)
    }
  }

  // ── blocks ──

  async function syncBlock(payload, database) {
    if (SKIP_BUNDLES.includes(payload.bundle)) return
    if (payload.entity_type !== 'pages' || payload.field_name !== 'content') return
    if (payload.status === 'archived') {
      await remove(`block:${payload.uuid}`)
      return
    }
    const rows = await database('pages').where('slug', payload.entity_uuid).select('name').limit(1)
    const pageName = rows[0]?.name || payload.entity_uuid
    const doc = buildBlockDoc(payload, pageName)
    if (doc) await upsert(doc)
  }

  action('items.create', async ({ collection, payload, key }, { database }) => {
    if (collection !== 'blocks') return
    // On create, uuid may be the key itself or in payload.uuid
    const blockData = { ...payload, uuid: payload.uuid || key }
    await syncBlock(blockData, database)
  })

  action('items.update', async ({ collection, keys, payload }, { database }) => {
    if (collection !== 'blocks') return
    // Re-fetch full block data for each updated key
    for (const key of keys) {
      try {
        const rows = await database('blocks').where('uuid', key).select('uuid', 'bundle', 'props', 'entity_uuid', 'entity_type', 'field_name', 'status').limit(1)
        if (!rows[0]) {
          // Try by numeric id if uuid lookup failed
          const rowsById = await database('blocks').where('id', key).select('uuid', 'bundle', 'props', 'entity_uuid', 'entity_type', 'field_name', 'status').limit(1)
          if (rowsById[0]) await syncBlock(rowsById[0], database)
        } else {
          await syncBlock(rows[0], database)
        }
      } catch (e) {
        logger.error('[search-index] blocks update fetch failed:', e?.message ?? e)
      }
    }
  })

  action('items.delete', async ({ collection, keys }) => {
    if (collection !== 'blocks') return
    for (const key of keys) {
      // key may be numeric id or uuid — try uuid format first
      await remove(`block:${key}`)
    }
  })

  // ── pages ──

  action('items.create', async ({ collection, payload }) => {
    if (collection !== 'pages') return
    const doc = buildPageDoc(payload)
    if (doc) await upsert(doc)
    else if (payload.slug) await remove(`page:${payload.slug}`)
  })

  action('items.update', async ({ collection, keys, payload }, { database }) => {
    if (collection !== 'pages') return
    for (const key of keys) {
      try {
        const rows = await database('pages').where('id', key).orWhere('slug', key).select('slug', 'name', 'contents', 'status').limit(1)
        if (!rows[0]) continue
        const page = rows[0]
        if (page.status !== 'published') {
          await remove(`page:${page.slug}`)
        } else {
          const doc = buildPageDoc(page)
          if (doc) await upsert(doc)
          else await remove(`page:${page.slug}`)
        }
      } catch (e) {
        logger.error('[search-index] pages update fetch failed:', e?.message ?? e)
      }
    }
  })

  action('items.delete', async ({ collection, payload, keys }, { database }) => {
    if (collection !== 'pages') return
    for (const key of keys) {
      // Try to get slug from payload or use key directly
      const slug = payload?.slug || key
      await remove(`page:${slug}`)
    }
  })

  // ── events ──

  action('items.create', async ({ collection, payload }) => {
    if (collection !== 'events') return
    const doc = buildEventDoc(payload)
    if (doc) await upsert(doc)
  })

  action('items.update', async ({ collection, keys, payload }, { database }) => {
    if (collection !== 'events') return
    for (const key of keys) {
      try {
        const rows = await database('events').where('id', key).select('slug', 'title', 'description', 'event_type', 'status').limit(1)
        if (!rows[0]) continue
        const event = rows[0]
        if (event.status !== 'published') {
          await remove(`event:${event.slug}`)
        } else {
          const doc = buildEventDoc(event)
          if (doc) await upsert(doc)
        }
      } catch (e) {
        logger.error('[search-index] events update fetch failed:', e?.message ?? e)
      }
    }
  })

  action('items.delete', async ({ collection, keys }, { database }) => {
    if (collection !== 'events') return
    for (const key of keys) {
      try {
        const rows = await database('events').where('id', key).select('slug').limit(1)
        const slug = rows[0]?.slug || key
        await remove(`event:${slug}`)
      } catch {
        await remove(`event:${key}`)
      }
    }
  })

  // ── articles ──

  action('items.create', async ({ collection, payload }) => {
    if (collection !== 'articles') return
    const doc = buildArticleDoc(payload)
    if (doc) await upsert(doc)
  })

  action('items.update', async ({ collection, keys }, { database }) => {
    if (collection !== 'articles') return
    for (const key of keys) {
      try {
        const rows = await database('articles').where('id', key).select('slug', 'title', 'subtitle', 'abstract', 'article_text', 'status').limit(1)
        if (!rows[0]) continue
        const article = rows[0]
        if (article.status !== 'published') {
          await remove(`article:${article.slug}`)
        } else {
          const doc = buildArticleDoc(article)
          if (doc) await upsert(doc)
        }
      } catch (e) {
        logger.error('[search-index] articles update fetch failed:', e?.message ?? e)
      }
    }
  })

  action('items.delete', async ({ collection, keys }, { database }) => {
    if (collection !== 'articles') return
    for (const key of keys) {
      try {
        const rows = await database('articles').where('id', key).select('slug').limit(1)
        const slug = rows[0]?.slug || key
        await remove(`article:${slug}`)
      } catch {
        await remove(`article:${key}`)
      }
    }
  })

  // ── measures ──

  action('items.create', async ({ collection, payload }) => {
    if (collection !== 'measures') return
    const doc = buildMeasureDoc(payload)
    if (doc) await upsert(doc)
  })

  action('items.update', async ({ collection, keys }, { database }) => {
    if (collection !== 'measures') return
    for (const key of keys) {
      try {
        const fields = ['slug', 'name', 'sector', ...MEASURE_DESC_FIELDS]
        const rows = await database('measures').where('id', key).select(fields).limit(1)
        if (!rows[0]) continue
        const doc = buildMeasureDoc(rows[0])
        if (doc) await upsert(doc)
      } catch (e) {
        logger.error('[search-index] measures update fetch failed:', e?.message ?? e)
      }
    }
  })

  action('items.delete', async ({ collection, keys }, { database }) => {
    if (collection !== 'measures') return
    for (const key of keys) {
      try {
        const rows = await database('measures').where('id', key).select('slug').limit(1)
        const slug = rows[0]?.slug || key
        await remove(`measure:${slug}`)
      } catch {
        await remove(`measure:${key}`)
      }
    }
  })
}
