import { CandidateReadSchema } from '~/shared/contracts/elections';
import { parseCms } from './parseCms';
import { createError } from 'h3';
import { verifyCandidateAccessToken, loadCandidateQuestions, loadCandidateAnswers } from './candidateAuth';
export async function candidateRead(accessToken: string) {
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

  return parseCms(CandidateReadSchema, {
    candidate: data.candidate,
    questions,
    existingAnswers,
  })
}
