import { cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { ContentIdentitySchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()

  // Get published tour series
  const series = parseCms(z.array(ContentIdentitySchema.extend({featured_on_projects: z.boolean()})), await client.request(readItems('success_project_tours', {
    filter: { status: { _eq: 'published' } },
    fields: ['id', 'slug', 'title', 'featured_on_projects'],
    limit: -1,
  })).then(cmsRows))

  if (!series.length) {
    return { series, links: [] }
  }

  // Get published stops for these tours
  const stops = parseCms(z.array(z.object({id: z.string(), tour: z.string()})), await client.request(readItems('success_project_tour_stops', {
    filter: {
      status: { _eq: 'published' },
      tour: { id: { _in: series.map((s) => s.id) }, status: { _eq: 'published' } },
    },
    fields: ['id', 'tour'],
    limit: -1,
  })).then(cmsRows))

  if (!stops.length) {
    return { series, links: [] }
  }

  // Get article links for these stops
  const links = parseCms(z.array(z.object({stop: z.string(), articles_id: z.number().int().nullable()})), await client.request(readItems('success_project_tour_stops_articles', {
    filter: { stop: { id: { _in: stops.map((s) => s.id) } }, articles_id: { status: { _eq: 'published' } } },
    fields: ['stop', 'articles_id'],
    limit: -1,
  })).then(cmsRows))

  // Map stop -> tour
  const seriesByStop = Object.fromEntries(stops.map((s) => [s.id, s.tour]))

  // Return links with series and article mapped
  const mappedLinks = links.filter(link => link.articles_id && seriesByStop[link.stop]).map((l) => ({
    series: seriesByStop[l.stop]!,
    article: l.articles_id!,
  }))

  return { series, links: mappedLinks }
})
