import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)
  const kind = query.kind as string
  const slug = query.slug as string

  if (!kind || !['tour', 'stop'].includes(kind)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid kind parameter' })
  }
  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const collection = kind === 'tour' ? 'success_project_tours' : 'success_project_tour_stops'

  const filter = kind === 'tour'
    ? { slug: { _eq: slug }, status: { _eq: 'published' } }
    : { slug: { _eq: slug }, tour: { status: { _eq: 'published' } } }

  const fields = kind === 'tour'
    ? ['slug']
    : ['slug', { tour: ['slug'] }]

  const rows = await client.request(readItems(collection, {
    filter,
    fields,
    limit: 1,
  }))

  if (!rows || rows.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return { found: true, data: rows[0] }
})
