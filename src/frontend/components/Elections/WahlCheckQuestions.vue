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
	        {{ $t("elections.wahlcheck.questions.title") }}
      </h2>
      <p class="text-mid-gray max-w-2xl mx-auto">
	        {{ $t("elections.wahlcheck.questions.description") }}
      </p>
      <p v-if="localteam" class="text-sm text-mid-gray mt-4">
	        <strong>{{ $t("localteam.singular") }}:</strong> {{ localteam.municipality_name || localteam.name }}
      </p>
      <p class="text-xs text-gray/50 mt-2">
	        {{ $t("elections.wahlcheck.questions.skip_hint") }}
      </p>
    </div>

    <!-- Single Question Display -->
    <div v-if="props.questions.length > 0" class="space-y-6">
      <div 
        class="bg-white p-6 rounded-xl shadow-list border border-gray/10 transition-all"
        :class="{
          'ring-2 ring-ff-green': true,
          'opacity-60': completedQuestions.has(currentQuestion.id)
        }"
      >
        <div class="flex items-start gap-4 mb-4">
          <span class="flex-shrink-0 w-10 h-10 bg-stats-dark text-white rounded-full flex items-center justify-center font-bold text-lg">
            {{ currentQuestionIndex + 1 }}
          </span>
          <div class="flex-1">
            <h3 class="text-xl font-semibold text-black leading-tight">
              {{ currentQuestion.title }}
            </h3>
            <p v-if="currentQuestion.thesis" class="mt-2 text-gray italic text-lg">
              {{ currentQuestion.thesis }}
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
                  :name="'question-' + currentQuestion.id"
                  :value="option.value"
                  v-model="userAnswers[currentQuestion.id]"
                  class="radio w-8 h-8 sm:w-10 sm:h-10 border-2 cursor-pointer"
                  :class="getRadioClass(option.value)"
                  @change="markQuestionCompleted(currentQuestion.id)"
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
              v-model="skippedQuestions[currentQuestion.id]"
              class="checkbox checkbox-sm border-gray/30"
              @change="handleSkipChange(currentQuestion.id)"
            />
	            <span>{{ $t("elections.wahlcheck.questions.skip") }}</span>
          </label>
        </div>
      </div>

      <!-- Navigation Buttons -->
      <div class="flex justify-between items-center mt-8 pt-6 border-t border-gray/10">
        <div class="text-sm text-mid-gray">
	          {{ $t("elections.wahlcheck.questions.answered_count", { ":count": completedCount, ":total": props.questions.length }) }}
        </div>
        <div class="flex gap-4">
          <button
            type="button"
            @click="handlePrevQuestion"
            :disabled="currentQuestionIndex === 0"
            class="btn btn-outline btn-secondary px-6 py-2 rounded-full font-semibold"
            :class="{ 'opacity-50 cursor-not-allowed': currentQuestionIndex === 0 }"
          >
	            {{ $t("generic.back") }}
          </button>
          <button
            type="button"
            @click="handleNextQuestion"
            :disabled="!canProceedToNext"
            class="btn btn-primary px-8 py-2 rounded-full font-semibold text-white"
            :class="{ 'opacity-50 cursor-not-allowed': !canProceedToNext }"
          >
	            <span v-if="currentQuestionIndex === props.questions.length - 1">{{ $t("elections.wahlcheck.questions.to_weighting") }}</span>
	            <span v-else>{{ $t("elections.wahlcheck.questions.next") }}</span>
            <span v-if="false" class="loading loading-spinner loading-sm"></span>
          </button>
        </div>
      </div>

      <!-- Question Progress -->
      <div class="flex justify-center gap-2 mt-6 flex-wrap">
        <button
          v-for="(q, idx) in props.questions"
          :key="q.id"
          @click="currentQuestionIndex = idx"
          class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all"
          :class="{
            'bg-ff-green text-white border-ff-green': currentQuestionIndex === idx,
            'bg-white border-gray/30 text-gray hover:border-ff-green': currentQuestionIndex !== idx,
            'bg-ff-green/10 border-ff-green/30': completedQuestions.has(q.id)
          }"
	          :title="$t('elections.wahlcheck.questions.go_to', { ':number': idx + 1 })"
        >
          {{ completedQuestions.has(q.id) ? '✓' : idx + 1 }}
        </button>
      </div>
    </div>
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
  },
  userAnswers: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['next', 'prev'])

const { $t } = useNuxtApp()

const ratingOptions = [
  { value: 0, label: $t('elections.wahlcheck.answer.strongly_against') },
  { value: 1, label: $t('elections.wahlcheck.answer.somewhat_against') },
  { value: 2, label: $t('elections.wahlcheck.answer.neutral') },
  { value: 3, label: $t('elections.wahlcheck.answer.somewhat_for') },
  { value: 4, label: $t('elections.wahlcheck.answer.strongly_for') }
]

const userAnswers = ref({...props.userAnswers})
const skippedQuestions = ref({})
const currentQuestionIndex = ref(0)
const completedQuestions = ref(new Set())

// Initialize completed questions based on user answers
props.questions.forEach(question => {
  if (props.userAnswers[question.id] !== undefined) {
    completedQuestions.value.add(question.id)
  }
})

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

// Check if we can proceed to next question
const canProceedToNext = computed(() => {
  if (currentQuestionIndex.value === props.questions.length - 1) {
    // On last question, need at least one answer to proceed to summary
    return canProceed.value
  }
  // For other questions, can always proceed (can skip)
  return true
})

const completedCount = computed(() => {
  return completedQuestions.value.size
})

// Get current question
const currentQuestion = computed(() => {
  return props.questions[currentQuestionIndex.value]
})

// Handle next button for single question navigation
function handleNextQuestion() {
  if (!canProceedToNext.value) return
  
  if (currentQuestionIndex.value === props.questions.length - 1) {
    // On last question, proceed to summary
    handleNext()
  } else {
    // Move to next question
    currentQuestionIndex.value++
  }
}

// Handle previous question
function handlePrevQuestion() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  }
}

// Handle next button (final submission)
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

// Watch for changes to userAnswers prop and update internal state
watch(() => props.userAnswers, (newUserAnswers) => {
  // Only update if we're not in the middle of answering questions
  // (to avoid overwriting user's current work)
  if (Object.keys(newUserAnswers).length > 0 && completedQuestions.value.size === 0) {
    userAnswers.value = {...newUserAnswers}
    
    // Update completed questions
    completedQuestions.value.clear()
    props.questions.forEach(question => {
      if (newUserAnswers[question.id] !== undefined) {
        completedQuestions.value.add(question.id)
      }
    })
  }
}, { deep: true })

// Auto-scroll to question when index changes
watch(currentQuestionIndex, (newIndex) => {
  const element = document.querySelector('.bg-white.p-6.rounded-xl')
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
  box-shadow: 0 0 0 2px currentColor, 0 0 0 4px rgba(currentColor, 0.5);
}

input[type="radio"]:focus,
input[type="checkbox"]:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(175, 202, 11, 0.3);
}
</style>
