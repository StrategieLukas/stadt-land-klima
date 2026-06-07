<template>
  <div class="space-y-8">
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
        {{ $t('elections.wahlcheck.summary.title') }}
      </h2>
      <p class="text-mid-gray max-w-2xl mx-auto">
        {{ $t('elections.wahlcheck.summary.description') }}
      </p>
      <p v-if="election" class="text-sm text-mid-gray mt-4">
        <strong>{{ $t('elections.election') }}:</strong> {{ election.descriptor }}
      </p>
    </div>

    <!-- Answers Summary - Compact List View -->
    <div class="space-y-2 max-w-4xl mx-auto">
      <div 
        v-for="(question, index) in questions" 
        :key="question.id" 
        class="bg-white p-4 rounded-lg shadow-sm border border-gray/10 transition-all"
        :class="{
          'ring-2 ring-ff-green': doubleWeightedQuestions.has(question.id),
          'opacity-60': userAnswers[question.id] === undefined
        }"
      >
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-3 w-4/5"> <!-- 80% width for thesis -->
            <span class="flex-shrink-0 w-8 h-8 bg-stats-dark text-white rounded-full flex items-center justify-center font-bold text-sm">
              {{ index + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="font-semibold text-black truncate">
                {{ question.title }}
              </h3>
            </div>
          </div>

          <!-- Aligned indicators column -->
          <div class="flex-shrink-0 flex items-center gap-3 w-1/5 justify-end">
            <!-- User's Answer - Color circle indicator (no text) -->
            <div v-if="userAnswers[question.id] !== undefined" class="flex-shrink-0">
              <div class="w-8 h-8 rounded-full shadow-md" 
                   :class="getRatingColor(userAnswers[question.id])" 
                   :title="getRatingLabel(userAnswers[question.id])"></div>
            </div>
            <div v-else class="w-8 h-8 rounded-full bg-gray/20 shadow-md" :title="$t('elections.wahlcheck.questions.skip')"></div>

            <!-- Double Weight Toggle -->
            <div v-if="userAnswers[question.id] !== undefined" class="flex-shrink-0">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="doubleWeightedQuestions.has(question.id)"
                  @change="$emit('toggle-double-weight', question.id)"
                  class="checkbox checkbox-sm checkbox-primary border-2"
                />
                <span class="text-xs text-stats-dark">2×</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="bg-ff-green/10 border border-ff-green/30 p-6 rounded-xl text-center">
      <h3 class="text-lg font-bold text-stats-dark mb-4">{{ $t('elections.wahlcheck.summary.stats_title') }}</h3>
      <div class="flex justify-center gap-8">
        <div class="text-center">
          <div class="text-3xl font-bold text-ff-green">{{ answeredCount }}</div>
          <div class="text-sm text-mid-gray">{{ $t('elections.wahlcheck.summary.answered') }}</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-ff-green">{{ doubleWeightedCount }}</div>
          <div class="text-sm text-mid-gray">{{ $t('elections.wahlcheck.results.double_weighted') }}</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-ff-green">{{ skippedCount }}</div>
          <div class="text-sm text-mid-gray">{{ $t('elections.wahlcheck.summary.skipped') }}</div>
        </div>
      </div>
    </div>

    <!-- Warning if all questions are skipped -->
    <div v-if="answeredCount === 0" class="bg-orange/10 border border-orange text-orange-700 p-4 rounded-xl">
      <p class="font-bold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        {{ $t('elections.wahlcheck.summary.no_answers_warning_title') }}
      </p>
      <p class="mt-2 text-sm">
        {{ $t('elections.wahlcheck.summary.no_answers_warning_description') }}
      </p>
    </div>

    <!-- Navigation Buttons -->
    <div class="flex justify-between items-center mt-8 pt-6 border-t border-gray/10">
      <div class="text-sm text-mid-gray">
        {{ $t('elections.wahlcheck.summary.answer_count', { ':answered': answeredCount, ':total': questions.length, ':weighted': doubleWeightedCount }) }}
      </div>
      <div class="flex gap-4">
        <button
          type="button"
          @click="$emit('prev')"
          class="btn btn-outline btn-secondary px-6 py-2 rounded-full font-semibold"
        >
          {{ $t('generic.back') }}
        </button>
        <button
          type="button"
          @click="$emit('next')"
          class="btn btn-primary px-8 py-2 rounded-full font-semibold text-white"
        >
          {{ $t('elections.wahlcheck.summary.show_results') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

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

// Rating options and colors
const ratingOptions = [
  { value: 0, label: $t('elections.wahlcheck.answer.strongly_against') },
  { value: 1, label: $t('elections.wahlcheck.answer.somewhat_against') },
  { value: 2, label: $t('elections.wahlcheck.answer.neutral') },
  { value: 3, label: $t('elections.wahlcheck.answer.somewhat_for') },
  { value: 4, label: $t('elections.wahlcheck.answer.strongly_for') }
]

const ratingColors = {
  0: 'bg-rating-0',
  1: 'bg-rating-1',
  2: 'bg-rating-na',
  3: 'bg-rating-3',
  4: 'bg-rating-4'
}

const ratingLabels = Object.fromEntries(ratingOptions.map(option => [option.value, option.label]))

const ratingLabelsShort = {
  0: 'SD',
  1: 'ED',
  2: 'N',
  3: 'EF',
  4: 'SF'
}

function getRatingColor(value) {
  return ratingColors[value] || 'bg-gray'
}

function getRatingLabel(value) {
  return ratingLabels[value] || $t('generic.no_answer')
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
.checkbox-primary:checked {
  background-color: #afca0b;
  border-color: #afca0b;
}

.checkbox-primary:checked + span {
  color: #afca0b;
}
</style>
