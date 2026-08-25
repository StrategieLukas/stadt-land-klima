<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="bg-white p-4 sm:p-8 rounded-xl shadow-list border border-solid-gray-10 text-center">
      <div class="mb-6">
        <img
          src="~/assets/images/Klima-Wahlcheck-Logo.svg"
          :alt="$t('elections.wahlcheck.header_title')"
          class="mx-auto h-auto w-full max-w-lg object-contain"
        />
      </div>
      <h2 class="text-xl sm:text-2xl font-bold text-stats-dark mb-4">
        {{ $t('elections.wahlcheck.summary.title') }}
      </h2>
      <p class="text-mid-gray max-w-2xl mx-auto text-sm sm:text-base">
        {{ $t('elections.wahlcheck.summary.description') }}
      </p>
      <p v-if="election" class="text-sm text-mid-gray mt-4">
        <strong>{{ $t('elections.election') }}:</strong> {{ election.descriptor }}
      </p>
    </div>

    <!-- Answers Summary - Clickable List View for Double Weighting -->
    <div class="space-y-2 max-w-4xl mx-auto">
      <template v-for="(question, index) in questions" :key="question.id">
        <!-- Answered Question: Full tile clickable for double weighting -->
        <div
          v-if="userAnswers[question.id] !== undefined"
          class="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-solid-gray-10 transition-all select-none cursor-pointer hover:border-solid-gray-40 hover:shadow-md flex items-center justify-between gap-3 sm:gap-4"
          :class="{
            'ring-2 ring-orange border-orange/40 bg-solid-orange-10/20': doubleWeightedQuestions.has(question.id),
          }"
          role="button"
          tabindex="0"
          :aria-pressed="doubleWeightedQuestions.has(question.id)"
          @click="handleCardClick(question.id, $event)"
          @keydown.enter.space.prevent="handleCardClick(question.id, $event)"
        >
          <!-- Question Number and Title -->
          <div class="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
            <span class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-stats-dark text-white rounded-full flex items-center justify-center font-bold text-xs sm:text-sm">
              {{ index + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm sm:text-base font-semibold text-black break-words hyphens-auto leading-snug">
                {{ question.title }}
              </h3>
            </div>
          </div>

          <!-- Indicators column: Answer score circle + 2x badge -->
          <div class="flex-shrink-0 flex items-center gap-2 sm:gap-3">
            <!-- User's Answer - Color circle indicator -->
            <div class="flex-shrink-0">
              <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-md" 
                   :class="getRatingColor(userAnswers[question.id])" 
                   :title="getRatingLabel(userAnswers[question.id])"></div>
            </div>

            <!-- Double Weight Toggle Checkbox (empty when unchecked, orange 2x circle when checked) -->
            <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center">
              <input
                type="checkbox"
                class="checkbox checkbox-primary weight-toggle-checkbox"
                :checked="doubleWeightedQuestions.has(question.id)"
                :aria-label="$t('elections.wahlcheck.results.double_weighted')"
                :title="$t('elections.wahlcheck.results.double_weighted')"
                @change="onCheckboxChange(question.id, $event)"
              />
            </div>
          </div>
        </div>

        <!-- Skipped Question: Non-clickable tile -->
        <div
          v-else
          class="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-solid-gray-10 opacity-60 flex items-center justify-between gap-3 sm:gap-4"
        >
          <div class="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
            <span class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-stats-dark text-white rounded-full flex items-center justify-center font-bold text-xs sm:text-sm">
              {{ index + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm sm:text-base font-semibold text-black break-words hyphens-auto leading-snug">
                {{ question.title }}
              </h3>
            </div>
          </div>

          <div class="flex-shrink-0 flex items-center gap-2 sm:gap-3">
            <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-solid-gray-20 shadow-md flex-shrink-0" :title="$t('elections.wahlcheck.questions.skip')"></div>
            <div class="w-6 h-6 flex-shrink-0"></div>
          </div>
        </div>
      </template>
    </div>

    <!-- Warning if all questions are skipped -->
    <div v-if="answeredCount === 0" class="bg-solid-orange-10 border border-orange text-orange-700 p-4 rounded-xl">
      <p class="font-bold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span>{{ $t('elections.wahlcheck.summary.no_answers_warning_title') }}</span>
      </p>
      <p class="mt-2 text-sm">
        {{ $t('elections.wahlcheck.summary.no_answers_warning_description') }}
      </p>
    </div>

    <!-- Navigation Buttons (Requirement 1) -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-8 pt-6 border-t border-solid-gray-10 gap-4">
      <div class="text-xs sm:text-sm text-mid-gray text-center sm:text-left">
        {{ $t('elections.wahlcheck.summary.answer_count', { ':answered': answeredCount, ':total': questions.length, ':weighted': doubleWeightedCount }) }}
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <button
          type="button"
          @click="$emit('prev')"
          class="flex-1 sm:flex-initial btn btn-outline btn-secondary px-4 sm:px-6 py-2 rounded-full font-semibold"
        >
          {{ $t('generic.back') }}
        </button>
        <button
          type="button"
          @click="$emit('next')"
          class="flex-1 sm:flex-initial btn btn-primary px-4 sm:px-8 py-2 rounded-full font-semibold text-white whitespace-nowrap"
        >
          {{ $t('elections.wahlcheck.summary.show_results') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  getWahlcheckAnswerLabel,
  getWahlcheckRatingColor,
} from '~/shared/wahlcheckAnswerOptions.js'

const { $t } = useNuxtApp()

const props = defineProps({
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
  election: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['next', 'prev', 'toggle-double-weight'])

function handleCardClick(questionId, event) {
  if (event && event.target && (event.target.tagName === 'INPUT' || event.target.closest('input'))) {
    return
  }
  if (props.userAnswers[questionId] !== undefined) {
    emit('toggle-double-weight', questionId)
  }
}

function onCheckboxChange(questionId, event) {
  emit('toggle-double-weight', questionId)
}

function getRatingColor(value) {
  return getWahlcheckRatingColor(value)
}

function getRatingLabel(value) {
  return getWahlcheckAnswerLabel(value, props.election, $t)
}

// Computed stats
const answeredCount = computed(() => {
  return Object.keys(props.userAnswers).filter(
    key => props.userAnswers[key] !== undefined
  ).length
})

const doubleWeightedCount = computed(() => {
  return props.doubleWeightedQuestions.size
})

const skippedCount = computed(() => {
  return props.questions.length - answeredCount.value
})
</script>

<style scoped>
.weight-toggle-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 1.5rem;
  height: 1.5rem;
  min-height: 1.5rem;
  min-width: 1.5rem;
  border-radius: 9999px;
  border: none !important;
  background-color: transparent !important;
  background-image: none !important;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  outline: none;
  box-shadow: none;
}

.weight-toggle-checkbox:checked {
  background-color: #f39200 !important;
  background-image: none !important;
  border-color: #f39200 !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.weight-toggle-checkbox:checked::after {
  content: "2×";
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
