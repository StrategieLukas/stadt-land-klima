import { readItems } from '@directus/sdk'
import { defineEventHandler, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()

  // Get published tour series
  const series = await client.request(readItems('success_project_tours', {
    filter: { status: { _eq: 'published' } },
    fields: ['id', 'slug', 'title', 'featured_on_projects'],
    limit: -1,
  }))

  if (!series.length) {
    return { series, links: [] }
  }

  // Get published stops for these tours
  const stops = await client.request(readItems('success_project_tour_stops', {
    filter: {
      status: { _eq: 'published' },
      tour: { id: { _in: series.map((s: any) => s.id) }, status: { _eq: 'published' } },
    },
    fields: ['id', 'tour'],
    limit: -1,
  }))

  if (!stops.length) {
    return { series, links: [] }
  }

  // Get article links for these stops
  const links = await client.request(readItems('success_project_tour_stops_articles', {
    filter: { stop: { id: { _in: stops.map((s: any) => s.id) } } },
    fields: ['stop', 'articles_id'],
    limit: -1,
  }))

  // Map stop -> tour
  const seriesByStop = Object.fromEntries(stops.map((s: any) => [s.id, s.tour]))

  // Return links with series and article mapped
  const mappedLinks = links.map((l: any) => ({
    series: seriesByStop[l.stop],
    article: l.articles_id,
  }))

  return { series, links: mappedLinks }
})
