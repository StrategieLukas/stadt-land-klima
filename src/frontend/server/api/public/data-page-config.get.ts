import { readSingleton } from '@directus/sdk'
import { defineEventHandler, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  const client = createDirectusServerClient()

  const config = await client.request(readSingleton('data_page_config', {
    fields: ['collection_ids', 'include_only', 'under_construction', 'under_construction_explanation'],
  }))

  return { config }
})
