import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const electionFields = ['id', 'is_public', 'is_party_election', 'descriptor', 'custom_logo', 'sharepic', 'response_cutoff_date', 'localteam']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()

  const elections = await client.request(readItems('elections', {
    filter: { is_public: { _eq: true } },
    fields: [...electionFields, 'localteam.id', 'localteam.name', 'localteam.slug'],
    sort: ['-date_created'],
    limit: 50,
  }))

  return {
    elections: elections.map(e => ({
      ...pick(e, electionFields),
      localteam: e.localteam ? pick(e.localteam, ['id', 'name', 'slug']) : null,
    })),
  }
})
