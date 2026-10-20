import { defineEventHandler, readBody, getRouterParam, createError, setResponseHeader } from 'h3'
import { verifyCandidateAccessToken, saveCandidateAnswers } from '../../../utils/candidateAuth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const accessToken = getRouterParam(event, 'token')
  if (!accessToken || !/^[a-zA-Z0-9_-]{1,100}$/.test(accessToken)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const data = await verifyCandidateAccessToken(accessToken)
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const body = await readBody(event)
  if (!body || !Array.isArray(body.answers)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
  }

  // Validate answers structure
  for (const ans of body.answers) {
    if (!ans.question || ans.response === undefined || ans.response === null) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid answer format' })
    }
    if (typeof ans.response !== 'number' || ans.response < 0 || ans.response > 4) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid response value' })
    }
    if (ans.explanation && typeof ans.explanation !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid explanation format' })
    }
  }

  // Resolve candidate ID from verified token, not from client input
  const candidateId = data.candidate.id

  await saveCandidateAnswers(candidateId, body.answers)

  return { success: true }
})
