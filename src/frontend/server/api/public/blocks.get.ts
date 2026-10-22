import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { readPublicBlocks } from '../../utils/publicBlocks'

export default defineEventHandler(async event => {
  const query = getQuery(event)
  const entityType = query.entityType ?? (query.bundle === 'page' ? 'pages' : undefined)
  if (typeof entityType !== 'string' || typeof query.entityUuid !== 'string' || (query.fieldName !== undefined && typeof query.fieldName !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'A parent content scope is required' })
  }
  const blocks = await readPublicBlocks(entityType, query.entityUuid, query.fieldName)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return { blocks }
})
