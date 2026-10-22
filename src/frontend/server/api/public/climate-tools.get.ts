import { defineEventHandler, setResponseHeader } from 'h3'
import { readPublicItems } from '../../utils/publicItems'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const toolFields = ['id', 'title', 'description', 'category', 'link', 'image', 'image_credits', 'vendor', 'sort']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')

  const tools = await readPublicItems('climate_tools', {
    filter: { status: { _eq: 'published' } },
    fields: [...toolFields.filter(field => field !== 'image'), 'image.id', 'image.type'],
    sort: ['sort'],
  })

  return { tools: tools.map(t => pick(t, toolFields)) }
})
