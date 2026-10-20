import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery } from 'h3'
import { createDirectusServerClient } from '../utils/directusServerClient'

export default defineEventHandler(async (event) => {
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
    }))
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
    }))

    const municipality = municipalities[0]
    if (!municipality?.localteam_id) {
      return { hasTeam: false, slug: null, percentageRated: null, published: false }
    }

    // Find the score for the current backend catalog
    const score = (municipality.scores ?? []).find((item: any) => {
      const catalogVersion = typeof item.catalog_version === 'object'
        ? item.catalog_version?.id
        : item.catalog_version
      return catalogVersion === currentCatalogId
    })

    return {
      hasTeam: true,
      slug: municipality.slug ?? null,
      percentageRated: score?.percentage_rated ?? null,
      published: score?.published === true,
    }
  } catch {
    return { hasTeam: false, slug: null, percentageRated: null, published: false }
  }
})
