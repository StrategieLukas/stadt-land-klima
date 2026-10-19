import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const pageFields = ['id', 'slug', 'title', 'content', 'status']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  const pages = await client.request(readItems('pages', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: pageFields,
    limit: 1,
  }))

  if (!pages || pages.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  return { page: pick(pages[0], pageFields) }
})
