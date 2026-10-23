import { cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { EventSeriesSchema, EventSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

const seriesFields = ['id', 'slug', 'title', 'introduction', 'format', 'cover_image', 'cover_image_credits', 'brand_logo', 'closing_reflection']


export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Event series not found' })
  }

  const series = await client.request(readItems('event_series', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: seriesFields,
    limit: 1,
  })).then(cmsRows)

  if (!series || series.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Event series not found' })
  }

  const row = parseCms(EventSeriesSchema, series[0]);
  // Fetch related events independently so draft events never enter a public series.
  const events = await client.request(readItems('events', {
    filter: {series: {_eq: row.id}, status: {_eq: 'published'}},
    fields: ['id', 'slug', 'title', 'description', 'start_date', 'end_date', 'date_only', 'location', 'event_type', 'event_category', 'image', 'image_credits'],
    sort: ['start_date'], limit: 1001,
  })).then(cmsRows);
  if (events.length > 1000) throw createError({statusCode: 502, statusMessage: 'Event limit exceeded'});
  return {series: row, events: parseCms(z.array(EventSchema), events)};
})
