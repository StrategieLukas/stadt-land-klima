import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const articleDetailFields = [
  'id', 'slug', 'title', 'subtitle', 'abstract', 'article_text', 'content',
  'content_segment', 'additional_infos', 'additional_infos_segment', 'additional_examples',
  'image', 'image_credits', 'author', 'municipality', 'municipality_name',
  'organisation', 'sectors', 'measures', 'date_created',
  'similar_articles', 'similar_external_projects', 'similar_projects_segment',
  'sources', 'profile_stage', 'can_do_autonomously', 'is_profitable',
  'ghg_savings_level', 'ghg_savings_potential', 'ghg_savings_potential_block',
  'economic_efficiency', 'economic_efficiency_block',
  'ease_of_implementation', 'ease_of_implementation_block',
  'public_impact', 'public_impact_block', 'public_impact_effects',
  'other_benefits', 'other_benefits_block',
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  const articles = await client.request(readItems('articles', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: articleDetailFields,
    limit: 1,
  }))

  if (!articles || articles.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  return { article: pick(articles[0], articleDetailFields) }
})
