import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)
  const name = query.name as string | undefined

  if (!name) {
    return { municipality: null }
  }

  const results = await client.request(readItems('municipalities', {
    filter: { name: { _eq: name } },
    fields: [
      'slug', 'ars',
      { scores: ['catalog_version', 'published', 'percentage_rated'] },
    ],
    limit: 1,
  }))

  return { municipality: results[0] || null }
})
