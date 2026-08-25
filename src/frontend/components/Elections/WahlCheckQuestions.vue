<template>
  <div class="space-y-8">
    <!-- Introduction -->
    <div class="bg-white p-4 sm:p-8 rounded-xl shadow-list border border-solid-gray-10 text-center">
      <div class="mb-6">
        <ElectionsWahlCheckLogo
          :logo="election?.custom_logo"
          fallback="flower"
          :alt="$t('logo.alt')"
          logo-class="h-20 sm:h-24 w-auto mx-auto object-contain"
          fallback-class="h-20 sm:h-24 w-auto mx-auto opacity-80"
        />
      </div>
      <h2 class="text-xl sm:text-2xl font-bold text-stats-dark mb-4">
        {{ $t("elections.wahlcheck.questions.title") }}
      </h2>
      <p class="text-mid-gray max-w-2xl mx-auto text-sm sm:text-base">
        {{ $t("elections.wahlcheck.questions.description") }}
      </p>
      <p v-if="localteam" class="text-sm text-mid-gray mt-4">
        <strong>{{ $t("localteam.singular") }}:</strong> {{ localteam.municipality_name || localteam.name }}
      </p>
      <p class="text-xs text-solid-gray-50 mt-2">
        {{ $t("elections.wahlcheck.questions.skip_hint") }}
      </p>
    </div>

    <!-- Single Question Display with Carousel-like Swipe Animation -->
    <div v-if="props.questions.length > 0" class="space-y-6">
      <div class="overflow-hidden relative min-h-[320px] grid grid-cols-1 grid-rows-1 [&>*]:col-start-1 [&>*]:row-start-1">
        <Transition :name="transitionDirection">
          <div 
            :key="currentQuestion.id"
            class="bg-white p-4 sm:p-6 rounded-xl shadow-list border-2 border-ff-green transition-all w-full h-fit self-start"
          >
            <div class="flex items-start gap-3 sm:gap-4 mb-4">
              <span class="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-stats-dark text-white rounded-full flex items-center justify-center font-bold text-base sm:text-lg">
                {{ currentQuestionIndex + 1 }}
              </span>
              <div class="flex-1 min-w-0">
                <h3 class="text-lg sm:text-xl font-semibold text-black leading-tight break-words hyphens-auto">
                  {{ currentQuestion.title }}
                </h3>
                <ElectionsQuestionBackgroundInfo
                  :content="currentQuestion.background_information"
                  appearance="italic"
                  class="mt-2 break-words hyphens-auto"
                />
                <p
                  v-if="currentQuestion.thesis"
                  class="mt-4 rounded-lg border border-solid-light-blue-30 bg-solid-very-light-blue-60 p-3 sm:p-4 text-base sm:text-lg text-gray break-words hyphens-auto"
                >
                  {{ currentQuestion.thesis }}
                </p>
              </div>
            </div>

            <!-- Rating Scale -->
            <div class="ml-0 sm:ml-12 md:ml-14">
              <div
                class="grid gap-2 mb-3"
                :class="{ 'grid-cols-3': isSimpleAnswerMode, 'grid-cols-5': !isSimpleAnswerMode }"
              >
                <div v-for="option in ratingOptions" :key="option.value" class="flex flex-col items-center">
                  <label
                    class="p-1 rounded-full focus-within:outline-none transition-transform relative option-btn cursor-pointer flex items-center justify-center"
                    :class="{ 'sparkle-active': sparklingOption === option.value }"
                    :style="{ '--sparkle-rgb': option.sparkleRgb }"
                  >
                    <input
                      type="radio"
                      :name="'question-' + currentQuestion.id"
                      :value="option.value"
                      :checked="userAnswers[currentQuestion.id] === option.value"
                      class="w-8 h-8 sm:w-10 sm:h-10 opacity-0 absolute inset-0 cursor-pointer z-10"
                      @click="selectOption(currentQuestion.id, option.value)"
                    />
                    <div
                      class="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer select-none"
                      :class="getOptionCircleClass(currentQuestion.id, option.value)"
                    >
                      <span
                        v-if="userAnswers[currentQuestion.id] === option.value"
                        class="text-white text-xs sm:text-sm font-bold"
                      >✓</span>
                    </div>
                  </label>
                </div>
              </div>
              <div
                class="grid gap-1 text-[9px] xs:text-[10px] sm:text-xs text-center font-medium uppercase tracking-wider text-mid-gray"
                :class="{ 'grid-cols-3': isSimpleAnswerMode, 'grid-cols-5': !isSimpleAnswerMode }"
              >
                <div v-for="option in ratingOptions" :key="option.value" class="leading-tight">
                  {{ option.label }}
                </div>
              </div>
            </div>

            <!-- Skip Option -->
            <div class="ml-0 sm:ml-12 md:ml-14 mt-4">
              <label class="flex items-center gap-2 cursor-pointer text-sm text-mid-gray w-fit">
                <input
                  type="checkbox"
                  :checked="!!skippedQuestions[currentQuestion.id]"
                  class="checkbox checkbox-sm border-solid-gray-30"
                  @change="handleSkipChange(currentQuestion.id, $event)"
                />
                <span>{{ $t("elections.wahlcheck.questions.skip") }}</span>
              </label>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Navigation Buttons (Requirement 1) -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-6 pt-6 border-t border-solid-gray-10 gap-4">
        <div class="text-xs sm:text-sm text-mid-gray text-center sm:text-left">
          {{ $t("elections.wahlcheck.questions.answered_count", { ":count": completedCount, ":total": props.questions.length }) }}
        </div>
        <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <button
            type="button"
            @click="handlePrevQuestion"
            :disabled="currentQuestionIndex === 0"
            class="flex-1 sm:flex-initial btn btn-outline btn-secondary px-4 sm:px-6 py-2 rounded-full font-semibold"
            :class="{ 'opacity-50 cursor-not-allowed': currentQuestionIndex === 0 }"
          >
            {{ $t("generic.back") }}
          </button>
          <button
            type="button"
            @click="handleNextQuestion"
            :disabled="!canProceedToNext"
            class="flex-1 sm:flex-initial btn btn-primary px-4 sm:px-8 py-2 rounded-full font-semibold text-white whitespace-nowrap"
            :class="{ 'opacity-50 cursor-not-allowed': !canProceedToNext }"
          >
            <span v-if="currentQuestionIndex === props.questions.length - 1">{{ $t("elections.wahlcheck.questions.to_weighting") }}</span>
            <span v-else>{{ $t("elections.wahlcheck.questions.next") }}</span>
          </button>
        </div>
      </div>

      <!-- Question Progress -->
      <div class="flex justify-center gap-1.5 sm:gap-2 mt-6 flex-wrap">
        <button
          v-for="(q, idx) in props.questions"
          :key="q.id"
          @click="selectQuestion(idx)"
          class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm font-medium transition-all"
          :class="{
            'bg-ff-green text-white border-ff-green': currentQuestionIndex === idx,
            'bg-white border-solid-gray-30 text-gray hover:border-ff-green': currentQuestionIndex !== idx,
            'bg-solid-ff-green-10 border-solid-ff-green-30': completedQuestions.has(q.id)
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
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import {
  getWahlcheckAnswerOptions,
  usesSimpleWahlcheckAnswerMode,
} from '~/shared/wahlcheckAnswerOptions.js'

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
  },
  initialQuestionIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['next', 'prev'])

