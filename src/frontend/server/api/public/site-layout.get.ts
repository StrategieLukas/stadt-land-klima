import { SiteLayoutSchema } from "~/shared/contracts/navigation";
import { parseCms } from "~/server/utils/parseCms";
import { cmsRows, cmsRecord } from "~/server/utils/cmsValue";
import { readItems, readSingleton } from '@directus/sdk'
import { defineEventHandler, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, unknown>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const pageFields = ['id', 'slug', 'name', 'contents', 'sort_order']
const municipalityNavFields = ['id', 'slug', 'name']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  const client = createDirectusServerClient()

  const [pages, municipalities, navigationConfig] = await Promise.all([
    // Pages: published only (enforced by policy), sorted
    client.request(readItems('pages', {
      fields: pageFields,
      sort: ['sort_order'],
      limit: 100,
    })).then(cmsRows),
    // Municipalities: published, slug + name only
    client.request(readItems('municipalities', {
      filter: { status: { _eq: 'published' } },
      fields: municipalityNavFields,
      sort: ['name'],
      limit: 500,
    })).then(cmsRows),
    // Navigation config singleton
    client.request(readSingleton('navigation_config', {
      fields: ['header_items', 'footer_columns'],
    })).then(cmsRecord),
  ])

  return parseCms(SiteLayoutSchema, {
    pages: pages.map(p => pick(p, pageFields)),
    municipalities: municipalities.map(m => pick(m, municipalityNavFields)),
    navigationConfig: pick(navigationConfig, ['header_items', 'footer_columns']),
  })
})
