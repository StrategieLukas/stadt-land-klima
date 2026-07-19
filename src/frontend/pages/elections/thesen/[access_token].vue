<template>
  <div class="min-h-screen bg-mild-white py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div v-if="!submitted" class="text-center mb-12">
        <ElectionsWahlCheckLogo
          v-if="candidate?.election?.custom_logo"
          :logo="candidate.election.custom_logo"
          fallback="none"
          :alt="$t('logo.alt')"
          logo-class="mx-auto mb-6 h-20 max-w-full object-contain"
        />
        <h1 class="text-h1 font-bold text-black mb-4">
	          {{ $t("elections.theses.title") }}
        </h1>
        <p v-if="localteam" class="text-lg text-mid-gray mb-2">
	          {{ $t("localteam.singular") }}: <span class="font-semibold text-stats-dark">{{ localteam.name }}</span>
        </p>
        <p v-if="candidate" class="text-lg text-mid-gray flex items-center justify-center gap-2">
	          {{ $t("elections.candidate") }}: <span class="font-semibold text-stats-dark">{{ candidate.name }}</span>
          <CandidatePartyLabel :party="candidate.party" :state="candidateState" />
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="flex justify-center items-center py-20">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <!-- Error State -->
      <div v-else-if="error || !localteam || !candidate" class="bg-solid-red-10 border border-red text-red p-6 rounded-lg text-center">
	        <p class="font-bold text-xl mb-2">{{ $t("generic.loading_error") }}</p>
	        <p>{{ $t("elections.theses.loading_error.description") }}</p>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-rating-4-very-light border border-rating-4 text-rating-4 p-10 rounded-2xl text-center shadow-lg my-12">
        <ElectionsWahlCheckLogo
          v-if="candidate?.election?.custom_logo"
          :logo="candidate.election.custom_logo"
          fallback="none"
          :alt="$t('logo.alt')"
          logo-class="mx-auto mb-8 h-20 max-w-full object-contain"
        />
        <div class="mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mx-auto text-rating-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
	        <h2 class="text-3xl font-bold mb-4 text-black">{{ $t("generic.thank_you") }}</h2>
	        <p class="text-xl text-mid-gray">{{ $t("elections.theses.submitted") }}</p>
      </div>

      <!-- Survey Form -->
      <div v-else-if="questions && questions.length > 0" class="space-y-8">
        <div v-if="isPastCutoff" class="bg-solid-orange-10 border border-orange text-orange-700 p-6 rounded-lg text-center font-bold mb-8">
	          {{ $t("elections.theses.cutoff_reached", { ":date": new Date(candidate.election.response_cutoff_date).toLocaleDateString($locale) }) }}
        </div>

        <div v-for="(question, index) in questions" :key="question.id" class="bg-white p-6 rounded-xl shadow-list border border-solid-gray-10">
          <div class="flex items-start mb-6">
            <span class="flex-shrink-0 w-8 h-8 bg-stats-dark text-white rounded-full flex items-center justify-center font-bold mr-4">
              {{ index + 1 }}
            </span>
            <h3 class="text-h3 font-semibold text-black leading-tight pt-1">
              {{ question.title || question.thesis }}
            </h3>
          </div>

          <ElectionsQuestionBackgroundInfo
            :content="question.background_information"
            appearance="italic"
            class="mb-4 sm:ml-12"
          />

          <div
            v-if="question.title && question.thesis"
            class="mb-6 sm:ml-12 rounded-lg border border-solid-light-blue-30 bg-solid-very-light-blue-60 p-4 text-lg text-gray"
          >
            {{ question.thesis }}
          </div>

          <!-- Rating Scale -->
          <div class="ml-0 sm:ml-12">
            <div
              class="grid gap-2 mb-2"
              :class="{ 'grid-cols-3': isSimpleAnswerMode, 'grid-cols-5': !isSimpleAnswerMode }"
            >
              <div v-for="option in ratingOptions" :key="option.value" class="flex flex-col items-center">
                <input
                  type="radio"
                  :name="'question-' + question.id"
                  :value="option.value"
                  v-model="answers[question.id]"
                  :disabled="isPastCutoff"
                  class="radio w-8 h-8 sm:w-10 sm:h-10 border-2"
                  :class="[option.radioClass, { 'opacity-50 cursor-not-allowed': isPastCutoff }]"
                />
              </div>
            </div>
            <div
              class="grid gap-1 text-[8px] sm:text-xs text-center font-medium uppercase tracking-wider text-mid-gray"
              :class="{ 'grid-cols-3': isSimpleAnswerMode, 'grid-cols-5': !isSimpleAnswerMode }"
            >
              <div v-for="option in ratingOptions" :key="option.value">
                {{ option.label }}
              </div>
            </div>
          </div>

          <!-- Reasoning Field -->
          <div class="mt-8 ml-0 sm:ml-12">
            <label :for="'explanation-' + question.id" class="block text-sm font-semibold text-stats-dark mb-2">
	              {{ $t("elections.theses.reasoning_label") }}
            </label>
            <textarea
              :id="'explanation-' + question.id"
              v-model="explanations[question.id]"
              rows="3"
              maxlength="500"
              :disabled="isPastCutoff"
              class="textarea textarea-bordered w-full bg-mild-white focus:border-stats-dark focus:ring-1 focus:ring-stats-dark text-black transition-all resize-none"
              :class="{ 'opacity-50 cursor-not-allowed': isPastCutoff }"
	              :placeholder="$t('elections.theses.reasoning_placeholder')"
            ></textarea>
            <div class="flex justify-end mt-1 text-xs text-mid-gray">
              <span :class="{ 'text-red font-bold': (explanations[question.id]?.length || 0) >= 500 }">
                {{ explanations[question.id]?.length || 0 }}
              </span>
              / 500
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div v-if="!isPastCutoff" class="pt-8 flex flex-col items-center">
          <button
            @click="submitAnswers"
            :disabled="!isFormComplete || submitting"
            class="btn btn-primary btn-lg px-12 text-white font-bold rounded-full shadow-lg transition-all hover:scale-105 disabled:opacity-50"
          >
            <span v-if="submitting" class="loading loading-spinner"></span>
	            {{ $t("generic.confirm") }}
          </button>
          <p v-if="!isFormComplete" class="mt-4 text-orange font-medium animate-pulse">
	            {{ $t("elections.theses.answer_all", { ":count": questions.length }) }}
          </p>
        </div>
      </div>

      <!-- No Questions State -->
      <div v-else class="bg-white p-12 rounded-2xl shadow-list text-center">
	        <p class="text-xl text-mid-gray">{{ $t("elections.theses.no_published") }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { createItem, updateItem } from '@directus/sdk'
import {
  getWahlcheckAnswerOptions,
  usesSimpleWahlcheckAnswerMode,
} from '~/shared/wahlcheckAnswerOptions.js'

const route = useRoute()
const { $directus, $readItems, $readItem, $t, $locale } = useNuxtApp()

const accessToken = route.params.access_token

const answers = ref({})
const explanations = ref({}) // Store reasoning for each question
const existingAnswerIds = ref({}) // Store existing answer IDs by question ID
const submitting = ref(false)
const submitted = ref(false)

const { data, pending, error } = await useAsyncData(`thesen-${accessToken}`, async () => {
  try {
    const candidates = await $directus.request($readItems('candidate', {
      filter: { access_token: { _eq: accessToken } },
      fields: ['*', 'election.*', 'election.localteam.*', 'election.localteam.municipality_id.*']
    })).catch(() => [])

    const candidate = candidates?.[0] || null
    if (!candidate) return { candidate: null, localteam: null, questions: [], existingAnswers: [] }

    const localteam = candidate.election?.localteam

    if (!localteam) return { candidate, localteam: null, questions: [], existingAnswers: [] }

    const questions = await $directus.request($readItems('questions', {
      filter: {
        election: { _eq: candidate.election.id },
        status: { _eq: 'published' }
      },
      sort: ['date_created']
    }))

    let existingAnswers = []
    if (questions && questions.length > 0) {
      existingAnswers = await $directus.request($readItems('answers', {
        filter: {
          candidate: { _eq: candidate.id },
          question: { _in: questions.map(q => q.id) }
        }
      }))
    }

    return { localteam, candidate, questions, existingAnswers }
  } catch (e) {
    console.error('AsyncData error:', e)
    throw e
  }
})

// Initialize answers and existingAnswerIds from fetched data
watchEffect(() => {
  if (data.value?.existingAnswers) {
    data.value.existingAnswers.forEach(ans => {
      // Directus returns related items as objects or IDs depending on depth
      const questionId = typeof ans.question === 'object' ? ans.question.id : ans.question
      answers.value[questionId] = ans.response
      explanations.value[questionId] = ans.explanation || ''
      existingAnswerIds.value[questionId] = ans.id
    })
  }
})

const localteam = computed(() => data.value?.localteam)
const candidate = computed(() => data.value?.candidate)
const candidateState = computed(() => localteam.value?.municipality_id?.state || '')
const questions = computed(() => data.value?.questions || [])
const isSimpleAnswerMode = computed(() => usesSimpleWahlcheckAnswerMode(candidate.value?.election))
const ratingOptions = computed(() => {
  return getWahlcheckAnswerOptions(candidate.value?.election, $t).reverse()
})

const isPastCutoff = computed(() => {
  if (!candidate.value?.election?.response_cutoff_date) return false
  return new Date() > new Date(candidate.value.election.response_cutoff_date)
})

const isFormComplete = computed(() => {
  if (!questions.value || !questions.value.length) return false
  return questions.value.every(q => answers.value[q.id] !== undefined)
})

async function submitAnswers() {
  if (!isFormComplete.value || submitting.value || isPastCutoff.value) return

  submitting.value = true
  try {
    const candidateUuid = candidate.value.id
    const now = new Date().toISOString()

    // Process answers sequentially to avoid connection pool exhaustion
    for (const q of questions.value) {
      const payload = {
        question: q.id,
        candidate: candidateUuid,
        response: answers.value[q.id],
        explanation: explanations.value[q.id]
      }

      const existingId = existingAnswerIds.value[q.id]
      if (existingId) {
        await $directus.request(updateItem('answers', existingId, payload))
      } else {
        await $directus.request(createItem('answers', payload))
      }
    }

    // Update candidate indicator and timestamps
    const candidateUpdate = {
      has_answered: true,
      time_last_edited: now
    }

    // Only set time_first_submitted if it's the first time
    if (!candidate.value?.time_first_submitted) {
      candidateUpdate.time_first_submitted = now
    }

    await $directus.request(updateItem('candidate', candidateUuid, candidateUpdate))

    submitted.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    console.error('Error submitting answers:', e)
    alert('Fehler beim Übermitteln der Antworten. Bitte versuchen Sie es später erneut.')
  } finally {
    submitting.value = false
  }
}

useHead({
  title: 'Thesen-Check - Stadt.Land.Klima',
})
</script>

<style scoped>
.radio:checked {
  background-image: none;
  background-color: currentColor !important;
  border-color: currentColor !important;
}
</style>
