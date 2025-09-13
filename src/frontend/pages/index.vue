<template>
  <div>
    <!-- Hero Section -->
    <section class="relative min-h-screen flex items-center justify-center overflow-hidden">
      <!-- Video Background -->
      <video
        autoplay
        muted
        loop
        playsinline
        class="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/media/istockphoto-918035744-640_adpp_is.mp4" type="video/mp4">
      </video>
      
      <!-- Overlay for better text readability -->
      <div class="absolute inset-0 bg-black bg-opacity-40 z-10"></div>
      
      <!-- Content -->
      <div class="relative z-20 text-center px-8 pt-24 lg:pt-32">
        <h1 class="text-6xl font-bold text-white mb-6 drop-shadow-lg">
          Komm, wir machen unsere<br>
          <span class="text-green-400">Kommunen klimaneutral!</span>
        </h1>
        <p class="text-2xl text-white max-w-4xl mx-auto drop-shadow-lg">
          Scroll nach unten und entdecke, wie du Teil der Bewegung werden kannst
        </p>
        <div class="mt-12 animate-bounce">
          <svg class="w-8 h-8 mx-auto text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
        </div>
      </div>
    </section>

    <!-- Scrollytelling Section -->
    <div class="relative">
      <!-- Sticky Graphic -->
      <div 
        class="graphic sticky top-0 h-screen flex items-center justify-center text-white transition-all duration-1000"
        :class="getBackgroundClass()"
      >
        <div class="text-center max-w-4xl px-8">
          <div v-if="activeStepId === 'kommunal-verantwortung'" class="animate-fade-in-up">
            <div class="text-8xl font-bold mb-4 animate-pulse">65%</div>
            <h2 class="text-5xl font-bold mb-6">der CO₂-Emissionen</h2>
            <p class="text-2xl opacity-90">liegen in kommunaler Verantwortung</p>
          </div>
          
          <div v-else-if="activeStepId === 'kommunale-aufgaben'" class="animate-fade-in-up">
            <h2 class="text-5xl font-bold mb-8">Kommunen gestalten unsere Zukunft</h2>
            <div class="grid grid-cols-2 gap-8 max-w-2xl mx-auto">
              <div class="bg-white/20 p-6 rounded-xl">
                <div class="text-4xl mb-3">🚌</div>
                <h3 class="text-xl font-semibold">ÖPNV</h3>
              </div>
              <div class="bg-white/20 p-6 rounded-xl">
                <div class="text-4xl mb-3">⚡</div>
                <h3 class="text-xl font-semibold">Energie</h3>
              </div>
              <div class="bg-white/20 p-6 rounded-xl">
                <div class="text-4xl mb-3">🏗️</div>
                <h3 class="text-xl font-semibold">Stadtplanung</h3>
              </div>
              <div class="bg-white/20 p-6 rounded-xl">
                <div class="text-4xl mb-3">🚨</div>
                <h3 class="text-xl font-semibold">Katastrophenschutz</h3>
              </div>
            </div>
          </div>
          
          <div v-else-if="activeStepId === 'leuchtturm-kommunen'" class="animate-fade-in-up">
            <div class="text-4xl mb-4">🏆</div>
            <h2 class="text-5xl font-bold mb-6">Leuchtturm-Kommunen</h2>
            <p class="text-2xl opacity-90">
              Wir machen erfolgreiche Kommunen sichtbar und fördern Best Practices
            </p>
          </div>
          
          <div v-else-if="activeStepId === 'konkrete-massnahmen'" class="animate-fade-in-up">
            <h2 class="text-5xl font-bold mb-8">Konkrete Maßnahmen statt Zahlen</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div class="bg-white/10 p-6 rounded-xl border-2 border-red-300/50">
                <div class="text-3xl mb-4">❌</div>
                <h3 class="text-2xl font-bold mb-4 text-red-200">459 CO₂e/Kopf</h3>
                <p class="text-sm opacity-75">Nicht politisch wirkmächtig</p>
              </div>
              <div class="bg-white/20 p-6 rounded-xl border-2 border-green-300/50">
                <div class="text-3xl mb-4">✅</div>
                <h3 class="text-2xl font-bold mb-4 text-green-200">Politische Maßnahmen</h3>
                <p class="text-sm opacity-90">Handfeste Handlungsoptionen</p>
              </div>
            </div>
          </div>
          
          <div v-else-if="activeStepId === 'beeindruckende-zahlen'" class="animate-fade-in-up">
            <h2 class="text-5xl font-bold mb-12">Unsere Erfolge in Zahlen</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              <div class="bg-white/20 p-8 rounded-xl">
                <div class="text-6xl font-bold mb-3 text-green-300">5</div>
                <h3 class="text-xl font-semibold">Bewertungsstufen</h3>
              </div>
              <div class="bg-white/20 p-8 rounded-xl">
                <div class="text-6xl font-bold mb-3 text-blue-300">39</div>
                <h3 class="text-xl font-semibold">Maßnahmen</h3>
              </div>
              <div class="bg-white/20 p-8 rounded-xl">
                <div class="text-6xl font-bold mb-3 text-purple-300">100+</div>
                <h3 class="text-xl font-semibold">Lokalteams</h3>
              </div>
              <div class="bg-white/20 p-8 rounded-xl">
                <div class="text-6xl font-bold mb-3 text-orange-300">2562</div>
                <h3 class="text-xl font-semibold">Bewertungen</h3>
              </div>
            </div>
          </div>
          
          <div v-else-if="activeStepId === 'mach-mit'" class="animate-fade-in-up">
            <h2 class="text-5xl font-bold mb-12">Mach mit!</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div class="bg-white/20 p-8 rounded-xl">
                <div class="text-5xl mb-6">✅</div>
                <h3 class="text-2xl font-bold mb-4 text-green-300">Checken</h3>
                <p class="text-lg">Bewerte Klimaschutzmaßnahmen</p>
              </div>
              <div class="bg-white/20 p-8 rounded-xl">
                <div class="text-5xl mb-6">💰</div>
                <h3 class="text-2xl font-bold mb-4 text-blue-300">Spenden</h3>
                <p class="text-lg">Unterstütze unsere Arbeit</p>
              </div>
              <div class="bg-white/20 p-8 rounded-xl">
                <div class="text-5xl mb-6">🚀</div>
                <h3 class="text-2xl font-bold mb-4 text-purple-300">Engagieren</h3>
                <p class="text-lg">Hilf ehrenamtlich mit</p>
              </div>
            </div>
          </div>
          
          <!-- Default state -->
          <div v-else class="animate-fade-in-up">
            <h2 class="text-5xl font-bold mb-6">Stadt.Land.Klima!</h2>
            <p class="text-2xl opacity-90">Scroll um die Geschichte zu entdecken</p>
          </div>
        </div>
      </div>

      <!-- Scrollama Steps -->
      <Scrollama
        :offset="0.5"
        @step-enter="stepEnterHandler"
        @step-exit="stepExitHandler"
        class="relative"
      >
          <!-- Step 1: Kommunale Verantwortung -->
          <div
            data-step-id="kommunal-verantwortung"
            class="step my-64 h-96 flex items-center justify-end pr-12"
          >
            <div class="max-w-lg bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-xl">
              <h2 class="text-3xl font-bold text-gray-800 mb-4">
                65% der Emissionen
              </h2>
              <p class="text-lg text-gray-600">
                liegen in der Hand von Kommunen. Sie sind der Schlüssel für wirksamen Klimaschutz vor Ort.
              </p>
            </div>
          </div>

          <!-- Step 2: Kommunale Aufgaben -->
          <div
            data-step-id="kommunale-aufgaben"
            class="step my-64 h-96 flex items-center justify-start pl-12"
          >
            <div class="max-w-lg bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-xl">
              <h2 class="text-3xl font-bold text-gray-800 mb-4">
                Kommunen gestalten
              </h2>
              <p class="text-lg text-gray-600 mb-4">
                ÖPNV, Energieversorgung, Stadtplanung, Katastrophenschutz - Kommunen entscheiden über eine lebenswerte Zukunft.
              </p>
            </div>
          </div>

          <!-- Step 3: Leuchtturm-Kommunen -->
          <div
            data-step-id="leuchtturm-kommunen"
            class="step my-64 h-96 flex items-center justify-end pr-12"
          >
            <div class="max-w-lg bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-xl">
              <h2 class="text-3xl font-bold text-gray-800 mb-4">
                Leuchtturm-Kommunen
              </h2>
              <p class="text-lg text-gray-600">
                Wir machen erfolgreiche Kommunen sichtbar und fördern den Austausch von Best Practices.
              </p>
            </div>
          </div>

          <!-- Step 4: Konkrete Maßnahmen -->
          <div
            data-step-id="konkrete-massnahmen"
            class="step my-64 h-96 flex items-center justify-start pl-12"
          >
            <div class="max-w-lg bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-xl">
              <h2 class="text-3xl font-bold text-gray-800 mb-4">
                Konkrete Maßnahmen
              </h2>
              <p class="text-lg text-gray-600">
                Keine abstrakten Zahlen, sondern handfeste politische Maßnahmen für mehr Klimaschutz.
              </p>
            </div>
          </div>

          <!-- Step 5: Beeindruckende Zahlen -->
          <div
            data-step-id="beeindruckende-zahlen"
            class="step my-64 h-96 flex items-center justify-center"
          >
            <div class="max-w-2xl bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-xl text-center">
              <h2 class="text-3xl font-bold text-gray-800 mb-6">
                Unsere Erfolge in Zahlen
              </h2>
              <p class="text-lg text-gray-600">
                5 Bewertungsstufen • 39 Maßnahmen • 100+ Lokalteams • 2562 Bewertungen
              </p>
            </div>
          </div>

          <!-- Step 6: Mach mit! -->
          <div
            data-step-id="mach-mit"
            class="step my-64 h-96 flex items-center justify-center"
          >
            <div class="max-w-2xl bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-xl text-center">
              <h2 class="text-4xl font-bold text-gray-800 mb-6">
                Mach mit!
              </h2>
              <p class="text-lg text-gray-600">
                Checken • Spenden • Engagieren
              </p>
            </div>
          </div>
        </Scrollama>
    </div>

    <!-- Final Call-to-Action Section -->
    <section class="min-h-screen bg-gradient-to-t from-green-100 to-white flex items-center">
      <div class="container mx-auto px-8">
        <div class="max-w-4xl mx-auto text-center">
          <h2 class="text-4xl font-bold text-gray-800 mb-8">
            Finde jetzt deine Kommune
          </h2>
          
          <div class="mb-12">
            <div class="relative max-w-md mx-auto">
              <input
                type="text"
                placeholder="Suche nach Ort..."
                class="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:outline-none"
                v-model="searchTerm"
              >
              <button class="absolute right-3 top-3 text-gray-400">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </button>
            </div>
            <div class="mt-4">
              <NuxtLink
                to="/municipalities"
                class="inline-block bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Alle Kommunen anzeigen
              </NuxtLink>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="bg-white p-6 rounded-xl shadow-lg">
              <h3 class="text-xl font-bold text-gray-800 mb-4">Kontakt</h3>
              <a
                href="mailto:info@stadt-land-klima.de"
                class="inline-block bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                info@stadt-land-klima.de
              </a>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-lg">
              <h3 class="text-xl font-bold text-gray-800 mb-4">Spenden</h3>
              <a
                href="https://spenden.twingle.de/together-for-future-e-v/stadt-land-klima/tw6613dcb5d0a0d/page"
                class="inline-block bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                target="_blank"
              >
                Jetzt spenden
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Fallback: Original CMS Content (Hidden) -->
    <section v-if="showOriginalContent" class="hidden">
      <article v-if="page" class="prose py-8" v-html="page.contents" />
    </section>
  </div>
