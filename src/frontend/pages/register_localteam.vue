<template>
  <div class="px-4 py-8 max-w-3xl mx-auto">
    <NuxtLink to="/municipalities" class="font-heading text-h4 text-light-blue">
      ← Zurück zu den Kommunen
    </NuxtLink>

    <div class="mt-6">
      <h1 class="font-heading text-h1 font-bold text-green mb-2">Lokalteam gründen</h1>
      <p class="text-gray-600 mb-6">
        Starte jetzt ein Lokalteam in deiner Kommune und treibe aktiven Klimaschutz vor Ort voran.
      </p>

      <!-- Step indicator -->
      <div class="flex items-center gap-3 mb-6 select-none">
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
            :class="selectedArea ? 'bg-green text-white' : 'bg-green text-white'"
          >
            <svg v-if="selectedArea" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>1</span>
          </div>
          <span class="text-sm font-medium" :class="selectedArea ? 'text-gray-400' : 'text-gray-800'">
            Kommune wählen
          </span>
        </div>
        <div class="flex-1 h-px" :class="selectedArea ? 'bg-green' : 'bg-gray-200'" />
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
            :class="selectedArea ? 'bg-green text-white' : 'bg-gray-200 text-gray-400'"
          >
            2
          </div>
          <span class="text-sm font-medium" :class="selectedArea ? 'text-gray-800' : 'text-gray-400'">
            Kontaktdaten
          </span>
        </div>
      </div>

      <!-- Step 1: No municipality selected yet → show search -->
      <div v-if="!selectedArea">
        <div class="rounded-sm shadow-list bg-white p-8">
          <h2 class="font-heading text-h2 font-bold text-green mb-1">Deine Kommune wählen</h2>
          <p class="text-sm text-gray-500 mb-5">
            Suche nach deiner Gemeinde oder Stadt, um mit der Registrierung zu beginnen.
          </p>

          <!-- Search input -->
          <div class="relative">
            <label for="municipality-search" class="block text-sm font-medium text-gray-700 mb-1">
              Gemeinde / Stadt suchen
            </label>
            <div class="relative">
              <input
                id="municipality-search"
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                autocomplete="off"
                placeholder="z.B. München, Freiburg, Potsdam …"
                class="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
                @input="onSearchInput"
                @keydown.down.prevent="moveFocus(1)"
                @keydown.up.prevent="moveFocus(-1)"
                @keydown.enter.prevent="selectFocused"
                @keydown.escape="clearSearch"
              />
              <!-- Search icon -->
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
              </svg>
              <!-- Loading spinner -->
              <svg v-if="isLoading" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>

            <!-- Results dropdown -->
            <ul
              v-if="searchResults.length && searchQuery.trim()"
              class="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto z-50"
            >
              <li
                v-for="(area, index) in searchResults"
                :key="area.ars"
                class="px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                :class="{ 'bg-rating-3-light': index === focusedIndex }"
                @click="selectArea(area)"
              >
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ area.prefix }}</div>
                    <div class="text-sm font-semibold text-gray-900">{{ area.name }}</div>
                  </div>
                  <div v-if="area.population" class="text-xs text-gray-400 whitespace-nowrap">
                    {{ area.population.toLocaleString() }} Einw.
                  </div>
                </div>
              </li>
            </ul>

            <!-- No results -->
            <div
              v-else-if="!isLoading && searchQuery.trim().length >= 2 && searchResults.length === 0"
              class="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg px-4 py-3 z-50"
            >
              <p class="text-sm text-gray-500 italic">Keine Ergebnisse für „{{ searchQuery }}"</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Municipality selected → mini-map + form or already-exists notice -->
      <div v-else class="space-y-6">

        <!-- Mini-map for geolocation validation -->
        <div class="rounded-sm shadow-list overflow-hidden">
          <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <svg class="w-4 h-4 text-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="text-sm font-medium text-gray-700">
              Ausgewählte Kommune:
              <strong class="text-green">{{ selectedArea.name }}</strong>
              <span v-if="selectedArea.prefix" class="text-gray-500 font-normal"> ({{ selectedArea.prefix }})</span>
            </span>
          </div>

          <!-- Map -->
          <ClientOnly>
            <div v-if="areaGeoData" class="h-56">
              <AdministrativeAreaMap
                :geo-center="areaGeoData.geo_center"
                :geo-area="areaGeoData.geo_area"
                :administrative-area-name="selectedArea.name"
              />
            </div>
            <div v-else-if="geoLoading" class="h-56 bg-gray-100 flex items-center justify-center">
              <svg class="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div v-else class="h-24 bg-gray-100 flex items-center justify-center">
              <span class="text-sm text-gray-400 italic">Kartenansicht nicht verfügbar</span>
            </div>
          </ClientOnly>

          <!-- Bottom bar: verify -->
          <div class="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-1.5 text-sm text-gray-500">
            <svg class="w-4 h-4 text-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            Bitte überprüfe, ob das die richtige Kommune ist.
          </div>
        </div>

        <!-- Already has a local team → contact prompt -->
        <div v-if="existingSlug" class="rounded-sm shadow-list p-8 bg-white">
          <div class="flex items-start gap-4 mb-5">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 class="font-heading text-h2 font-bold text-gray-800 mb-1">Diese Kommune hat bereits ein Lokalteam</h2>
              <p class="text-sm text-gray-600">
                In <strong>{{ selectedArea.name }}</strong> gibt es bereits ein aktives Lokalteam.
                Du kannst die bestehende Bewertung einsehen oder direkt Kontakt aufnehmen, um mitzumachen.
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <NuxtLink
              :to="`/municipalities/${existingSlug}`"
              class="flex-1 text-center py-2.5 px-4 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 transition-colors"
            >
              Zur Bewertung →
            </NuxtLink>
            <NuxtLink
              :to="`/feedback?title=${encodeURIComponent('Mitarbeit Lokalteam ' + selectedArea.name)}&content=${encodeURIComponent('Ich möchte beim bestehenden Lokalteam in ' + selectedArea.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
              class="flex-1 text-center py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors"
            >
              Kontakt aufnehmen
            </NuxtLink>
          </div>
          <button
            v-if="!hasQueryParams"
            type="button"
            class="mt-4 text-sm text-light-blue hover:underline block"
            @click="resetSelection"
          >
            Andere Kommune wählen
          </button>
        </div>

        <!-- Registration form -->
        <RegisterMunicipalityForm
          v-else
          :municipality-name="selectedArea.name"
          :ars="selectedArea.ars"
          :can-change="!hasQueryParams"
          @change-municipality="resetSelection"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAdministrativeAreaSearch } from '~/composables/useAdministrativeAreaSearch.js'

