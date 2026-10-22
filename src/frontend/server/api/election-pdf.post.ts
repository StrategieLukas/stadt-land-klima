import { createError, defineEventHandler, readBody, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'

/**
 * Proxy for the Directus election PDF service. The browser cannot call Directus
 * directly, so this route uses the server token instead.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const municipalitySlug = body?.municipalitySlug as string | undefined
  const catalogVersion = body?.catalogVersion as string | undefined
  const measures = body?.measures

  if (!municipalitySlug || !/^[a-z0-9-]{1,160}$/.test(municipalitySlug)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid municipality slug' })
  }
  if (!catalogVersion || !/^[a-z0-9._-]{1,100}$/.test(catalogVersion)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid catalog version' })
  }
  if (!Array.isArray(measures)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing measures array' })
  }

  const config = useRuntimeConfig()
  const directusUrl = (config.directusServerUrl as string) || 'http://directus:8055'
  const token = config.directusFrontendServerToken as string | undefined

  if (!token) {
    throw createError({ statusCode: 500, statusMessage: 'Server token not configured' })
  }

  const response = await fetch(`${directusUrl}/pdf-service/elections/${municipalitySlug}/${catalogVersion}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ measure_text: measures }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw createError({ statusCode: response.status, statusMessage: `PDF generation failed: ${errorText}` })
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  setResponseHeader(event, 'Content-Type', 'application/pdf')
  setResponseHeader(event, 'Content-Disposition', 'inline; filename="election.pdf"')
  setResponseHeader(event, 'Content-Length', buffer.length)

  return buffer
})