const { $t } = useNuxtApp()

const isSimpleAnswerMode = computed(() => usesSimpleWahlcheckAnswerMode(props.election))
const ratingOptions = computed(() => {
  return getWahlcheckAnswerOptions(props.election, $t).reverse()
})

const userAnswers = ref({...props.userAnswers})
const skippedQuestions = ref({})
const currentQuestionIndex = ref(
  Math.min(Math.max(0, props.initialQuestionIndex || 0), Math.max(0, props.questions.length - 1))
)
const completedQuestions = ref(new Set())
const transitionDirection = ref('slide-left')
const sparklingOption = ref(null)
let advanceTimeout = null

// Initialize completed questions based on user answers
props.questions.forEach(question => {
  if (props.userAnswers[question.id] !== undefined) {
    completedQuestions.value.add(question.id)
  }
})

// Watch initialQuestionIndex prop
watch(() => props.initialQuestionIndex, (newIdx) => {
  if (typeof newIdx === 'number' && props.questions.length > 0) {
    currentQuestionIndex.value = Math.min(Math.max(0, newIdx), props.questions.length - 1)
  }
})

function getOptionCircleClass(questionId, value) {
  const isSelected = userAnswers.value[questionId] === value
  const option = ratingOptions.value.find((item) => item.value === Number(value))
  
  if (isSelected) {
    return `${option?.colorClass || 'bg-ff-green'} border-transparent text-white shadow-md scale-105`
  }
  
  const borderClass = option?.radioClass?.split(' ')[0] || 'border-solid-gray-30'
  return `bg-white ${borderClass} hover:bg-solid-gray-05`
}

