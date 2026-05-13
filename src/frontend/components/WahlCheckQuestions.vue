<template>
  <div class="space-y-8">
    <!-- Introduction -->
    <div class="bg-white p-8 rounded-xl shadow-list border border-gray/10 text-center">
      <div class="mb-6">
        <img 
          src="~/assets/images/Stadt-Land-Klima-Blume.svg" 
          alt="Klimablume" 
          class="h-24 w-auto mx-auto opacity-80"
        >
      </div>
      <h2 class="text-2xl font-bold text-stats-dark mb-4">
        Beantworten Sie die Thesen
      </h2>
      <p class="text-mid-gray max-w-2xl mx-auto">
        Geben Sie zu jeder These an, inwieweit Sie dieser zustimmen. 
        Ihre Antworten werden später mit den Antworten der Kandidaten verglichen.
      </p>
      <p v-if="localteam" class="text-sm text-mid-gray mt-4">
        <strong>Lokalteam:</strong> {{ localteam.municipality_name || localteam.name }}
      </p>
      <p class="text-xs text-gray/50 mt-2">
        Sie können Fragen überspringen, indem Sie "Keine Angabe" wählen.
      </p>
    </div>

    <!-- Questions Form -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div 
        v-for="(question, index) in questions" 
        :key="question.id" 
        class="bg-white p-6 rounded-xl shadow-list border border-gray/10 transition-all hover:shadow-lg"
        :class="{
          'ring-2 ring-ff-green': currentQuestionIndex === index,
          'opacity-60': completedQuestions.has(question.id)
        }"
      >
        <div class="flex items-start gap-4 mb-4">
          <span class="flex-shrink-0 w-10 h-10 bg-stats-dark text-white rounded-full flex items-center justify-center font-bold text-lg">
            {{ index + 1 }}
          </span>
          <div class="flex-1">
            <h3 class="text-xl font-semibold text-black leading-tight">
              {{ question.title }}
            </h3>
            <p v-if="question.thesis" class="mt-2 text-gray italic text-lg">
              {{ question.thesis }}
            </p>
          </div>
        </div>

        <!-- Rating Scale -->
        <div class="ml-0 md:ml-14">
          <div class="grid grid-cols-5 gap-2 mb-3">
            <div v-for="option in ratingOptions" :key="option.value" class="flex flex-col items-center">
              <label class="cursor-pointer">
                <input
                  type="radio"
                  :name="'question-' + question.id"
                  :value="option.value"
                  v-model="userAnswers[question.id]"
                  class="radio w-8 h-8 sm:w-10 sm:h-10 border-2 cursor-pointer"
                  :class="getRadioClass(option.value)"
                  @change="markQuestionCompleted(question.id)"
                />
              </label>
            </div>
          </div>
          <div class="grid grid-cols-5 gap-1 text-[10px] sm:text-xs text-center font-medium uppercase tracking-wider text-mid-gray">
            <div v-for="option in ratingOptions" :key="option.value">
              {{ option.label }}
            </div>
          </div>
        </div>

        <!-- Skip Option -->
        <div class="ml-0 md:ml-14 mt-4">
          <label class="flex items-center gap-2 cursor-pointer text-sm text-mid-gray">
            <input
              type="checkbox"
              v-model="skippedQuestions[question.id]"
              class="checkbox checkbox-sm border-gray/30"
              @change="handleSkipChange(question.id)"
            />
            <span>Keine Angabe / Frage überspringen</span>
          </label>
        </div>
      </div>

      <!-- Navigation Buttons -->
      <div class="flex justify-between items-center mt-8 pt-6 border-t border-gray/10">
        <div class="text-sm text-mid-gray">
          {{ completedCount }} / {{ questions.length }} Fragen beantwortet
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
            @click="handleNext"
            :disabled="!canProceed"
            class="btn btn-primary px-8 py-2 rounded-full font-semibold text-white"
            :class="{ 'opacity-50 cursor-not-allowed': !canProceed }"
          >
            <span v-if="!canProceed" class="tooltip tooltip-left" data-tip="Bitte beantworten Sie mindestens eine Frage">
              Weiter
            </span>
            <span v-else>Weiter</span>
            <span v-if="false" class="loading loading-spinner loading-sm"></span>
          </button>
        </div>
      </div>

      <!-- Question Navigation -->
      <div class="flex justify-center gap-2 mt-6 flex-wrap">
        <button
          v-for="(q, idx) in questions"
          :key="q.id"
          @click="currentQuestionIndex = idx"
          class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all"
          :class="{
            'bg-ff-green text-white border-ff-green': currentQuestionIndex === idx,
            'bg-white border-gray/30 text-gray hover:border-ff-green': currentQuestionIndex !== idx,
            'bg-ff-green/10 border-ff-green/30': completedQuestions.has(q.id)
          }"
          :title="`Zu Frage ${idx + 1}`"
        >
          {{ completedQuestions.has(q.id) ? '✓' : idx + 1 }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  questions: {
    type: Array,
    required: true
  },
  election: {
    type: Object,
    default: null
  },
  localteam: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['next', 'prev'])

