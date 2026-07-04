<template>
  <div class="space-y-8 relative">
    <!-- Confetti Animation -->
    <div v-if="showConfetti" class="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <div v-for="i in 100" :key="i" class="confetti" :style="{
        '--left': `${Math.random() * 100}%`,
        '--animation-duration': `${2 + Math.random() * 2}s`,
        '--animation-delay': `${Math.random() * 2}s`,
        '--color': getConfettiColor(i),
        '--size': `${5 + Math.random() * 10}px`
      }"></div>
    </div>

    <!-- Header -->
    <div class="bg-white p-8 rounded-xl shadow-list border border-gray/10 text-center">
      <div class="mb-6">
        <img
          src="~/assets/images/Stadt-Land-Klima-Blume.svg"
          :alt="$t('logo.alt')"
          class="h-24 w-auto mx-auto opacity-80"
        >
      </div>
      <h2 class="text-2xl font-bold text-stats-dark mb-4">
        {{ $t('elections.wahlcheck.results.title') }}
      </h2>
      <p class="text-mid-gray max-w-2xl mx-auto">
        {{ $t('elections.wahlcheck.results.description') }}
      </p>
      <p v-if="election" class="text-sm text-mid-gray mt-4">
        <strong>{{ $t('elections.election') }}:</strong> {{ election.descriptor }}
      </p>
    </div>

    <!-- Bar Chart Overview -->
    <div v-if="results.length > 0" class="bg-white p-6 rounded-xl shadow-list border border-gray/10">
      <h3 class="text-xl font-bold text-center text-stats-dark mb-6">
        {{ $t('elections.wahlcheck.results.all_candidates') }}
      </h3>
      <div class="space-y-4">
        <div v-for="result in sortedResults" :key="result.candidateId" class="flex items-center gap-4">
          <div class="w-64 flex-shrink-0">
            <div class="flex items-baseline gap-2 min-h-[44px]">
              <span class="font-bold text-stats-dark pt-1">{{ sortedResults.indexOf(result) + 1 }}.</span>
              <div class="min-w-0">
                <div class="text-sm font-bold text-black truncate">{{ getCandidateName(result.candidateId) }}</div>
                <CandidatePartyLabel
                  v-if="getCandidateParty(result.candidateId)"
                  :party="getCandidateParty(result.candidateId)"
                  :state="null"
                  class="text-xs mt-0.5"
                />
              </div>
            </div>
          </div>
          <div class="flex-1">
            <ProgressBar :scoreTotal="result.percentage" layout="default" />
          </div>
        </div>
      </div>
    </div>

    <!-- Results Summary -->
    <div v-if="results.length > 0" class="bg-gradient-to-r from-ff-green/10 to-stats-light/50 p-8 rounded-xl border border-ff-green/30">
      <h3 class="text-xl font-bold text-center text-stats-dark mb-6">
        {{ $t('elections.wahlcheck.results.top_matches') }}
      </h3>

      <!-- Animated Results List -->
      <div class="space-y-4">
        <div
          v-for="(result, index) in sortedResults"
          :key="result.candidateId"
          class="bg-white rounded-xl p-6 shadow-list border border-gray/10 transition-all duration-500"
          :style="{ animationDelay: `${index * 100}ms` }"
          :class="`fade-in-up animation-delay-${index}`"
          @mouseenter="hoveredCandidate = result.candidateId"
          @mouseleave="hoveredCandidate = null"
        >
          <div class="flex items-center justify-between gap-4">
            <!-- Rank -->
            <div class="flex-shrink-0 w-12 h-12 rounded-full bg-stats-dark text-white flex items-center justify-center font-bold text-xl shadow-lg">
              {{ index + 1 }}
            </div>

            <!-- Candidate Info -->
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <h4 class="text-lg font-bold text-black">
                  {{ getCandidateName(result.candidateId) }}
                </h4>
                <CandidatePartyLabel
                  v-if="getCandidateParty(result.candidateId)"
                  :party="getCandidateParty(result.candidateId)"
                  :state="null"
                  class="text-xs"
                />
              </div>
            </div>

            <!-- Ranking Indicator -->
            <div class="flex-shrink-0 w-20 flex flex-col items-center justify-center">
              <div class="relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                <!-- Medal background -->
                <div
                  class="absolute inset-0 rounded-full opacity-20"
                  :class="getRankingBgColor(sortedResults.indexOf(result) + 1)"
                ></div>
                <!-- Rank number -->
                <span class="relative text-3xl font-bold" :class="getRankingColor(sortedResults.indexOf(result) + 1)">
                  {{ sortedResults.indexOf(result) + 1 }}
                </span>
              </div>
              <span class="text-[10px] text-mid-gray uppercase tracking-wider mt-1">{{ $t('elections.wahlcheck.results.match') }}</span>
            </div>

            <!-- Expand Button -->
            <button
              @click="toggleExpand(result.candidateId)"
              class="btn btn-circle btn-ghost btn-sm hover:bg-ff-green/10 transition-all"
              :class="{ 'rotate-180': expandedCandidate === result.candidateId }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-stats-dark transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <!-- Expanded Details -->
          <div
            v-if="expandedCandidate === result.candidateId"
            class="mt-6 pt-6 border-t border-gray/10 overflow-hidden transition-all duration-300"
          >
            <h5 class="font-bold text-stats-dark mb-4">{{ $t('elections.wahlcheck.results.details') }}</h5>

            <!-- Score Breakdown -->
            <div
              v-if="hasSectorAgreement(result.candidateId)"
              class="grid grid-cols-2 gap-6 mb-6"
            >
              <div class="bg-rating-4/10 p-6 rounded-2xl text-center shadow-lg hover:shadow-xl transition-shadow">
                <div class="flex items-center justify-center mb-4">
                  <img
                    v-if="getSectorIcon(getSectorAgreement(result.candidateId, 'highest').sectorRaw)"
                    :src="getSectorIcon(getSectorAgreement(result.candidateId, 'highest').sectorRaw)"
                    class="h-12 w-12 opacity-90"
                    :alt="getSectorAgreement(result.candidateId, 'highest').sector"
                  />
                </div>
                <div class="text-4xl font-bold text-rating-4">{{ getSectorAgreement(result.candidateId, 'highest').percentage }}%</div>
                <div class="text-lg font-bold text-rating-4/90 mt-2">{{ getSectorAgreement(result.candidateId, 'highest').sector }}</div>
                <div class="text-sm text-rating-4/60 mt-1 uppercase tracking-wider">{{ $t("elections.wahlcheck.results.best_match") }}</div>
              </div>
              <div class="bg-stats-light/50 p-6 rounded-2xl text-center shadow-lg hover:shadow-xl transition-shadow">
                <div class="flex items-center justify-center mb-4">
                  <img
                    v-if="getSectorIcon(getSectorAgreement(result.candidateId, 'lowest').sectorRaw)"
                    :src="getSectorIcon(getSectorAgreement(result.candidateId, 'lowest').sectorRaw)"
                    class="h-12 w-12 opacity-90"
                    :alt="getSectorAgreement(result.candidateId, 'lowest').sector"
                  />
                </div>
                <div class="text-4xl font-bold text-stats-dark">{{ getSectorAgreement(result.candidateId, 'lowest').percentage }}%</div>
                <div class="text-lg font-bold text-stats-dark/80 mt-2">{{ getSectorAgreement(result.candidateId, 'lowest').sector }}</div>
                <div class="text-sm text-stats-dark/60 mt-1 uppercase tracking-wider">{{ $t("elections.wahlcheck.results.lowest_match") }}</div>
              </div>
            </div>

            <!-- Sort Toggle Button -->
            <div class="mb-4">
              <button
                @click="toggleSort"
                class="btn btn-sm px-4 py-1.5 rounded-full text-sm font-medium border border-gray/20 hover:border-ff-green/30 hover:bg-ff-green/5 bg-white transition-all flex items-center gap-2"
              >
                <span>{{ sortLabel }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-stats-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <!-- Question-by-Question Comparison Table -->
            <div class="overflow-x-auto pb-2">
              <div class="min-w-[600px]">
                <!-- Table Header -->
                <div
                  class="grid gap-2 px-3 py-2 bg-gray/10 rounded-t-lg font-semibold text-sm text-gray/60 border-b border-gray/20"
                  :class="hasQuestionSectors ? 'grid-cols-[40px_1fr_80px_120px_120px]' : 'grid-cols-[40px_1fr_120px_120px]'"
                >
                  <div class="text-center">#</div>
                  <div>{{ $t("elections.thesis") }}</div>
                  <div v-if="hasQuestionSectors" class="text-center">{{ $t("stats.chart.sector") }}</div>
                  <div class="text-center">{{ $t("elections.wahlcheck.results.my_rating") }}</div>
                  <div class="text-center">{{ $t("elections.wahlcheck.results.candidate_rating") }}</div>
                </div>

                <!-- Table Rows -->
                <div
                  v-for="(question, qIndex) in sortedExpandedQuestions"
                  :key="question.id"
                  class="grid gap-2 px-3 py-2 bg-white/50 rounded-lg border-b border-gray/10 last:border-0 hover:bg-white transition-all"
                  :class="hasQuestionSectors ? 'grid-cols-[40px_1fr_80px_120px_120px]' : 'grid-cols-[40px_1fr_120px_120px]'"
                >
                  <div class="text-sm text-gray/50 text-center pt-1">{{ question.originalIndex + 1 }}.</div>
                  <div class="text-sm text-black flex items-center gap-2">
                    <span>{{ question.title }}</span>
                    <span
                      v-if="doubleWeightedQuestions.has(question.id)"
                      class="text-xs bg-ff-green/80 text-white px-1.5 py-0.5 rounded-full font-bold"
                      :title="$t('elections.wahlcheck.results.double_weighted')"
                    >2×</span>
                  </div>

                  <!-- Sector -->
                  <div v-if="hasQuestionSectors" class="flex justify-center">
                    <div v-if="question.sector" class="flex items-center gap-1">
                      <img
                        :src="getSectorIcon(question.sector)"
                        class="h-8 w-8 opacity-60"
                        :alt="sectorLabel(question.sector)"
                      >
                    </div>
                    <div v-else class="w-8"></div>
                  </div>

                  <!-- User Answer -->
                  <div class="flex justify-center">
                    <div
                      v-if="userAnswers[question.id] !== undefined"
                      class="w-8 h-8 rounded-full shadow-sm"
                      :class="getRatingColor(userAnswers[question.id])"
                      :title="$t('elections.wahlcheck.results.my_rating_title', { ':rating': getRatingLabel(userAnswers[question.id]) })"
                    ></div>
                    <div v-else class="w-8 h-8 rounded-full bg-gray/20">
                    </div>
                  </div>

                  <!-- Candidate Answer -->
                  <div class="flex items-center justify-center gap-1.5">
                    <template v-if="getCandidateAnswer(result.candidateId, question.id)">
                      <div
                        class="w-8 h-8 rounded-full shadow-sm"
                        :class="getRatingColor(getCandidateAnswer(result.candidateId, question.id).response)"
                        :title="$t('elections.wahlcheck.results.candidate_rating_title', { ':rating': getRatingLabel(getCandidateAnswer(result.candidateId, question.id).response) })"
                      ></div>
                      <button
                        type="button"
                        class="btn btn-circle btn-ghost btn-xs min-h-7 h-7 w-7 border border-gray/20 text-stats-dark hover:bg-stats-light"
                        :aria-label="$t('elections.wahlcheck.results.show_reasoning')"
                        :title="$t('elections.wahlcheck.results.show_reasoning')"
                        @click="showReasoning(result.candidateId, question)"
                      >
                        i
                      </button>
                    </template>
                    <div v-else class="w-8 h-8 rounded-full bg-gray/20">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Results / All Skipped -->
    <div v-else class="bg-orange/10 border border-orange text-orange-700 p-8 rounded-xl text-center">
      <div class="mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mx-auto text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
	      <h3 class="text-xl font-bold mb-4">{{ $t("elections.wahlcheck.results.no_matches.title") }}</h3>
	      <p class="text-mid-gray">
	        {{ $t("elections.wahlcheck.results.no_matches.description") }}
      </p>
      <button
        @click="$emit('restart')"
        class="btn btn-primary px-8 py-3 rounded-full font-semibold text-white mt-6"
      >
	        {{ $t("generic.try_again") }}
      </button>
    </div>

    <dialog ref="reasoningDialog" class="modal">
      <div class="modal-box max-w-2xl">
        <form method="dialog">
          <button
            class="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
            :aria-label="$t('generic.close')"
          >
            x
          </button>
        </form>

        <div v-if="selectedReasoning" class="space-y-4">
          <div>
            <p class="text-sm text-mid-gray">{{ selectedReasoning.candidateName }}</p>
            <h3 class="text-xl font-bold text-stats-dark">{{ $t("elections.wahlcheck.results.reasoning") }}</h3>
          </div>

          <div class="rounded-lg bg-gray/5 p-4">
            <p class="text-sm font-semibold text-black">{{ selectedReasoning.questionTitle }}</p>
            <p class="mt-2 text-sm text-mid-gray">
              {{ $t("elections.wahlcheck.results.candidate_rating") }}:
              <span class="font-semibold text-black">{{ selectedReasoning.answerLabel }}</span>
            </p>
          </div>

          <p class="whitespace-pre-line text-sm text-gray-700">
            {{ selectedReasoning.explanation || $t("elections.wahlcheck.results.no_reasoning") }}
          </p>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>{{ $t("generic.close") }}</button>
      </form>
    </dialog>

    <!-- Navigation Buttons -->
    <div class="flex justify-between items-center mt-8 pt-6 border-t border-gray/10">
      <div class="text-sm text-mid-gray">
	        {{ $t("elections.wahlcheck.results.compared_count", { ":count": results.length }) }}
      </div>
      <div class="flex gap-4">
        <button
          type="button"
          @click="$emit('prev')"
          class="btn btn-outline btn-secondary px-6 py-2 rounded-full font-semibold"
        >
	          {{ $t("generic.back") }}
        </button>
        <button
          type="button"
          @click="$emit('restart')"
          class="btn btn-outline px-6 py-2 rounded-full font-semibold border-ff-green text-ff-green hover:bg-ff-green/10"
        >
	          {{ $t("generic.restart") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import ProgressBar from '~/components/ProgressBar.vue'
import CandidatePartyLabel from '~/components/CandidatePartyLabel.vue'
import sectorImages from '~/shared/sectorImages.js'
import {
  calculateWahlcheckQuestionScore,
  getWahlcheckAnswerLabel,
  getWahlcheckRatingColor,
} from '~/shared/wahlcheckAnswerOptions.js'

const { $t } = useNuxtApp()

const props = defineProps({
  election: {
    type: Object,
    required: true
  },
  candidates: {
    type: Array,
    required: true
  },
  questions: {
    type: Array,
    required: true
  },
  userAnswers: {
    type: Object,
    required: true
  },
  doubleWeightedQuestions: {
    type: Set,
    required: true
  },
  candidateAnswers: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['restart', 'prev'])

// State
const expandedCandidate = ref(null)
const hoveredCandidate = ref(null)
const showConfetti = ref(false)
const sortBy = ref('default') // 'default', 'agreement', 'disagreement'
const reasoningDialog = ref(null)
const selectedReasoning = ref(null)

// Toggle through sort modes
function toggleSort() {
  const modes = ['default', 'agreement', 'disagreement']
  const currentIndex = modes.indexOf(sortBy.value)
  sortBy.value = modes[(currentIndex + 1) % modes.length]
}

// Sort label text
const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'default': return $t('elections.wahlcheck.results.sort.default')
    case 'agreement': return $t('elections.wahlcheck.results.sort.agreement')
    case 'disagreement': return $t('elections.wahlcheck.results.sort.disagreement')
    default: return $t('elections.wahlcheck.results.sort.order')
  }
})

// Sorting functions
const sortedExpandedQuestions = computed(() => {
  if (!expandedCandidate.value) return []

  const candidateId = expandedCandidate.value
  const candidateAnswersByQuestion = {}
  props.candidateAnswers.forEach(ans => {
    const cId = typeof ans.candidate === 'object' ? ans.candidate.id : ans.candidate
    const qId = typeof ans.question === 'object' ? ans.question.id : ans.question
    if (cId === candidateId) {
      candidateAnswersByQuestion[qId] = ans.response
    }
  })

  const originalIndices = new Map(props.questions.map((q, i) => [q.id, i]))

  return [...props.questions].map(q => {
    const userAnswer = props.userAnswers[q.id]
    const candidateAnswer = candidateAnswersByQuestion[q.id]
    const score = calculateWahlcheckQuestionScore(userAnswer, candidateAnswer)
    return {
      ...q,
      difference: score?.distance ?? null,
      originalIndex: originalIndices.get(q.id) ?? 0
    }
  }).filter(q => {
    // Only show questions that have both user and candidate answers
    return props.userAnswers[q.id] !== undefined &&
      props.userAnswers[q.id] !== null &&
      candidateAnswersByQuestion[q.id] !== undefined &&
      candidateAnswersByQuestion[q.id] !== null
  }).sort((a, b) => {
    if (sortBy.value === 'default') {
      return a.originalIndex - b.originalIndex
    } else if (sortBy.value === 'agreement') {
      return (a.difference ?? Infinity) - (b.difference ?? Infinity)
    } else if (sortBy.value === 'disagreement') {
      return (b.difference ?? -Infinity) - (a.difference ?? -Infinity)
    }
    return 0
  })
})

// Trigger confetti animation when component mounts
onMounted(() => {
  showConfetti.value = true
  setTimeout(() => {
    showConfetti.value = false
  }, 3000)
})

// Confetti colors using logo colors
const confettiColors = [
  '#AFCA0B', // light-green
  '#1da64a', // ff-green
  '#ffc80c', // localzero-yellow
  '#16bae7', // light-blue
  '#f27c00', // slk-orange
]

function getConfettiColor(index) {
  return confettiColors[index % confettiColors.length]
}

const progressColors = {
  0: '#e30613',
  1: '#f39200',
  2: '#ffd400',
  3: '#afca0b',
  4: '#1da64a'
}

function getRatingColor(value) {
  return getWahlcheckRatingColor(value)
}

function getRatingLabel(value) {
  return getWahlcheckAnswerLabel(value, props.election, $t)
}

function getProgressColor(percentage) {
  if (percentage >= 80) return progressColors[4]
  if (percentage >= 60) return progressColors[3]
  if (percentage >= 40) return progressColors[2]
  if (percentage >= 20) return progressColors[1]
  return progressColors[0]
}

// Ranking colors - gold, silver, bronze
const rankingColors = {
  1: 'text-yellow-500',  // Gold
  2: 'text-gray-700',   // Silver
  3: 'text-amber-700'   // Bronze
}

function getRankingColor(rank) {
  return rankingColors[rank] || 'text-stats-dark'
}

// Ranking background colors (subtle medal colors)
const rankingBgColors = {
  1: 'bg-yellow-400',
  2: 'bg-black',
  3: 'bg-amber-800'
}

function getRankingBgColor(rank) {
  return rankingBgColors[rank] || 'bg-ff-green/20'
}

// Helper functions for candidate data
function getCandidateName(candidateId) {
  const candidate = props.candidates.find(c => c.id === candidateId)
  return candidate ? candidate.name : $t('elections.unknown_candidate')
}

function getCandidateParty(candidateId) {
  const candidate = props.candidates.find(c => c.id === candidateId)
  return candidate ? candidate.party : null
}

function getCandidateAnswer(candidateId, questionId) {
  return props.candidateAnswers.find(ans =>
    (typeof ans.candidate === 'object' ? ans.candidate.id : ans.candidate) === candidateId &&
    (typeof ans.question === 'object' ? ans.question.id : ans.question) === questionId
  )
}

async function showReasoning(candidateId, question) {
  const answer = getCandidateAnswer(candidateId, question.id)
  if (!answer) return

  selectedReasoning.value = {
    candidateName: getCandidateName(candidateId),
    questionTitle: question.title,
    answerLabel: getRatingLabel(answer.response),
    explanation: typeof answer.explanation === 'string' ? answer.explanation.trim() : '',
  }

  await nextTick()
  reasoningDialog.value?.showModal()
}

function normalizeSector(sector) {
  const normalized = String(sector ?? '').toLowerCase().trim()
  return normalized || null
}

const hasQuestionSectors = computed(() => {
  return props.questions.some((question) => normalizeSector(question.sector))
})

// Calculate similarity scores
const results = computed(() => {
  const scores = {}
  const maxScores = {}

  // Group candidate answers by candidate
  const candidateAnswersByCandidate = {}
  props.candidateAnswers.forEach(ans => {
    const candidateId = typeof ans.candidate === 'object' ? ans.candidate.id : ans.candidate
    if (!candidateAnswersByCandidate[candidateId]) {
      candidateAnswersByCandidate[candidateId] = {}
    }
    const questionId = typeof ans.question === 'object' ? ans.question.id : ans.question
    candidateAnswersByCandidate[candidateId][questionId] = {
      response: ans.response,
      explanation: ans.explanation
    }
  })

  // Calculate scores for each candidate
  props.questions.forEach(question => {
    const questionId = question.id
    const userResponse = props.userAnswers[questionId]

    // Skip if user didn't answer
    if (userResponse === undefined || userResponse === null) return

    const isDoubleWeighted = props.doubleWeightedQuestions.has(questionId)
    const weight = isDoubleWeighted ? 2 : 1

    Object.keys(candidateAnswersByCandidate).forEach(candidateId => {
      const candidateAnswer = candidateAnswersByCandidate[candidateId][questionId]

      if (candidateAnswer && candidateAnswer.response !== null && candidateAnswer.response !== undefined) {
        const score = calculateWahlcheckQuestionScore(userResponse, candidateAnswer.response, weight)
        if (!score) return

        scores[candidateId] = (scores[candidateId] || 0) + score.points
        maxScores[candidateId] = (maxScores[candidateId] || 0) + score.maxPoints
      }
    })
  })

  // Convert to percentages
  const results = []
  Object.keys(scores).forEach(candidateId => {
    const percentage = maxScores[candidateId] > 0
      ? Math.round((scores[candidateId] / maxScores[candidateId]) * 100)
      : 0
    results.push({
      candidateId,
      score: scores[candidateId],
      maxScore: maxScores[candidateId],
      percentage
    })
  })

  return results
})

function sectorLabel(sector) {
  const key = normalizeSector(sector)
  if (!key) return ''
  const translated = $t(`measure_sectors.${key}.title`)
  return translated === `measure_sectors.${key}.title` ? key : translated
}

// Get sector icon from imported images
function getSectorIcon(sectorKey) {
  const key = normalizeSector(sectorKey)
  return key ? sectorImages[key] || null : null
}

// Calculate sector agreement scores for each candidate
const sectorAgreements = computed(() => {
  const sectorScores = {}

  // Group candidate answers by candidate
  const candidateAnswersByCandidate = {}
  props.candidateAnswers.forEach(ans => {
    const candidateId = typeof ans.candidate === 'object' ? ans.candidate.id : ans.candidate
    if (!candidateAnswersByCandidate[candidateId]) {
      candidateAnswersByCandidate[candidateId] = {}
    }
    const questionId = typeof ans.question === 'object' ? ans.question.id : ans.question
    candidateAnswersByCandidate[candidateId][questionId] = {
      response: ans.response,
      explanation: ans.explanation
    }
  })

  // Group questions by sector
  const questionsBySector = {}
  props.questions.forEach(q => {
    const sector = normalizeSector(q.sector)
    if (!sector) return
    if (!questionsBySector[sector]) {
      questionsBySector[sector] = []
    }
    questionsBySector[sector].push(q)
  })

  // Calculate sector scores for each candidate
  Object.keys(candidateAnswersByCandidate).forEach(candidateId => {
    sectorScores[candidateId] = {}

    Object.keys(questionsBySector).forEach(sector => {
      let sectorScore = 0
      let sectorMaxScore = 0

      questionsBySector[sector].forEach(q => {
        const questionId = q.id
        const userResponse = props.userAnswers[questionId]

        // Skip if user didn't answer
        if (userResponse === undefined || userResponse === null) return

        const isDoubleWeighted = props.doubleWeightedQuestions.has(questionId)
        const weight = isDoubleWeighted ? 2 : 1

        const candidateAnswer = candidateAnswersByCandidate[candidateId][questionId]

        if (candidateAnswer && candidateAnswer.response !== null && candidateAnswer.response !== undefined) {
          const score = calculateWahlcheckQuestionScore(userResponse, candidateAnswer.response, weight)
          if (!score) return

          sectorScore += score.points
          sectorMaxScore += score.maxPoints
        }
      })

      const percentage = sectorMaxScore > 0 ? Math.round((sectorScore / sectorMaxScore) * 100) : 0
      sectorScores[candidateId][sector] = {
        score: sectorScore,
        maxScore: sectorMaxScore,
        percentage,
        sector: sector  // Store the normalized sector key
      }
    })
  })

  return sectorScores
})

// Get sector with highest or lowest agreement for a candidate
function getSectorAgreement(candidateId, type = 'highest') {
  const candidateSectors = sectorAgreements.value[candidateId]

  if (!candidateSectors || Object.keys(candidateSectors).length === 0) {
    return null
  }

  // Filter out sectors with 0 maxScore (no questions answered)
  const validSectors = Object.values(candidateSectors).filter(s => s.maxScore > 0)

  if (validSectors.length === 0) {
    return null
  }

  // Sort by percentage
  validSectors.sort((a, b) => {
    // If percentages are equal, use maxScore as tiebreaker (higher relevance)
    if (a.percentage === b.percentage) {
      return type === 'highest' ? b.maxScore - a.maxScore : a.maxScore - b.maxScore
    }
    return type === 'highest' ? b.percentage - a.percentage : a.percentage - b.percentage
  })

  const selected = validSectors[0]
  const sectorKey = normalizeSector(selected.sector)
  if (!sectorKey) return null
  const label = sectorLabel(sectorKey)
  return {
    percentage: selected.percentage,
    sector: label,
    sectorRaw: sectorKey,  // Raw sector key for icon lookup
    score: selected.score,
    maxScore: selected.maxScore
  }
}

function hasSectorAgreement(candidateId) {
  return Boolean(getSectorAgreement(candidateId, 'highest') && getSectorAgreement(candidateId, 'lowest'))
}

// Sorted results by percentage (descending)
const sortedResults = computed(() => {
  return [...results.value].sort((a, b) => b.percentage - a.percentage)
})

// Toggle expand
function toggleExpand(candidateId) {
  expandedCandidate.value = expandedCandidate.value === candidateId ? null : candidateId
}

// Encode answers and double-weighted questions for sharing
function encodeShareableData() {
  try {
    // Convert Set to Array for JSON serialization
    const doubleWeightedArray = Array.from(props.doubleWeightedQuestions)

    const shareData = {
      answers: props.userAnswers,
      doubleWeighted: doubleWeightedArray,
      electionId: props.election.id,
      timestamp: new Date().toISOString()
    }

    // Convert to JSON and encode as base64
    const jsonString = JSON.stringify(shareData)
    const encoded = btoa(encodeURIComponent(jsonString))

    return encoded
  } catch (error) {
    console.error('Error encoding shareable data:', error)
    return null
  }
}

// Generate shareable URL
function generateShareableUrl() {
  const encodedData = encodeShareableData()
  if (!encodedData) return null

  // Get current URL and add share parameter
  const currentUrl = window.location.href.split('?')[0]
  return `${currentUrl}?share=${encodedData}`
}

// Copy shareable link to clipboard
function copyShareableLink() {
  const url = generateShareableUrl()
  if (!url) {
    alert($t('elections.wahlcheck.results.share.create_error'))
    return
  }

  // Copy to clipboard
  navigator.clipboard.writeText(url).then(() => {
    alert($t('elections.wahlcheck.results.share.copied'))
  }).catch(err => {
    console.error('Error copying share link:', err)
    alert($t('elections.wahlcheck.results.share.copy_error'))
  })
}

// Decode shareable data from URL (for future use)
function decodeShareableData(encodedString) {
  try {
    const decoded = decodeURIComponent(atob(encodedString))
    return JSON.parse(decoded)
  } catch (error) {
    console.error('Error decoding shareable data:', error)
    return null
  }
}
</script>

<style scoped>
/* Confetti Animation */
.confetti {
  position: absolute;
  width: var(--size);
  height: var(--size);
  background-color: var(--color);
  border-radius: 50%;
  left: var(--left);
  top: -10px;
  animation: confetti-fall var(--animation-duration) var(--animation-delay) ease-out forwards;
}

@keyframes confetti-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUp 0.6s ease-out forwards;
}

.animation-delay-0 { animation-delay: 0ms; }
.animation-delay-1 { animation-delay: 100ms; }
.animation-delay-2 { animation-delay: 200ms; }
.animation-delay-3 { animation-delay: 300ms; }
.animation-delay-4 { animation-delay: 400ms; }
.animation-delay-5 { animation-delay: 500ms; }
.animation-delay-6 { animation-delay: 600ms; }
.animation-delay-7 { animation-delay: 700ms; }
.animation-delay-8 { animation-delay: 800ms; }
.animation-delay-9 { animation-delay: 900ms; }

/* Circular progress animation */
svg path {
  transition: stroke-dashoffset 1s ease-out;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease-out;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* Rotate animation for chevron */
.rotate-180 {
  transform: rotate(180deg);
}
</style>
