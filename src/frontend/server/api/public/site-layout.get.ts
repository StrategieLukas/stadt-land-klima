import { readItems } from '@directus/sdk'
import { defineEventHandler, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const pageFields = ['id', 'slug', 'name', 'contents', 'sort_order']
const municipalityNavFields = ['id', 'slug', 'name']
const blockFields = ['id', 'bundle', 'props', 'sort_order', 'entity_type', 'entity_uuid']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  const client = createDirectusServerClient()

  const [pages, municipalities, navigationConfig] = await Promise.all([
    // Pages: published only (enforced by policy), sorted
    client.request(readItems('pages', {
      fields: pageFields,
      sort: ['sort_order'],
      limit: 100,
    })),
    // Municipalities: published, slug + name only
    client.request(readItems('municipalities', {
      filter: { status: { _eq: 'published' } },
      fields: municipalityNavFields,
      sort: ['name'],
      limit: 500,
    })),
    // Navigation config singleton
    client.request(readItems('navigation_config', {
      fields: ['header_items', 'footer_columns'],
      limit: 1,
    })),
  ])

  return {
    pages: pages.map(p => pick(p, pageFields)),
    municipalities: municipalities.map(m => pick(m, municipalityNavFields)),
    navigationConfig: navigationConfig[0] ? pick(navigationConfig[0], ['header_items', 'footer_columns']) : null,
  }
})
