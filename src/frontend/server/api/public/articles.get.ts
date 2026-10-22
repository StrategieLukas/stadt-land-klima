import { z } from "zod";
import { ProjectListSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()

  const articles = await client.request(readItems('articles', {
    filter: { status: { _eq: 'published' } },
    fields: [
      'id', 'slug', 'title', 'abstract', 'author', 'date_created',
      'municipality_name', 'state', 'sectors', 'can_do_autonomously',
      'is_profitable', 'public_impact_effects', 'ghg_savings_level',
      'profile_stage', 'image_credits',
      { municipality: ['id', 'name', 'state', 'geolocation'] },
      { image: ['id', 'type'] },
      { organisation: ['id', 'name', 'logo'] },
      { measures: [{ measures_id: ['id', 'measure_id', 'name', 'slug'] }] },
    ],
    sort: ['-date_created'],
    limit: -1,
  }))

  return { articles: parseCms(z.array(ProjectListSchema), articles) }
})
