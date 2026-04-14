<template>
  <div class="min-h-screen bg-mild-white py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div v-if="!submitted" class="text-center mb-12">
        <h1 class="text-h1 font-bold text-black mb-4">
          Thesen-Check
        </h1>
        <p v-if="localteam" class="text-lg text-mid-gray mb-2">
          Lokalteam: <span class="font-semibold text-stats-dark">{{ localteam.name }}</span>
        </p>
        <p v-if="candidate" class="text-lg text-mid-gray">
          Kandidat: <span class="font-semibold text-stats-dark">{{ candidate.name }}</span>
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="flex justify-center items-center py-20">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <!-- Error State -->
      <div v-else-if="error || !localteam || !candidate" class="bg-red/10 border border-red text-red p-6 rounded-lg text-center">
        <p class="font-bold text-xl mb-2">Fehler beim Laden</p>
        <p>Die angeforderten Daten konnten nicht geladen werden. Bitte überprüfen Sie die URL.</p>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-rating-4-very-light border border-rating-4 text-rating-4 p-10 rounded-2xl text-center shadow-lg my-12">
        <div class="mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mx-auto text-rating-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="text-3xl font-bold mb-4 text-black">Vielen Dank!</h2>
        <p class="text-xl text-mid-gray">Ihre Antworten wurden erfolgreich übermittelt.</p>
      </div>

      <!-- Survey Form -->
      <div v-else-if="questions && questions.length > 0" class="space-y-8">
        <div v-for="(question, index) in questions" :key="question.id" class="bg-white p-6 rounded-xl shadow-list border border-gray/10">
          <div class="flex items-start mb-6">
            <span class="flex-shrink-0 w-8 h-8 bg-stats-dark text-white rounded-full flex items-center justify-center font-bold mr-4">
              {{ index + 1 }}
            </span>
            <h3 class="text-h3 font-semibold text-black leading-tight pt-1">
              {{ question.title || question.thesis }}
            </h3>
          </div>

          <div v-if="question.title && question.thesis" class="mb-6 ml-12 text-gray italic">
            {{ question.thesis }}
          </div>

          <!-- Rating Scale -->
          <div class="ml-0 sm:ml-12">
            <div class="grid grid-cols-5 gap-2 mb-2">
              <div v-for="option in ratingOptions" :key="option.value" class="flex flex-col items-center">
                <input
                  type="radio"
                  :name="'question-' + question.id"
                  :value="option.value"
                  v-model="answers[question.id]"
                  class="radio w-8 h-8 sm:w-10 sm:h-10 border-2"
                  :class="option.radioClass"
                />
              </div>
            </div>
            <div class="grid grid-cols-5 gap-1 text-[8px] sm:text-xs text-center font-medium uppercase tracking-wider text-mid-gray">
              <div v-for="option in ratingOptions" :key="option.value">
                {{ option.label }}
              </div>
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="pt-8 flex flex-col items-center">
          <button
            @click="submitAnswers"
            :disabled="!isFormComplete || submitting"
            class="btn btn-primary btn-lg px-12 text-white font-bold rounded-full shadow-lg transition-all hover:scale-105 disabled:opacity-50"
          >
            <span v-if="submitting" class="loading loading-spinner"></span>
            Bestätigen
          </button>
          <p v-if="!isFormComplete" class="mt-4 text-orange font-medium animate-pulse">
            Bitte beantworten Sie alle {{ questions.length }} Fragen.
          </p>
        </div>
      </div>

      <!-- No Questions State -->
      <div v-else class="bg-white p-12 rounded-2xl shadow-list text-center">
        <p class="text-xl text-mid-gray">Für dieses Lokalteam sind aktuell keine veröffentlichten Thesen verfügbar.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { createItem, updateItem } from '@directus/sdk/rest'

const route = useRoute()
const { $directus, $readItems, $readItem } = useNuxtApp()

const localteamUuid = route.params.localteam_uuid
const candidateUuid = route.params.candidate_uuid

const answers = ref({})
const existingAnswerIds = ref({}) // Store existing answer IDs by question ID
const submitting = ref(false)
const submitted = ref(false)

const ratingOptions = [
  { value: 0, label: 'stark dagegen', radioClass: 'border-rating-0 checked:bg-rating-0' },
  { value: 1, label: 'eher dagegen', radioClass: 'border-rating-1 checked:bg-rating-1' },
  { value: 2, label: 'neutral', radioClass: 'border-rating-na checked:bg-rating-na' },
  { value: 3, label: 'eher dafür', radioClass: 'border-rating-3 checked:bg-rating-3' },
  { value: 4, label: 'stark dafür', radioClass: 'border-rating-4 checked:bg-rating-4' },
]

const { data, pending, error } = await useAsyncData(`thesen-${localteamUuid}-${candidateUuid}`, async () => {
  try {
    const [localteam, candidate, questions] = await Promise.all([
      $directus.request($readItem('localteams', localteamUuid)).catch(() => null),
      $directus.request($readItem('candidate', candidateUuid)).catch(() => null),
      $directus.request($readItems('questions', {
        filter: {
          localteam: { _eq: localteamUuid },
          status: { _eq: 'published' }
        },
        sort: ['date_created']
      }))
    ])

    let existingAnswers = []
    if (questions && questions.length > 0) {
      existingAnswers = await $directus.request($readItems('answers', {
        filter: {
          candidate: { _eq: candidateUuid },
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
      existingAnswerIds.value[questionId] = ans.id
    })
  }
})

const localteam = computed(() => data.value?.localteam)
const candidate = computed(() => data.value?.candidate)
const questions = computed(() => data.value?.questions || [])

const isFormComplete = computed(() => {
  if (!questions.value || !questions.value.length) return false
  return questions.value.every(q => answers.value[q.id] !== undefined)
})

async function submitAnswers() {
  if (!isFormComplete.value || submitting.value) return

  submitting.value = true
  try {
    // Separate answers into those to create and those to update
    const operations = questions.value.map(q => {
      const payload = {
        question: q.id,
        candidate: candidateUuid,
        response: answers.value[q.id]
      }

      const existingId = existingAnswerIds.value[q.id]
      if (existingId) {
        return $directus.request(updateItem('answers', existingId, payload))
      } else {
        return $directus.request(createItem('answers', payload))
      }
    })

    await Promise.all(operations)

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
  background-color: currentColor;
}
</style>
