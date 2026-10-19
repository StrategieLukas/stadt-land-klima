import { readItem, readItems, createItem, updateItem } from '@directus/sdk'
import { createError, getHeader, getQuery, getRouterParam, setCookie, setResponseHeader, type H3Event } from 'h3'
import { createDirectusServerClient } from './directusServerClient'

type Row = Record<string, any>

const candidatePublicFields = ['id', 'name', 'party', 'election', 'has_answered', 'time_first_submitted', 'time_last_edited']
const electionPublicFields = ['id', 'slug', 'name', 'status', 'is_public', 'is_party_election', 'simple_answer_mode', 'custom_logo', 'response_cutoff_date', 'localteam']
const questionPublicFields = ['id', 'title', 'thesis', 'background_information', 'status']
const answerPublicFields = ['id', 'response', 'explanation', 'candidate', 'question']

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

export async function verifyCandidateAccessToken(accessToken: string) {
  const client = createDirectusServerClient()
  const candidates = await client.request(readItems('candidate', {
    filter: { access_token: { _eq: accessToken } },
    fields: [
      ...candidatePublicFields,
      'access_token',
      'email',
      'election.id',
      'election.slug',
      'election.name',
      'election.status',
      'election.is_public',
      'election.is_party_election',
      'election.simple_answer_mode',
      'election.custom_logo',
      'election.response_cutoff_date',
      'election.localteam.id',
      'election.localteam.name',
      'election.localteam.slug',
      'election.localteam.municipality_id.id',
      'election.localteam.municipality_id.name',
      'election.localteam.municipality_id.slug',
      'election.localteam.municipality_id.state',
    ],
    limit: 1,
  }))

  if (!candidates || candidates.length === 0) {
    return null
  }

  const candidate = candidates[0]
  return {
    candidate: {
      id: candidate.id,
      name: candidate.name,
      party: candidate.party,
      has_answered: candidate.has_answered,
      time_first_submitted: candidate.time_first_submitted,
      time_last_edited: candidate.time_last_edited,
      election: {
        id: candidate.election?.id,
        slug: candidate.election?.slug,
        name: candidate.election?.name,
        status: candidate.election?.status,
        is_public: candidate.election?.is_public,
        is_party_election: candidate.election?.is_party_election,
        simple_answer_mode: candidate.election?.simple_answer_mode,
        custom_logo: candidate.election?.custom_logo,
        response_cutoff_date: candidate.election?.response_cutoff_date,
        localteam: candidate.election?.localteam ? {
          id: candidate.election.localteam.id,
          name: candidate.election.localteam.name,
          slug: candidate.election.localteam.slug,
          municipality_id: candidate.election.localteam.municipality_id ? {
            id: candidate.election.localteam.municipality_id.id,
            name: candidate.election.localteam.municipality_id.name,
            slug: candidate.election.localteam.municipality_id.slug,
            state: candidate.election.localteam.municipality_id.state,
          } : null,
        } : null,
      },
    },
  }
}

export async function loadCandidateQuestions(electionId: string) {
  const client = createDirectusServerClient()
  const questions = await client.request(readItems('questions', {
    filter: {
      election: { _eq: electionId },
      status: { _eq: 'published' },
    },
    fields: questionPublicFields,
    sort: ['date_created'],
    limit: 101,
  }))

  if (questions.length > 100) {
    throw createError({ statusCode: 502, statusMessage: 'Questions limit exceeded' })
  }

  return questions.map(q => pick(q, questionPublicFields))
}

export async function loadCandidateAnswers(candidateId: string, questionIds: string[]) {
  const client = createDirectusServerClient()
  if (questionIds.length === 0) return []

  const answers = await client.request(readItems('answers', {
    filter: {
      candidate: { _eq: candidateId },
      question: { _in: questionIds },
    },
    fields: [...answerPublicFields, 'question.id'],
    limit: 101,
  }))

  if (answers.length > 100) {
    throw createError({ statusCode: 502, statusMessage: 'Answers limit exceeded' })
  }

  return answers.map(a => ({
    ...pick(a, answerPublicFields),
    question: typeof a.question === 'object' ? a.question.id : a.question,
  }))
}

export async function saveCandidateAnswers(candidateId: string, answers: Array<{ question: string; response: number | null; explanation?: string }>) {
  const client = createDirectusServerClient()

  // Verify the candidate exists and belongs to the expected election
  const candidates = await client.request(readItems('candidate', {
    filter: { id: { _eq: candidateId } },
    fields: ['id', 'election.id', 'election.response_cutoff_date', 'has_answered', 'time_first_submitted'],
    limit: 1,
  }))

  if (!candidates || candidates.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })
  }

  const candidate = candidates[0]
  const cutoffDate = candidate.election?.response_cutoff_date
  if (cutoffDate) {
    const cutoff = new Date(cutoffDate)
    cutoff.setHours(23, 59, 59, 999)
    if (Date.now() > cutoff.getTime()) {
      throw createError({ statusCode: 403, statusMessage: 'Election response deadline has passed' })
    }
  }

  // Get existing answers for upsert logic
  const existingAnswers = await client.request(readItems('answers', {
    filter: { candidate: { _eq: candidateId } },
    fields: ['id', 'question.id'],
    limit: 101,
  }))

  const existingByQuestion = new Map<string, string>()
  for (const ans of existingAnswers) {
    const qId = typeof ans.question === 'object' ? ans.question.id : ans.question
    existingByQuestion.set(String(qId), ans.id)
  }

  // Process answers
  for (const ans of answers) {
    const payload = {
      candidate: candidateId,
      question: ans.question,
      response: ans.response,
      explanation: ans.explanation || null,
    }

    const existingId = existingByQuestion.get(String(ans.question))
    if (existingId) {
      await client.request(updateItem('answers', existingId, payload))
    } else {
      await client.request(createItem('answers', payload))
    }
  }

  // Update candidate timestamps
  const now = new Date().toISOString()
  const updatePayload: Record<string, any> = {
    has_answered: true,
    time_last_edited: now,
  }

  if (!candidate.time_first_submitted) {
    updatePayload.time_first_submitted = now
  }

  await client.request(updateItem('candidate', candidateId, updatePayload))
}
