import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const candidatePublicFields = ['id', 'name', 'party', 'has_answered', 'time_first_submitted', 'time_last_edited']
const questionPublicFields = ['id', 'title', 'thesis', 'background_information']
const answerPublicFields = ['response', 'explanation']

async function buildWahlcheckResponse(
  client: ReturnType<typeof createDirectusServerClient>,
  municipality: Row,
  localteamId: string,
) {
  // Find most recent public election for this localteam
  const elections = await client.request(readItems('elections', {
    filter: {
      localteam: { _eq: localteamId },
      is_public: { _eq: true },
    },
    fields: ['id', 'is_party_election', 'simple_answer_mode', 'descriptor', 'custom_logo', 'response_cutoff_date'],
    sort: ['-date_created'],
    limit: 1,
  }))

  if (!elections || elections.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No public election found' })
  }

  const election = elections[0]

  // Load questions
  const questions = await client.request(readItems('questions', {
    filter: {
      election: { _eq: election.id },
      status: { _eq: 'published' },
    },
    fields: questionPublicFields,
    sort: ['date_created'],
    limit: 100,
  }))

  // Load candidates
  const candidates = await client.request(readItems('candidate', {
    filter: { election: { _eq: election.id } },
    fields: candidatePublicFields,
    sort: ['name'],
    limit: 200,
  }))

  // Load answers for all candidates
  const candidateIds = candidates.map((c: any) => c.id)
  const answers: Row[] = []
  if (candidateIds.length > 0) {
    const loadedAnswers = await client.request(readItems('answers', {
      filter: {
        candidate: { _in: candidateIds },
        question: { status: { _eq: 'published' } },
      },
      fields: ['candidate', 'question', 'response', 'explanation'],
      limit: 10000,
    }))
    answers.push(...loadedAnswers)
  }

  // Build answer map: candidateId -> questionId -> answer
  const answerMap = new Map<string, Map<string, Row>>()
  for (const ans of answers) {
    const cId = String(ans.candidate)
    const qId = String(ans.question)
    if (!answerMap.has(cId)) answerMap.set(cId, new Map())
    answerMap.get(cId)!.set(qId, pick(ans, answerPublicFields))
  }

  // Build response
  const responseCandidates = candidates.map((c: any) => ({
    ...pick(c, candidatePublicFields),
    answers: Array.from(answerMap.get(c.id) || new Map()).map(([qId, ans]) => ({
      question: qId,
      ...ans,
    })),
  }))

  return {
    municipality: { slug: municipality.slug, name: municipality.name },
    election: pick(election, ['id', 'is_party_election', 'simple_answer_mode', 'descriptor', 'custom_logo', 'response_cutoff_date']),
    questions: questions.map((q: any) => pick(q, questionPublicFields)),
    candidates: responseCandidates,
  }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const municipalitySlug = getRouterParam(event, 'municipalitySlug')

  if (!municipalitySlug || !/^[a-z0-9-]{1,160}$/.test(municipalitySlug)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  let localteamId: string | undefined

  // Find municipality by slug
  let municipalities = await client.request(readItems('municipalities', {
    filter: { slug: { _eq: municipalitySlug } },
    fields: ['id', 'name', 'slug', 'localteam_id.id'],
    limit: 1,
  }))

  // If no municipality found, try to find by localteam slug
  if (!municipalities || municipalities.length === 0) {
    const localteams = await client.request(readItems('localteams', {
      filter: { slug: { _eq: municipalitySlug } },
      fields: ['id', 'name', 'municipality_name'],
      limit: 1,
    }))

    if (localteams && localteams.length > 0) {
      localteamId = localteams[0].id
      // Return a synthetic municipality object for the response
      const m = localteams[0]
      const municipality: Row = { slug: municipalitySlug, name: m.municipality_name || m.name }
      return await buildWahlcheckResponse(client, municipality, localteamId)
    } else {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
  }

  const municipality = municipalities[0]
  localteamId = municipality.localteam_id?.id

  if (!localteamId) {
    throw createError({ statusCode: 404, statusMessage: 'No local team found' })
  }

  return await buildWahlcheckResponse(client, municipality, localteamId)
})
