<template>
  <div class="min-h-screen bg-mild-white">
    <!-- Header with SLK Branding -->
    <div class="bg-white shadow-sm border-b border-gray/10 sticky top-0 z-50">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-3">
          <img 
            src="~/assets/images/Stadt-Land-Klima-Logo.svg" 
            alt="Stadt.Land.Klima! Logo" 
            class="h-10 w-auto"
          >
        </NuxtLink>
        <div class="text-center flex-1">
          <h1 class="text-xl font-bold text-stats-dark">Klimawahlcheck</h1>
          <p v-if="electionData?.election" class="text-sm text-mid-gray">
            {{ electionData.election.descriptor }}
          </p>
        </div>
        <div class="w-10"></div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="bg-ff-green/10 py-3">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex items-center justify-between">
          <div v-for="(step, index) in steps" :key="step.id" class="flex items-center">
            <div class="flex flex-col items-center">
              <div 
                class="w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300"
                :class="{
                  'bg-ff-green text-white': currentStep >= index + 1,
                  'bg-gray/20 text-gray/50': currentStep < index + 1
                }"
              >
                {{ currentStep > index + 1 ? '✓' : index + 1 }}
              </div>
              <span class="text-xs mt-1 font-medium text-stats-dark whitespace-nowrap">
                {{ step.label }}
              </span>
            </div>
            <div 
              v-if="index < steps.length - 1" 
              class="flex-1 h-1 mx-2 rounded-full transition-all duration-300"
              :class="{
                'bg-ff-green': currentStep > index + 1,
                'bg-gray/30': currentStep <= index + 1
              }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="pending && !error" class="flex justify-center items-center py-20">
        <div class="flex flex-col items-center gap-4">
          <SlkFlowerSpinner class="w-20 h-20 text-ff-green" />
          <p class="text-mid-gray">Lade Wahldaten...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red/10 border border-red text-red p-8 rounded-xl text-center my-12">
        <h2 class="text-2xl font-bold mb-4">Fehler beim Laden</h2>
        <p class="mb-4">{{ errorMessage }}</p>
        <NuxtLink to="/" class="btn btn-primary">Zurück zur Startseite</NuxtLink>
      </div>

      <!-- Not Found / Not Public -->
      <div v-else-if="!electionData?.election" class="bg-orange/10 border border-orange text-orange-800 p-8 rounded-xl text-center my-12">
        <h2 class="text-2xl font-bold mb-4">Wahl nicht verfügbar</h2>
        <p class="mb-4">
          Diese Wahl ist entweder nicht öffentlich oder existiert nicht. 
          Nur Wahlen mit öffentlichem Zugriff können im Wahlcheck verglichen werden.
        </p>
        <NuxtLink to="/" class="btn btn-secondary">Zurück zur Startseite</NuxtLink>
      </div>

      <!-- Step 1: Answer Questions -->
      <WahlCheckQuestions 
        v-if="currentStep === 1 && electionData" 
        :questions="electionData.questions" 
        :election="electionData.election" 
        :localteam="electionData.localteam" 
        @next="handleQuestionsNext" 
        @prev="handlePrev" 
      />

      <!-- Step 2: Review Answers & Select Double Weight -->
      <WahlCheckSummary 
        v-if="currentStep === 2 && electionData" 
        :questions="electionData.questions" 
        :userAnswers="userAnswers" 
        :doubleWeightedQuestions="doubleWeightedQuestions" 
        :election="electionData.election" 
        @next="handleSummaryNext" 
        @prev="handlePrev" 
        @toggle-double-weight="toggleDoubleWeight" 
      />

      <!-- Step 3: View Results -->
      <WahlCheckResults 
        v-if="currentStep === 3 && electionData" 
        :election="electionData.election" 
        :candidates="electionData.candidates" 
        :questions="electionData.questions" 
        :userAnswers="userAnswers" 
        :doubleWeightedQuestions="doubleWeightedQuestions" 
        :candidateAnswers="electionData.answers" 
        @restart="handleRestart" 
        @prev="handlePrev" 
      />
    </div>

    <!-- Navigation Buttons (for mobile) -->
    <div v-if="currentStep > 0 && currentStep < 4" class="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-50">
      <button 
        v-if="currentStep > 1" 
        @click="handlePrev" 
        class="btn btn-outline btn-secondary px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all"
      >
        Zurück
      </button>
    </div>

    <!-- Footer -->
    <div class="mt-20">
      <TheFooterDesktop />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const { $directus, $readItems, $readItem } = useNuxtApp()

const electionSlug = route.params.electionSlug

// Step management
const currentStep = ref(1)
const steps = [
  { id: 1, label: 'Fragen' },
  { id: 2, label: 'Übersicht' },
  { id: 3, label: 'Ergebnis' }
]

// User data
const userAnswers = ref({}) // { questionId: responseValue (0-4) }
const doubleWeightedQuestions = ref(new Set()) // Set of questionIds

// Election data
const electionData = ref(null)
const pending = ref(true)
const error = ref(false)
const errorMessage = ref('')

