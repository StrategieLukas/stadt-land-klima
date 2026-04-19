export default defineEventHandler(async (event) => {
  const { q, limit = '12', types } = getQuery(event) as Record<string, string>

  if (!q || q.trim().length < 2) return { hits: [] }

  const filter = types
    ? `type IN [${types.split(',').map(t => `"${t.trim()}"`).join(', ')}]`
    : undefined

  try {
    const index = getMeilisearch().index('site_content')
    const result = await index.search(q.trim(), {
      limit: Math.min(parseInt(limit) || 12, 30),
      filter,
      attributesToHighlight: ['text', 'title'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      attributesToRetrieve: ['id', 'type', 'title', 'url', 'meta', 'text'],
    })

    return {
      hits: result.hits.map(h => ({
        id: h.id,
        type: h.type,
        title: (h as any)._formatted?.title ?? h.title,
        excerpt: ((h as any)._formatted?.text ?? h.text ?? '').slice(0, 200),
        url: h.url,
        meta: h.meta ?? null,
      })),
    }
  } catch (e) {
    console.error('[content-search] Meilisearch error:', e)
    return { hits: [] }
  }
})
