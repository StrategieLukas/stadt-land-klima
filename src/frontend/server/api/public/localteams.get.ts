import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const localteamFields = ['id', 'name', 'slug', 'municipality_id', 'municipality_name']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const filter: Record<string, any> = { status: { _eq: 'published' } }
  if (typeof query.municipalitySlug === 'string' && query.municipalitySlug) {
    filter.municipality_name = { _eq: query.municipalitySlug }
  }

  const localteams = await client.request(readItems('localteams', {
    filter,
    fields: localteamFields,
    sort: ['name'],
    limit: 200,
  }))

  return { localteams: localteams.map(lt => pick(lt, localteamFields)) }
})
