import { NewsDetailSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const items = await client.request(readItems('news_items', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: [
      'id', 'slug', 'title', 'teaser', 'author', 'date_published', 'date_created',
      'status', 'image_credits', 'is_tour_redirect',
      { tour_stop: ['id', 'slug', { tour: ['slug', 'title'] }] },
      { image: ['id', 'type'] },
      { report_event: ['id', 'slug', 'title', { series: ['slug', 'title', 'format'] }] },
    ],
    limit: 1,
  }))

  if (!items.length) {
    throw createError({ statusCode: 404, statusMessage: 'News item not found' })
  }

  return { item: parseCms(NewsDetailSchema, items[0]) }
})
