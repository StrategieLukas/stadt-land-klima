import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const jobDetailFields = [
  'id', 'slug', 'role_title', 'type', 'tasks', 'qualifications', 'benefits',
  'salary', 'hourly_wage', 'weekly_hours', 'start_date', 'end_date', 'application_url',
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  const jobs = await client.request(readItems('job_offers', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: [...jobDetailFields, 'organisation.id', 'organisation.name', 'organisation.logo', 'organisation.link'],
    limit: 1,
  }))

  if (!jobs || jobs.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  const job = jobs[0]
  return {
    job: pick(job, jobDetailFields),
    organisation: job.organisation ? pick(job.organisation, ['id', 'name', 'logo', 'link']) : null,
  }
})