// Rating options (same as in the candidate survey)
const ratingOptions = [
  { value: 0, label: 'stark dagegen' },
  { value: 1, label: 'eher dagegen' },
  { value: 2, label: 'neutral' },
  { value: 3, label: 'eher dafür' },
  { value: 4, label: 'stark dafür' }
]

// Color classes for rating
const ratingColors = {
  0: 'bg-rating-0 text-white',
  1: 'bg-rating-1 text-white',
  2: 'bg-rating-na text-black',
  3: 'bg-rating-3 text-black',
  4: 'bg-rating-4 text-white'
}

// Load election data
async function loadElectionData() {
  pending.value = true
  error.value = false
  errorMessage.value = ''

  try {
    // Find the election by slug or ID
    const elections = await $directus.request($readItems('elections', {
      filter: { 
        _or: [
          { id: { _eq: electionSlug } },
          { descriptor: { _icontains: electionSlug } }
        ],
        is_public: { _eq: true }
      },
      fields: ['*', 'localteam.*', 'localteam.municipality_id.*']
    }))

    if (!elections || elections.length === 0) {
      // Try to find by ID directly
      const electionById = await $directus.request($readItem('elections', electionSlug, {
        fields: ['*', 'localteam.*', 'localteam.municipality_id.*']
      }))
      
      if (electionById && electionById.is_public) {
        elections.push(electionById)
      }
    }

    if (!elections || elections.length === 0) {
      electionData.value = null
      pending.value = false
      return
    }

    const election = elections[0]
    
    // Load questions for this election
    const questions = await $directus.request($readItems('questions', {
      filter: {
        election: { _eq: election.id },
        status: { _eq: 'published' }
      },
      sort: ['date_created'],
      fields: ['*']
    }))

    // Load candidates who have answered
    const candidates = await $directus.request($readItems('candidate', {
      filter: {
        election: { _eq: election.id },
        has_answered: { _eq: true }
      },
      fields: ['*']
    }))

    // Load all answers for these candidates
    let allAnswers = []
    if (candidates && candidates.length > 0 && questions && questions.length > 0) {
      allAnswers = await $directus.request($readItems('answers', {
        filter: {
          candidate: { _in: candidates.map(c => c.id) },
          question: { _in: questions.map(q => q.id) }
        },
        fields: ['*']
      }))
    }

    electionData.value = {
      election,
      localteam: election.localteam,
      questions: questions || [],
      candidates: candidates || [],
      answers: allAnswers || []
    }

  } catch (err) {
    console.error('Error loading election data:', err)
    error.value = true
    errorMessage.value = 'Es ist ein Fehler beim Laden der Wahldaten aufgetreten. Bitte versuchen Sie es später erneut.'
  } finally {
    pending.value = false
  }
}

// Handle step navigation
function handleQuestionsNext(answers) {
  userAnswers.value = { ...answers }
  currentStep.value = 2
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleSummaryNext() {
  currentStep.value = 3
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handlePrev() {
  if (currentStep.value > 1) {
    currentStep.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleRestart() {
  userAnswers.value = {}
  doubleWeightedQuestions.value = new Set()
  currentStep.value = 1
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function toggleDoubleWeight(questionId) {
  if (doubleWeightedQuestions.value.has(questionId)) {
    doubleWeightedQuestions.value.delete(questionId)
  } else {
    doubleWeightedQuestions.value.add(questionId)
  }
}

// Calculate similarity score
function calculateSimilarity(userAnswers, candidateAnswers, questions, doubleWeighted) {
  const scores = {}
  const maxScores = {}

  // Group candidate answers by candidate
  const candidateAnswersByCandidate = {}
  candidateAnswers.forEach(ans => {
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
  questions.forEach(question => {
    const questionId = question.id
    const userResponse = userAnswers[questionId]
    
    // Skip if user didn't answer
    if (userResponse === undefined || userResponse === null) return

    const isDoubleWeighted = doubleWeighted.has(questionId)
    const weight = isDoubleWeighted ? 2 : 1

    Object.keys(candidateAnswersByCandidate).forEach(candidateId => {
      const candidateAnswer = candidateAnswersByCandidate[candidateId][questionId]
      
      if (candidateAnswer && candidateAnswer.response !== null && candidateAnswer.response !== undefined) {
        const distance = Math.abs(userResponse - candidateAnswer.response)
        const points = 4 - distance
        const weightedPoints = points * weight
        
        scores[candidateId] = (scores[candidateId] || 0) + weightedPoints
        maxScores[candidateId] = (maxScores[candidateId] || 0) + (4 * weight)
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
}

// Provide functions to child components
const sharedFunctions = {
  ratingOptions,
  ratingColors,
  calculateSimilarity
}

// Load data on mount
onMounted(() => {
  loadElectionData()
})

// Update data when route changes
watch(() => route.params.electionSlug, () => {
  loadElectionData()
})

useHead({
  title: computed(() => electionData.value?.election?.descriptor 
    ? `Klimawahlcheck: ${electionData.value.election.descriptor} - Stadt.Land.Klima`
    : 'Klimawahlcheck - Stadt.Land.Klima'
  )
})
</script>

<style scoped>
/* Custom scrollbar for the progress bar area */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #afca0b;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #8a9b0a;
}
</style>
