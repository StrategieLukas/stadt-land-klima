<template>
  <div class="min-h-screen bg-mild-white">
    <!-- Header -->
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
          <p class="text-sm text-mid-gray">Vergleichen Sie Ihre Positionen mit den Kandidaten</p>
        </div>
        <div class="w-10"></div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto px-4 py-12">
      <!-- Loading State -->
      <div v-if="pending && !error" class="flex justify-center items-center py-20">
        <div class="flex flex-col items-center gap-4">
          <SlkFlowerSpinner class="w-20 h-20 text-ff-green" />
          <p class="text-mid-gray">Lade verfügbare Wahlen...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red/10 border border-red text-red p-8 rounded-xl text-center my-12">
        <h2 class="text-2xl font-bold mb-4">Fehler beim Laden</h2>
        <p class="mb-4">{{ errorMessage }}</p>
        <button @click="loadElections" class="btn btn-primary">Erneut versuchen</button>
      </div>

      <!-- No Public Elections -->
      <div v-else-if="publicElections.length === 0" class="bg-orange/10 border border-orange text-orange-800 p-8 rounded-xl text-center my-12">
        <div class="mb-6">
          <img 
            src="~/assets/images/Stadt-Land-Klima-Blume.svg" 
            alt="Klimablume" 
            class="h-24 w-auto mx-auto opacity-60"
          >
        </div>
        <h2 class="text-2xl font-bold mb-4">Keine öffentlichen Wahlen verfügbar</h2>
        <p class="text-mid-gray">
          Derzeit gibt es keine öffentlich zugänglichen Wahlen im Klimawahlcheck. 
          Bitte kommen Sie später wieder oder wenden Sie sich an Ihr Lokales Team.
        </p>
      </div>

      <!-- Elections List -->
      <div v-else class="space-y-8">
        <!-- Hero Section -->
        <div class="bg-white p-8 rounded-xl shadow-list border border-gray/10 text-center">
          <div class="mb-6">
            <img 
              src="~/assets/images/Stadt-Land-Klima-Blume.svg" 
              alt="Klimablume" 
              class="h-24 w-auto mx-auto opacity-80"
            >
          </div>
          <h2 class="text-2xl font-bold text-stats-dark mb-4">
            Willkommen beim Klimawahlcheck
          </h2>
          <p class="text-lg text-mid-gray max-w-2xl mx-auto">
            Beantworten Sie Thesen zu Klimaschutz und Nachhaltigkeit und vergleichen Sie 
            Ihre Positionen mit denen der Kandidaten. Finden Sie heraus, welcher Kandidat 
            am besten zu Ihnen passt!
          </p>
        </div>

        <!-- Elections Grid -->
        <h3 class="text-xl font-bold text-stats-dark mb-6">
          Verfügbare Wahlen
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="election in publicElections" 
            :key="election.id" 
            :to="`/wahlcheck/${election.id}`"
            class="bg-white p-6 rounded-xl shadow-list border border-gray/10 hover:shadow-xl hover:border-ff-green/30 transition-all duration-300 group"
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                <h4 class="text-lg font-bold text-black group-hover:text-ff-green transition-colors">
                  {{ election.descriptor }}
                </h4>
                <p v-if="election.localteam" class="text-sm text-mid-gray mt-1">
                  {{ election.localteam.municipality_name || election.localteam.name }}
                </p>
              </div>
              <div class="flex-shrink-0 w-10 h-10 bg-ff-green/10 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-ff-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
            
            <div class="flex items-center gap-4 text-sm text-mid-gray">
              <div class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{{ election.candidateCount }} Kandidaten</span>
              </div>
              <div class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{{ election.questionCount }} Thesen</span>
              </div>
            </div>
            
            <div class="mt-4 pt-4 border-t border-gray/10 flex justify-between items-center">
              <span class="text-sm text-mid-gray">
                Erstellt: {{ formatDate(election.date_created) }}
              </span>
              <span class="text-xs font-medium text-ff-green bg-ff-green/10 px-2 py-1 rounded-full">
                Öffentlich
              </span>
            </div>
          </NuxtLink>
        </div>

        <!-- How it works section -->
        <div class="bg-ff-green/5 p-8 rounded-xl border border-ff-green/20 mt-12">
          <h3 class="text-lg font-bold text-stats-dark mb-6 text-center">
            Wie funktioniert der Klimawahlcheck?
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="text-center">
              <div class="w-12 h-12 bg-ff-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-2xl font-bold text-ff-green">1</span>
              </div>
              <h4 class="font-bold text-stats-dark mb-2">Thesen beantworten</h4>
              <p class="text-sm text-mid-gray">
                Bewerten Sie jede These auf einer Skala von "stark dagegen" bis "stark dafür".
              </p>
            </div>
            <div class="text-center">
              <div class="w-12 h-12 bg-ff-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-2xl font-bold text-ff-green">2</span>
              </div>
              <h4 class="font-bold text-stats-dark mb-2">Antworten prüfen</h4>
              <p class="text-sm text-mid-gray">
                Sehen Sie sich Ihre Antworten an und wählen Sie optional wichtige Thesen 
                für eine doppelte Gewichtung aus.
              </p>
            </div>
            <div class="text-center">
              <div class="w-12 h-12 bg-ff-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-2xl font-bold text-ff-green">3</span>
              </div>
              <h4 class="font-bold text-stats-dark mb-2">Ergebnisse anzeigen</h4>
              <p class="text-sm text-mid-gray">
                Sehen Sie, welche Kandidaten am besten zu Ihren Positionen passen 
                und vergleichen Sie die Übereinstimmungen.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-20">
      <TheFooterDesktop />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const { $directus, $readItems } = useNuxtApp()