const ratingOptions = [
  { value: 0, label: 'stark dagegen' },
  { value: 1, label: 'eher dagegen' },
  { value: 2, label: 'neutral' },
  { value: 3, label: 'eher dafür' },
  { value: 4, label: 'stark dafür' }
]

const userAnswers = ref({})
const skippedQuestions = ref({})
const currentQuestionIndex = ref(0)
const completedQuestions = ref(new Set())

// Color classes for rating radios
const ratingRadioClasses = {
  0: 'border-rating-0 text-rating-0',
  1: 'border-rating-1 text-rating-1',
  2: 'border-rating-na text-rating-na',
  3: 'border-rating-3 text-rating-3',
  4: 'border-rating-4 text-rating-4'
}

function getRadioClass(value) {
  return ratingRadioClasses[value] || 'border-gray/30 text-gray'
}

// Mark question as completed when answered
function markQuestionCompleted(questionId) {
  completedQuestions.value.add(questionId)
  // Remove from skipped if it was skipped
  delete skippedQuestions.value[questionId]
}

// Handle skip checkbox change
function handleSkipChange(questionId) {
  if (skippedQuestions.value[questionId]) {
    // Skipping the question
    userAnswers.value[questionId] = undefined
    completedQuestions.value.delete(questionId)
  } else {
    // Un-skipping - set to undefined so user can answer
    userAnswers.value[questionId] = undefined
  }
}

// Check if we can proceed (at least one answer given)
const canProceed = computed(() => {
  return Object.keys(userAnswers.value).some(key => userAnswers.value[key] !== undefined)
})

const completedCount = computed(() => {
  return completedQuestions.value.size
})

// Handle next button
function handleNext() {
  if (!canProceed.value) return
  
  // Build clean answers object (only include answered questions, not skipped ones)
  const answers = {}
  Object.keys(userAnswers.value).forEach(questionId => {
    if (userAnswers.value[questionId] !== undefined) {
      answers[questionId] = userAnswers.value[questionId]
    }
  })
  
  emit('next', answers)
}

// Handle form submission
function handleSubmit() {
  handleNext()
}

// Auto-scroll to question when index changes
watch(currentQuestionIndex, (newIndex) => {
  const element = document.querySelectorAll('.bg-white.p-6.rounded-xl')?.[newIndex]
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})

// Expose userAnswers for parent
defineExpose({
  userAnswers
})
</script>

<style scoped>
.radio:checked {
  background-image: none;
  background-color: currentColor !important;
  border-color: currentColor !important;
}

.radio:checked + label {
  ring-2 ring-current ring-offset-2;
}

input[type="radio"]:focus,
input[type="checkbox"]:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(175, 202, 11, 0.3);
}
</style>
