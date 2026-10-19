import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const translationFields = ['id', 'language', 'key', 'value']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const filter: Record<string, any> = {}
  if (typeof query.language === 'string' && query.language) {
    filter.language = { _eq: query.language }
  }
  if (typeof query.keys === 'string' && query.keys) {
    const keys = query.keys.split(',').map(k => k.trim()).filter(Boolean)
    if (keys.length > 0) filter.key = { _in: keys }
  }

  const translations = await client.request(readItems('directus_translations', {
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    fields: translationFields,
    limit: 1000,
  }))

  return { translations: translations.map(t => pick(t, translationFields)) }
})