</template>

<script setup>
import Scrollama from '~/components/Scrollama.vue'

// Remove dependencies that cause issues
const { $directus, $readItems } = useNuxtApp();

// Data
const activeStepId = ref(null)
const searchTerm = ref('')

// Load original CMS content (simplified, no translations)
const { data: indexPages } = await useAsyncData("indexPages", () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: "index" } },
      limit: 1,
    }),
  );
});

// Methods
const stepEnterHandler = ({ element, direction, index }) => {
  console.log("step-enter", { element, direction, index });
  const stepId = element.dataset.stepId;
  if (stepId) {
    activeStepId.value = stepId;
  }
}

const stepExitHandler = ({ element, direction, index }) => {
  console.log("step-exit", { element, direction, index });
  // Keep the last active step instead of clearing it
}

const getBackgroundClass = () => {
  const backgrounds = {
    'kommunal-verantwortung': 'bg-gradient-to-br from-green-400 to-blue-500',
    'kommunale-aufgaben': 'bg-gradient-to-br from-blue-400 to-purple-500',
    'leuchtturm-kommunen': 'bg-gradient-to-br from-purple-400 to-pink-500',
    'konkrete-massnahmen': 'bg-gradient-to-br from-pink-400 to-red-500',
    'beeindruckende-zahlen': 'bg-gradient-to-br from-orange-400 to-yellow-500',
    'mach-mit': 'bg-gradient-to-br from-green-400 to-teal-500'
  }
  return backgrounds[activeStepId.value] || 'bg-gradient-to-br from-green-400 to-blue-500'
}

//MetaTags
const title = ref('Stadt.Land.Klima! - Kommunaler Klimaschutz')

useHead({
  title,
  meta: [
    {
      name: 'description',
      content: 'Wir vergleichen Klimaschutz in deutschen Kommunen und machen sie klimaneutral bis 2035. Mach mit!'
    }
  ]
});
</script>
