import { MunicipalityPdfRequestSchema } from "~/shared/contracts/submissions";
import { createError, defineEventHandler, getRouterParam, readBody, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { rateLimit } from '../../../utils/rateLimit'

/**
 * Proxy for the Directus PDF service. The browser cannot call Directus directly
 * because the public token was removed. This route uses the server token instead.
 */
export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, 'municipality-pdf'))) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid municipality slug' })
  }

  const parsed = MunicipalityPdfRequestSchema.safeParse(await readBody<unknown>(event))
  if (!parsed.success || (parsed.data.slug && parsed.data.slug !== slug)) throw createError({ statusCode: 400, statusMessage: 'Invalid PDF request' })
  const { catalogVersion } = parsed.data

  const config = useRuntimeConfig()
  const directusUrl = (config.directusServerUrl) || 'http://directus:8055'
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
    throw createError({ statusCode: response.status, statusMessage: 'PDF generation failed' })
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  setResponseHeader(event, 'Content-Type', 'application/pdf')
  setResponseHeader(event, 'Content-Disposition', 'inline; filename="municipality.pdf"')
  setResponseHeader(event, 'Content-Length', buffer.length)

  return buffer
})
