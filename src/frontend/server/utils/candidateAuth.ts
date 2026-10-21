import { readItems } from '@directus/sdk'
import { createError, getHeader, getQuery, getRouterParam, setCookie, setResponseHeader, type H3Event } from 'h3'
import { createDirectusServerClient } from './directusServerClient'

type Row = Record<string, any>

const candidatePublicFields = ['id', 'name', 'party', 'election', 'has_answered', 'time_first_submitted', 'time_last_edited']
const electionPublicFields = ['id', 'descriptor', 'is_public', 'is_party_election', 'simple_answer_mode', 'custom_logo', 'response_cutoff_date', 'localteam']
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
      'election.descriptor',
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
        descriptor: candidate.election?.descriptor,
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