const publicElections = ref([])
const pending = ref(true)
const error = ref(false)
const errorMessage = ref('')

// Format date
function formatDate(dateString) {
  if (!dateString) return 'Unbekannt'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

// Load all public elections
async function loadElections() {
  pending.value = true
  error.value = false
  errorMessage.value = ''

  try {
    // Load elections that are public
    const elections = await $directus.request($readItems('elections', {
      filter: { 
        is_public: { _eq: true }
      },
      sort: ['-date_created'],
      fields: ['*', 'localteam.*']
    }))

    if (!elections || elections.length === 0) {
      publicElections.value = []
      pending.value = false
      return
    }

    // For each election, count candidates and questions
    const electionsWithCounts = []
    for (const election of elections) {
      try {
        // Count candidates who have answered
        const candidates = await $directus.request($readItems('candidate', {
          filter: {
            election: { _eq: election.id },
            has_answered: { _eq: true }
          },
          limit: -1
        }))

        // Count published questions
        const questions = await $directus.request($readItems('questions', {
          filter: {
            election: { _eq: election.id },
            status: { _eq: 'published' }
          },
          limit: -1
        }))

        electionsWithCounts.push({
          ...election,
          candidateCount: candidates?.length || 0,
          questionCount: questions?.length || 0
        })
      } catch (err) {
        console.error(`Error loading data for election ${election.id}:`, err)
        // Still add the election with 0 counts
        electionsWithCounts.push({
          ...election,
          candidateCount: 0,
          questionCount: 0
        })
      }
    }

    publicElections.value = electionsWithCounts.filter(e => e.candidateCount > 0)

  } catch (err) {
    console.error('Error loading elections:', err)
    error.value = true
    errorMessage.value = 'Es ist ein Fehler beim Laden der Wahldaten aufgetreten. Bitte versuchen Sie es später erneut.'
  } finally {
    pending.value = false
  }
}

// Load data on mount
onMounted(() => {
  loadElections()
})

// Sort elections by date (newest first) or by candidate count
const sortedElections = computed(() => {
  return [...publicElections.value].sort((a, b) => {
    // Sort by date_created descending (newest first)
    return new Date(b.date_created) - new Date(a.date_created)
  })
})

useHead({
  title: 'Klimawahlcheck - Stadt.Land.Klima!',
  meta: [
    {
      name: 'description',
      content: 'Vergleichen Sie Ihre Positionen mit den Kandidaten im Klimawahlcheck von Stadt.Land.Klima!'
    }
  ]
})
</script>

<style scoped>
/* Custom animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Grid item animation */
.grid > * {
  animation: fadeIn 0.5s ease-out forwards;
}

.grid > *:nth-child(1) { animation-delay: 0.1s; }
.grid > *:nth-child(2) { animation-delay: 0.2s; }
.grid > *:nth-child(3) { animation-delay: 0.3s; }
.grid > *:nth-child(4) { animation-delay: 0.4s; }
.grid > *:nth-child(5) { animation-delay: 0.5s; }
.grid > *:nth-child(6) { animation-delay: 0.6s; }
</style>
