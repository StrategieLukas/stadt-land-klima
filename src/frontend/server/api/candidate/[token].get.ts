import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { verifyCandidateAccessToken, loadCandidateQuestions, loadCandidateAnswers } from '../../utils/candidateAuth'

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

  const electionId = data.candidate.election?.id
  if (!electionId) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const questions = await loadCandidateQuestions(electionId)
  const questionIds = questions.map(q => q.id)
  const existingAnswers = await loadCandidateAnswers(data.candidate.id, questionIds)

  return {
    candidate: data.candidate,
    questions,
    existingAnswers,
  }
})
