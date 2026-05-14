<template>
  <div class="space-y-8 relative">
    <!-- Confetti Animation -->
    <div v-if="showConfetti" class="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <div v-for="i in 50" :key="i" class="confetti" :style="{
        '--left': `${Math.random() * 100}%`,
        '--animation-duration': `${2 + Math.random() * 2}s`,
        '--animation-delay': `${Math.random() * 2}s`,
        '--color': `hsl(${Math.random() * 60 + 100}, 70%, 50%)`,
        '--size': `${5 + Math.random() * 10}px`
      }"></div>
    </div>
    
    <!-- Header -->
    <div class="bg-white p-8 rounded-xl shadow-list border border-gray/10 text-center">
      <div class="mb-6">
        <img 
          src="~/assets/images/Stadt-Land-Klima-Blume.svg" 
          alt="Klimablume" 
          class="h-24 w-auto mx-auto opacity-80"
        >
      </div>
      <h2 class="text-2xl font-bold text-stats-dark mb-4">
        Ihre Übereinstimmungen mit den Kandidaten
      </h2>
      <p class="text-mid-gray max-w-2xl mx-auto">
        Hier sehen Sie, wie stark Ihre Antworten mit denen der Kandidaten übereinstimmen.
        Die Übereinstimmung wird als Prozentsatz angegeben.
      </p>
      <p v-if="election" class="text-sm text-mid-gray mt-4">
        <strong>Wahl:</strong> {{ election.descriptor }}
      </p>
    </div>

    <!-- Bar Chart Overview -->
    <div v-if="results.length > 0" class="bg-white p-6 rounded-xl shadow-list border border-gray/10">
      <h3 class="text-xl font-bold text-center text-stats-dark mb-6">
        Vergleich aller Kandidaten
      </h3>
      <div class="space-y-4">
        <div v-for="result in sortedResults" :key="result.candidateId" class="flex items-center gap-4">
          <div class="w-48 flex-shrink-0">
            <div class="flex items-center gap-2">
              <span class="font-bold text-stats-dark">{{ sortedResults.indexOf(result) + 1 }}.</span>
              <span class="text-sm text-black truncate">{{ getCandidateName(result.candidateId) }}</span>
            </div>
          </div>
          <div class="flex-1">
            <ProgressBar :scoreTotal="result.percentage" layout="compact" />
          </div>
        </div>
      </div>
    </div>

    <!-- Results Summary -->
    <div v-if="results.length > 0" class="bg-gradient-to-r from-ff-green/10 to-stats-light/50 p-8 rounded-xl border border-ff-green/30">
      <h3 class="text-xl font-bold text-center text-stats-dark mb-6">
        Ihre Top-Matches
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
              <p v-if="getCandidateParty(result.candidateId)" class="text-sm text-mid-gray">
                {{ getCandidateParty(result.candidateId) }}
              </p>
            </div>
            
            <!-- Match Percentage with Animation -->
            <div class="flex-shrink-0 w-32">
              <div class="relative w-32 h-32">
                <svg class="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                  <!-- Background Circle -->
                  <path 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                    fill="none" 
                    stroke="#e0e0e0" 
                    stroke-width="3"
                  />
                  <!-- Progress Circle (Animated) -->
                  <path 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                    fill="none" 
                    :stroke="getProgressColor(result.percentage)" 
                    stroke-width="3" 
                    stroke-dasharray="100, 100" 
                    :stroke-dashoffset="100 - result.percentage"
                    stroke-linecap="round"
                    class="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-2xl font-bold text-stats-dark">{{ result.percentage }}%</span>
                  <span class="text-[10px] text-mid-gray uppercase tracking-wider">Übereinstimmung</span>
                </div>
              </div>
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
          
          <!-- Bar Chart Comparison -->
          <div class="mt-4">
            <ProgressBar :scoreTotal="result.percentage" layout="compact" />
          </div>

          <!-- Expanded Details -->
          <div 
            v-if="expandedCandidate === result.candidateId" 
            class="mt-6 pt-6 border-t border-gray/10 overflow-hidden transition-all duration-300"
          >
            <h5 class="font-bold text-stats-dark mb-4">Detailübersicht:</h5>
            
            <!-- Score Breakdown -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div class="bg-rating-4/10 p-3 rounded-lg text-center">
                <div class="text-2xl font-bold text-rating-4">{{ result.score }}</div>
                <div class="text-xs text-rating-4 font-medium uppercase">Punkte</div>
              </div>
              <div class="bg-stats-light/50 p-3 rounded-lg text-center">
                <div class="text-2xl font-bold text-stats-dark">{{ result.maxScore }}</div>
                <div class="text-xs text-stats-dark font-medium uppercase">Maximal möglich</div>
              </div>
              <div class="bg-ff-green/10 p-3 rounded-lg text-center">
                <div class="text-2xl font-bold text-ff-green">{{ Math.round(result.score / result.maxScore * 100) }}%</div>
                <div class="text-xs text-ff-green font-medium uppercase">Match-Score</div>
              </div>
            </div>
            
            <!-- Question-by-Question Comparison -->
            <div class="max-h-64 overflow-y-auto">
              <div 
                v-for="(question, qIndex) in questions" 
                :key="question.id"
                class="flex items-center gap-4 p-3 mb-2 bg-gray/5 rounded-lg transition-all hover:bg-gray/10"
              >
                <span class="text-sm text-gray/50 w-8 text-center">{{ qIndex + 1 }}.</span>
                <div class="flex-1">
                  <p class="font-medium text-sm text-black truncate">{{ question.title }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <!-- User Answer -->
                  <div 
                    v-if="userAnswers[question.id] !== undefined"
                    class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    :class="getRatingColor(userAnswers[question.id])"
                    :title="`Ihre Antwort: ${getRatingLabel(userAnswers[question.id])}`"
                  >
                    U
                  </div>
                  <div v-else class="w-8 h-8 rounded-full bg-gray/20 flex items-center justify-center text-[10px] font-bold text-gray/50">
                    -
                  </div>
                  
                  <!-- Candidate Answer -->
                  <div 
                    v-if="getCandidateAnswer(result.candidateId, question.id)"
                    class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    :class="getRatingColor(getCandidateAnswer(result.candidateId, question.id).response)"
                    :title="`Antwort: ${getRatingLabel(getCandidateAnswer(result.candidateId, question.id).response)}`"
                  >
                    K
                  </div>
                  <div v-else class="w-8 h-8 rounded-full bg-gray/20 flex items-center justify-center text-[10px] font-bold text-gray/50">
                    -
                  </div>
                  
                  <!-- Weight Indicator -->
                  <div 
                    v-if="doubleWeightedQuestions.has(question.id) && userAnswers[question.id] !== undefined && getCandidateAnswer(result.candidateId, question.id)"
                    class="w-6 h-6 rounded-full bg-ff-green flex items-center justify-center text-xs font-bold text-white"
                    title="Doppelt gewichtet"
                  >
                    2x
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
      <h3 class="text-xl font-bold mb-4">Keine Übereinstimmungen berechenbar</h3>
      <p class="text-mid-gray">
        Sie haben keine Fragen beantwortet, daher kann keine Übereinstimmung mit den Kandidaten berechnet werden.
      </p>
      <button 
        @click="$emit('restart')"
        class="btn btn-primary px-8 py-3 rounded-full font-semibold text-white mt-6"
      >
        Nochmal versuchen
      </button>
    </div>

    <!-- Navigation Buttons -->
    <div class="flex justify-between items-center mt-8 pt-6 border-t border-gray/10">
      <div class="text-sm text-mid-gray">
        {{ results.length }} Kandidaten verglichen
      </div>
      <div class="flex gap-4">
        <button
          type="button"
          @click="$emit('prev')"
          class="btn btn-outline btn-secondary px-6 py-2 rounded-full font-semibold"
        >
          Zurück
        </button>
        <button
          type="button"
          @click="$emit('restart')"
          class="btn btn-outline px-6 py-2 rounded-full font-semibold border-ff-green text-ff-green hover:bg-ff-green/10"
        >
          Neu starten
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ProgressBar from '~/components/ProgressBar.vue'

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

// Trigger confetti animation when component mounts
onMounted(() => {
  showConfetti.value = true
  setTimeout(() => {
    showConfetti.value = false
  }, 3000)
})

// Rating config
const ratingColors = {
  0: 'bg-rating-0',
  1: 'bg-rating-1', 
  2: 'bg-rating-na',
  3: 'bg-rating-3',
  4: 'bg-rating-4'
}

const ratingLabels = {
  0: 'stark dagegen',
  1: 'eher dagegen',
  2: 'neutral',
  3: 'eher dafür',
  4: 'stark dafür'
}

const progressColors = {
  0: '#e30613',
  1: '#f39200',
  2: '#ffd400',
  3: '#afca0b',
  4: '#1da64a'
}

function getRatingColor(value) {
  return ratingColors[value] || 'bg-gray'
}

function getRatingLabel(value) {
  return ratingLabels[value] || 'Keine Antwort'
}

function getProgressColor(percentage) {
  if (percentage >= 80) return progressColors[4]
  if (percentage >= 60) return progressColors[3]
  if (percentage >= 40) return progressColors[2]
  if (percentage >= 20) return progressColors[1]
  return progressColors[0]
}

// Helper functions for candidate data
function getCandidateName(candidateId) {
  const candidate = props.candidates.find(c => c.id === candidateId)
  return candidate ? candidate.name : 'Unbekannter Kandidat'
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
})

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
    alert('Fehler beim Erstellen des Shareable Links')
    return
  }
  
  // Copy to clipboard
  navigator.clipboard.writeText(url).then(() => {
    alert('Link wurde in die Zwischenablage kopiert! Sie können ihn jetzt teilen.')
  }).catch(err => {
    console.error('Fehler beim Kopieren:', err)
    alert('Konnte Link nicht kopieren. Bitte versuchen Sie es manuell.')
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