function selectOption(questionId, value) {
  userAnswers.value[questionId] = value
  delete skippedQuestions.value[questionId]
  completedQuestions.value.add(questionId)
  sparklingOption.value = value

  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }

  // 300ms sparkle animation, then begin smooth carousel swipe
  advanceTimeout = setTimeout(() => {
    sparklingOption.value = null
    if (currentQuestionIndex.value < props.questions.length - 1) {
      transitionDirection.value = 'slide-left'
      currentQuestionIndex.value++
      advanceTimeout = null
    } else {
      // Last question completed -> proceed directly to weights (Requirement 3)
      advanceTimeout = null
      handleNext()
    }
  }, 300)
}

// Mark question as completed when answered
function markQuestionCompleted(questionId) {
  completedQuestions.value.add(questionId)
  delete skippedQuestions.value[questionId]
  
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }

  if (currentQuestionIndex.value < props.questions.length - 1) {
    advanceTimeout = setTimeout(() => {
      transitionDirection.value = 'slide-left'
      currentQuestionIndex.value++
      advanceTimeout = null
    }, 300)
  } else {
    advanceTimeout = setTimeout(() => {
      advanceTimeout = null
      handleNext()
    }, 300)
  }
}

// Handle skip checkbox change
function handleSkipChange(questionId, event) {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }
  sparklingOption.value = null

  const isChecked = event?.target ? event.target.checked : skippedQuestions.value[questionId]

  if (isChecked) {
    // Skipping the question
    skippedQuestions.value[questionId] = true
    userAnswers.value[questionId] = undefined
    completedQuestions.value.delete(questionId)
    
    advanceTimeout = setTimeout(() => {
      if (currentQuestionIndex.value < props.questions.length - 1) {
        transitionDirection.value = 'slide-left'
        currentQuestionIndex.value++
        advanceTimeout = null
      } else {
        advanceTimeout = null
        handleNext()
      }
    }, 300)
  } else {
    delete skippedQuestions.value[questionId]
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
  return props.questions[currentQuestionIndex.value] || props.questions[0]
})

function selectQuestion(idx) {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }
  transitionDirection.value = idx > currentQuestionIndex.value ? 'slide-left' : 'slide-right'
  currentQuestionIndex.value = idx
}

// Handle next button for single question navigation
function handleNextQuestion() {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }

  if (!canProceedToNext.value) return
  
  if (currentQuestionIndex.value === props.questions.length - 1) {
    // On last question, proceed to summary
    handleNext()
  } else {
    // Move to next question
    transitionDirection.value = 'slide-left'
    currentQuestionIndex.value++
  }
}

// Handle previous question
function handlePrevQuestion() {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }

  if (currentQuestionIndex.value > 0) {
    transitionDirection.value = 'slide-right'
    currentQuestionIndex.value--
  }
}

// Handle next button (final submission)
function handleNext() {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }

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

onBeforeUnmount(() => {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
  }
})

// Expose userAnswers for parent
defineExpose({
  userAnswers
})
</script>

<style scoped>
.option-btn {
  border-radius: 9999px;
}

.sparkle-active {
  animation: sparkleRing 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes sparkleRing {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--sparkle-rgb), 0.85);
    transform: scale(0.95);
  }
  50% {
    box-shadow: 0 0 0 7px rgba(var(--sparkle-rgb), 0.4);
    transform: scale(1.1);
  }
  100% {
    box-shadow: 0 0 0 12px rgba(var(--sparkle-rgb), 0);
    transform: scale(1);
  }
}

/* Simultaneous Carousel Swipe Transitions */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
}

.slide-left-enter-from {
  transform: translateX(100%);
}

.slide-left-leave-to {
  transform: translateX(-100%);
}

.slide-right-enter-from {
  transform: translateX(-100%);
}

.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
