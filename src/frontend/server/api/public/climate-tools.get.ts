import { readItems } from '@directus/sdk'
import { defineEventHandler, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const toolFields = ['id', 'title', 'description', 'category', 'link', 'image', 'image_credits', 'vendor', 'sort']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()

  const tools = await client.request(readItems('climate_tools', {
    filter: { status: { _eq: 'published' } },
    fields: toolFields,
    sort: ['sort'],
    limit: 100,
  }))

  return { tools: tools.map(t => pick(t, toolFields)) }
})
