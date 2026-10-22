import { createError, defineEventHandler, getRouterParam, readBody, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'

/**
 * Proxy for the Directus PDF service. The browser cannot call Directus directly
 * because the public token was removed. This route uses the server token instead.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid municipality slug' })
  }

  const body = await readBody(event)
  const catalogVersion = body?.catalogVersion as string | undefined
  if (!catalogVersion || !/^[a-z0-9._-]{1,100}$/.test(catalogVersion)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid catalog version' })
  }

  const config = useRuntimeConfig()
  const directusUrl = (config.directusServerUrl as string) || 'http://directus:8055'
  const token = config.directusFrontendServerToken as string | undefined

  if (!token) {
    throw createError({ statusCode: 500, statusMessage: 'Server token not configured' })
  }

  const response = await fetch(`${directusUrl}/pdf-service/municipality/${slug}/${catalogVersion}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ slug }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw createError({ statusCode: response.status, statusMessage: `PDF generation failed: ${errorText}` })
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  setResponseHeader(event, 'Content-Type', 'application/pdf')
  setResponseHeader(event, 'Content-Disposition', 'inline; filename="municipality.pdf"')
  setResponseHeader(event, 'Content-Length', buffer.length)

  return buffer
})