const route = useRoute()
const { $stadtlandzahlAPI } = useNuxtApp()

// --- Query-param pre-fill ---
const hasQueryParams = computed(() => !!route.query.ars)

// --- Selected area state ---
interface AreaInfo {
  name: string
  ars: string
  prefix?: string
  population?: number | null
}

const selectedArea = ref<AreaInfo | null>(null)
const existingSlug = ref<string | null>(null)
const areaGeoData = ref<{ geo_center: any; geo_area: any } | null>(null)
const geoLoading = ref(false)

// --- Search ---
const { query: searchQuery, results: searchResults, isLoading, search, clear } = useAdministrativeAreaSearch()
const searchInputRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(-1)

function onSearchInput(e: Event) {
  focusedIndex.value = -1
  search((e.target as HTMLInputElement).value)
}

function moveFocus(delta: number) {
  const len = searchResults.value.length
  if (!len) return
  focusedIndex.value = (focusedIndex.value + delta + len) % len
}

function selectFocused() {
  if (focusedIndex.value >= 0 && searchResults.value[focusedIndex.value]) {
    selectArea(searchResults.value[focusedIndex.value])
  }
}

function clearSearch() {
  clear()
  focusedIndex.value = -1
}

async function selectArea(area: any) {
  clear()
  selectedArea.value = {
    name: area.name,
    ars: area.ars,
    prefix: area.prefix ?? undefined,
    population: area.population ?? null,
  }
  // Check if area already has a local team via search result data
  const existing = area.stadtlandklimaDataAll?.[0]
  existingSlug.value = existing?.slug ?? null
  await fetchGeoData(area.ars)
}

function resetSelection() {
  selectedArea.value = null
  existingSlug.value = null
  areaGeoData.value = null
  focusedIndex.value = -1
  nextTick(() => searchInputRef.value?.focus())
}

async function fetchGeoData(ars: string) {
  if (!$stadtlandzahlAPI) return
  geoLoading.value = true
  try {
    const data = await $stadtlandzahlAPI.fetchStatsByARS(ars)
    if (data?.geo_center || data?.geo_area) {
      areaGeoData.value = {
        geo_center: data.geo_center ?? null,
        geo_area: data.geo_area ?? null,
      }
    }
  } catch {
    // geo data optional — form still works without it
  } finally {
    geoLoading.value = false
  }
}

// --- On mount: if ARS given in URL, resolve area info ---
onMounted(async () => {
  const ars = route.query.ars as string | undefined
  const name = route.query.name as string | undefined
  const slug = route.query.slug as string | undefined
  if (!ars) return

  // Show immediately with name from query param, then enrich with API data
  selectedArea.value = { name: name ?? ars, ars }
  // If the detail page already knows there's a slug (has a localteam), set it
  existingSlug.value = slug ?? null

  if ($stadtlandzahlAPI) {
    geoLoading.value = true
    try {
      const data = await $stadtlandzahlAPI.fetchStatsByARS(ars)
      if (data?.name) {
        selectedArea.value = {
          name: data.name,
          ars: data.ars ?? ars,
          prefix: data.prefix ?? undefined,
          population: data.data_products?.population_data?.population ?? null,
        }
      }
      if (data?.geo_center || data?.geo_area) {
        areaGeoData.value = {
          geo_center: data.geo_center ?? null,
          geo_area: data.geo_area ?? null,
        }
      }
    } catch {
      // keep name from query param
    } finally {
      geoLoading.value = false
    }
  }
})

// Meta
useHead({ title: 'Lokalteam gründen' })
</script>
