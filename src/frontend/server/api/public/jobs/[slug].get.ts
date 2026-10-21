import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'
import { JobsDetailResponseSchema } from '~/shared/contracts/jobs'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  const jobs = await client.request(readItems('job_offers', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: [
      'id', 'slug', 'role_title', 'type',
      'tasks', 'qualifications', 'benefits', 'contact_notes',
      'salary', 'hourly_wage', 'weekly_hours',
      'start_date', 'end_date', 'application_url',
      {
        organisation: [
          'id', 'name', 'link',
          { logo: ['id', 'type'] },
        ],
      },
    ],
    limit: 1,
  }))

  if (!jobs || jobs.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  const job = jobs[0]

  // Build allowlisted response — only approved fields reach the browser
  const response = {
    job: {
      id: String(job.id),
      slug: job.slug,
      role_title: job.role_title,
      type: job.type,
      tasks: job.tasks ?? null,
      qualifications: job.qualifications ?? null,
      benefits: job.benefits ?? null,
      contact_notes: job.contact_notes ?? null,
      salary: job.salary ?? null,
      hourly_wage: job.hourly_wage ?? null,
      weekly_hours: job.weekly_hours ?? null,
      start_date: job.start_date ?? null,
      end_date: job.end_date ?? null,
      application_url: job.application_url ?? null,
      organisation: job.organisation
        ? {
            id: Number(job.organisation.id),
            name: job.organisation.name,
            link: job.organisation.link ?? null,
            logo: job.organisation.logo
              ? {
                  id: String(job.organisation.logo.id),
                  type: job.organisation.logo.type ?? null,
                }
              : null,
          }
        : null,
    },
    organisation: job.organisation
      ? {
          id: Number(job.organisation.id),
          name: job.organisation.name,
          link: job.organisation.link ?? null,
          logo: job.organisation.logo
            ? {
                id: String(job.organisation.logo.id),
                type: job.organisation.logo.type ?? null,
              }
            : null,
        }
      : null,
  }

  // Validate against public contract before returning
  return JobsDetailResponseSchema.parse(response)
})
