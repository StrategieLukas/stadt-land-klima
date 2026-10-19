import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const articleListFields = ['id', 'slug', 'title', 'abstract', 'image', 'image_credits', 'date_created', 'municipality_name', 'sectors', 'measures']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const filter: Record<string, any> = { status: { _eq: 'published' } }
  if (typeof query.municipality === 'string' && query.municipality) {
    filter.municipality_name = { _eq: query.municipality }
  }

  const limit = Math.min(Number(query.limit) || 20, 100)
  const sort = typeof query.sort === 'string' ? query.sort : '-date_created'

  const articles = await client.request(readItems('articles', {
    filter,
    fields: articleListFields,
    sort: [sort],
    limit,
  }))

  return { articles: articles.map(a => pick(a, articleListFields)) }
})
