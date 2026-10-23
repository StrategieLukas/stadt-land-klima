import { cmsString, cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, createError } from 'h3'
import { createDirectusServerClient } from '../utils/directusServerClient'
import { rateLimit } from '../utils/rateLimit'

export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, 'register-check'))) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
  const query = getQuery(event)
  const ars = query.ars as string | undefined

  if (!ars || typeof ars !== 'string') {
    return { hasTeam: false, slug: null, percentageRated: null, published: false }
  }

  try {
    const client = createDirectusServerClient()

    // Get current backend catalog version
    const catalogs = await client.request(readItems('measure_catalog', {
      filter: { isCurrentBackend: { _eq: true } },
      fields: ['id'],
      limit: 1,
    })).then(cmsRows)
    const currentCatalogId = catalogs[0]?.id
    if (!currentCatalogId) {
      return { hasTeam: false, slug: null, percentageRated: null, published: false }
    }

    // Check for existing localteam by ARS
    const municipalities = await client.request(readItems('municipalities', {
      filter: {
        _and: [
          { localteam_id: { _nnull: true } },
          { ars: { _eq: ars } },
        ],
      },
      fields: [
        'ars', 'slug', 'localteam_id',
        { scores: ['catalog_version', 'published', 'percentage_rated'] },
      ],
      limit: 1,
    })).then(cmsRows)

    const municipality = municipalities[0]
    if (!municipality?.localteam_id) {
      return { hasTeam: false, slug: null, percentageRated: null, published: false }
    }

    // Find the score for the current backend catalog
    const score = parseCms(z.array(z.object({catalog_version: z.union([z.string(), z.object({id: z.string()})]).nullable(), published: z.boolean().nullish(), percentage_rated: z.union([z.number(), z.string()]).nullish()})), municipality.scores ?? []).find((item) => {
      const catalogVersion = typeof item.catalog_version === 'object'
        ? item.catalog_version?.id
        : item.catalog_version
      return catalogVersion === currentCatalogId
    })

    return {
      hasTeam: true,
      slug: municipality.slug == null ? null : cmsString(municipality.slug),
      percentageRated: score?.percentage_rated ?? null,
      published: score?.published === true,
    }
  } catch {
    return { hasTeam: false, slug: null, percentageRated: null, published: false }
  }
})
