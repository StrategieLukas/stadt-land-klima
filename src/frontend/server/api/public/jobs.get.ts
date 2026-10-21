import { readItems } from '@directus/sdk'
import { defineEventHandler, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
import { JobsListResponseSchema } from '~/shared/contracts/jobs'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()

  const jobs = await client.request(readItems('job_offers', {
    filter: { status: { _eq: 'published' } },
    fields: [
      'id', 'slug', 'role_title', 'type',
      'start_date', 'end_date',
      'weekly_hours', 'salary', 'hourly_wage',
      {
        organisation: [
          'id', 'name', 'link',
          { logo: ['id', 'type'] },
        ],
      },
    ],
    sort: ['-date_created'],
    limit: 50,
  }))

  // Build allowlisted response — only approved fields reach the browser
  const response = {
    jobs: jobs.map((job: any) => ({
      id: String(job.id),
      slug: job.slug,
      role_title: job.role_title,
      type: job.type,
      start_date: job.start_date ?? null,
      end_date: job.end_date ?? null,
      weekly_hours: job.weekly_hours ?? null,
      salary: job.salary ?? null,
      hourly_wage: job.hourly_wage ?? null,
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
    })),
  }

  // Validate against public contract before returning
  return JobsListResponseSchema.parse(response)
})
