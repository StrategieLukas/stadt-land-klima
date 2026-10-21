import { createError, defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'

/**
 * Record that a user completed a Wahlcheck (election comparison).
 * The browser cannot call Directus directly, so this route uses the server token.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const electionId = body?.electionId

  if (!electionId || typeof electionId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(electionId)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid election ID' })
  }

  const config = useRuntimeConfig()
  const directusUrl = (config.directusServerUrl as string) || 'http://directus:8055'
  const token = config.directusFrontendServerToken as string | undefined

  if (!token) {
    throw createError({ statusCode: 500, statusMessage: 'Server token not configured' })
  }

  const response = await fetch(`${directusUrl}/election-actions/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ election_id: electionId }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw createError({ statusCode: response.status, statusMessage: `Completion tracking failed: ${errorText}` })
  }

  return { success: true }
})
