import { z } from 'zod'

/**
 * Public response contracts for the jobs feature.
 *
 * These schemas define what the API routes return to the browser.
 * They are allowlisted — only approved fields appear in responses.
 */

export const JobTypeSchema = z.enum(['full_time', 'part_time', 'internship', 'working_student', 'volunteer'])
export type JobType = z.infer<typeof JobTypeSchema>

export const PublicOrganisationSchema = z.object({
  id: z.number(),
  name: z.string(),
  link: z.string().nullable(),
  logo: z.object({
    id: z.string(),
    type: z.string().nullable(),
  }).nullable(),
})
export type PublicOrganisation = z.infer<typeof PublicOrganisationSchema>

/** Minimal organisation for list items */
export const PublicOrganisationMinimalSchema = z.object({
  id: z.number(),
  name: z.string(),
})
export type PublicOrganisationMinimal = z.infer<typeof PublicOrganisationMinimalSchema>

/** Public job offer for list view */
export const PublicJobListSchema = z.object({
  id: z.string(),
  slug: z.string(),
  role_title: z.string(),
  type: JobTypeSchema,
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  weekly_hours: z.string().nullable(),
  salary: z.string().nullable(),
  hourly_wage: z.string().nullable(),
  organisation: PublicOrganisationSchema.nullable(),
})
export type PublicJobList = z.infer<typeof PublicJobListSchema>

/** Public job offer for detail view */
export const PublicJobDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  role_title: z.string(),
  type: JobTypeSchema,
  tasks: z.string().nullable(),
  qualifications: z.string().nullable(),
  benefits: z.string().nullable(),
  contact_notes: z.string().nullable(),
  salary: z.string().nullable(),
  hourly_wage: z.string().nullable(),
  weekly_hours: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  application_url: z.string().nullable(),
  organisation: PublicOrganisationSchema.nullable(),
})
export type PublicJobDetail = z.infer<typeof PublicJobDetailSchema>

/** List endpoint response */
export const JobsListResponseSchema = z.object({
  jobs: z.array(PublicJobListSchema),
})
export type JobsListResponse = z.infer<typeof JobsListResponseSchema>

/** Detail endpoint response */
export const JobsDetailResponseSchema = z.object({
  job: PublicJobDetailSchema,
  organisation: PublicOrganisationSchema.nullable(),
})
export type JobsDetailResponse = z.infer<typeof JobsDetailResponseSchema>
