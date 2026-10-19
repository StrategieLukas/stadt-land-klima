import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest } from '../../utils/municipalityPageData'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogForRequest(catalogs, query.v, false)

  // Support ARS codes or slugs
  const ars = typeof query.ars === 'string' ? query.ars.split(',').map(s => s.trim()).filter(Boolean) : []
  const slugs = typeof query.slugs === 'string' ? query.slugs.split(',').map(s => s.trim()).filter(Boolean) : []

  if (ars.length === 0 && slugs.length === 0) {
    return { municipalities: [] }
  }

  const filter: Record<string, any> = { status: { _eq: 'published' } }
  if (ars.length > 0) filter.ars = { _in: ars }
  if (slugs.length > 0) filter.slug = { _in: slugs }

  const municipalities = await client.request(readItems('municipalities', {
    filter,
    fields: ['id', 'ars', 'slug', 'name', 'localteam_id.id'],
    limit: 200,
  }))

  if (municipalities.length === 0) {
    return { municipalities: [] }
  }

  const localteamIds = municipalities
    .map((m: any) => m.localteam_id?.id)
    .filter(Boolean)

  const scores = localteamIds.length > 0
    ? await client.request(readItems('municipality_scores', {
        filter: {
          localteam_id: { _in: localteamIds },
          catalog_version: { _eq: selectedCatalog.id },
          published: { _eq: true },
        },
        fields: ['published', 'percentage_rated', 'score_total', 'catalog_version', 'localteam_id.id'],
        limit: 500,
      }))
    : []

  const scoreByLocalteam = new Map<string, Row[]>()
  for (const score of scores) {
    const ltId = typeof score.localteam_id === 'object' ? score.localteam_id.id : score.localteam_id
    if (!scoreByLocalteam.has(String(ltId))) scoreByLocalteam.set(String(ltId), [])
    scoreByLocalteam.get(String(ltId))!.push(pick(score, ['published', 'percentage_rated', 'score_total', 'catalog_version']))
  }

  const result = municipalities.map((m: any) => {
    const ltId = m.localteam_id?.id
    return {
      ars: m.ars,
      slug: m.slug,
      localteam_id: ltId || null,
      scores: ltId ? scoreByLocalteam.get(String(ltId)) || [] : [],
    }
  })

  return { municipalities: result }
})
