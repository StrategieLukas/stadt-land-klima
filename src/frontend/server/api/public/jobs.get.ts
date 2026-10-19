import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const jobFields = ['id', 'slug', 'role_title', 'type', 'organisation', 'start_date', 'date_created']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()

  const jobs = await client.request(readItems('job_offers', {
    filter: { status: { _eq: 'published' } },
    fields: [...jobFields, 'organisation.id', 'organisation.name'],
    sort: ['-date_created'],
    limit: 50,
  }))

  return {
    jobs: jobs.map((j: any) => ({
      ...pick(j, jobFields),
      organisation: j.organisation ? pick(j.organisation, ['id', 'name']) : null,
    })),
  }
})
