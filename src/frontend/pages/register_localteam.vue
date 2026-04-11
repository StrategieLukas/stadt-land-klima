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
        <!-- Step 1 -->
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
        <div class="flex-1 border-t-2" :class="selectedArea ? 'border-green' : 'border-gray-200'" />
        <!-- Step 2 -->
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
            :class="registrationSuccess ? 'bg-green text-white' : selectedArea ? 'bg-green text-white' : 'bg-gray-200 text-gray-400'"
          >
            <svg v-if="registrationSuccess" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>2</span>
          </div>
          <span class="text-sm font-medium" :class="registrationSuccess ? 'text-gray-400' : selectedArea ? 'text-gray-800' : 'text-gray-400'">
            Kontaktdaten
          </span>
        </div>
        <div class="flex-1 border-t-2" :class="registrationSuccess ? 'border-green' : 'border-gray-200'" />
        <!-- Step 3 -->
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
            :class="registrationSuccess ? 'bg-green text-white' : 'bg-gray-200 text-gray-400'"
          >
            <svg v-if="registrationSuccess" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>3</span>
          </div>
          <span class="text-sm font-medium" :class="registrationSuccess ? 'text-green font-semibold' : 'text-gray-400'">
            Durchstarten
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
              <!-- Loading spinner: wrapper handles positioning so transform-translate
                   is not clobbered by the animation's transform property -->
              <div v-if="isLoading" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4">
                <SlkFlowerSpinner :size="16" />
              </div>
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
              <SlkFlowerSpinner :size="32" />
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
        <!-- Case 1: Localteam exists AND rating is complete (≥98%) -->
        <div v-if="hasExistingTeam && existingPercentageRated != null && existingPercentageRated >= 98" class="rounded-sm shadow-list p-8 bg-white">
          <div class="flex items-start gap-4 mb-5">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 class="font-heading text-h2 font-bold text-gray-800 mb-1">Bewertung abgeschlossen</h2>
              <p class="text-sm text-gray-600">
                Das Lokalteam in <strong>{{ selectedArea.name }}</strong> hat die Bewertung abgeschlossen.
                Schau dir die Ergebnisse an oder nimm Kontakt auf, um das Team zu unterstützen.
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <NuxtLink
              v-if="existingSlug"
              :to="`/municipalities/${existingSlug}`"
              class="flex-1 text-center py-2.5 px-4 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 transition-colors"
            >
              Zur Bewertung →
            </NuxtLink>
            <NuxtLink
              :to="`/feedback?title=${encodeURIComponent('Mitarbeit Lokalteam ' + selectedArea.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + selectedArea.name + ' unterstützen.\n\nMeine Kontaktdaten:\n')}`"
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

        <!-- Case 2: Localteam exists but rating is still in progress -->
        <div v-else-if="hasExistingTeam" class="rounded-sm shadow-list p-8 bg-white">
          <div class="flex items-start gap-4 mb-5">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 class="font-heading text-h2 font-bold text-gray-800 mb-1">Lokalteam aktiv – Bewertung läuft</h2>
              <p class="text-sm text-gray-600">
                In <strong>{{ selectedArea.name }}</strong> ist bereits ein Lokalteam aktiv und arbeitet gerade an der Bewertung.
                Möchtest du das Team unterstützen?
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <NuxtLink
              :to="`/feedback?title=${encodeURIComponent('Lokalteam unterstützen in ' + selectedArea.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + selectedArea.name + ' bei der Bewertung unterstützen.\n\nMeine Kontaktdaten:\n')}`"
              class="flex-1 text-center py-2.5 px-4 bg-green text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 transition-colors"
            >
              Lokalteam unterstützen →
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
          :population="selectedArea.population ?? null"
          :state="selectedArea.state ?? null"
          :geolocation="areaGeoData?.geo_center ?? null"
          :can-change="!hasQueryParams"
          @change-municipality="resetSelection"
          @success="registrationSuccess = true"
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
const { public: { clientDirectusUrl, directusToken } } = useRuntimeConfig()

// --- Query-param pre-fill ---
const hasQueryParams = computed(() => !!route.query.ars)

// --- Selected area state ---
interface AreaInfo {
  name: string
  ars: string
  prefix?: string
  population?: number | null
  state?: string | null
}

const registrationSuccess = ref(false)
const selectedArea = ref<AreaInfo | null>(null)
const existingSlug = ref<string | null>(null)
const existingPercentageRated = ref<number | null>(null)
const hasExistingTeam = ref(false)
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
    state: area.state ?? null,
  }
  // Collect slugs from the stadtlandzahl search result — these are Directus municipality slugs
  // associated to this ARS. We must still check whether each one has a localteam_id.
  const existingSlugs: string[] = (area.stadtlandklimaDataAll ?? []).map((d: any) => d.slug).filter(Boolean)
  // Use known percentageRated from search result to avoid an extra API call
  const knownPercentageRated: number | null = area.stadtlandklimaDataAll?.[0]?.percentageRated ?? null
  const teamInfo = await checkExistingLocalteam(area.ars, existingSlugs, knownPercentageRated)
  existingSlug.value = teamInfo.slug
  existingPercentageRated.value = teamInfo.percentageRated
  hasExistingTeam.value = !!teamInfo.slug
  await fetchGeoData(area.ars)
}

function resetSelection() {
  selectedArea.value = null
  existingSlug.value = null
  existingPercentageRated.value = null
  hasExistingTeam.value = false
  areaGeoData.value = null
  focusedIndex.value = -1
  nextTick(() => searchInputRef.value?.focus())
}

async function checkExistingLocalteam(
  ars: string,
  slugs: string[] = [],
  knownPercentageRated?: number | null,
): Promise<{ slug: string | null; percentageRated: number | null }> {
  try {
    const authHeaders = directusToken ? { Authorization: `Bearer ${directusToken}` } : undefined
    let foundSlug: string | null = null

    // Prefer slug-based lookup: the createMunicipality flow creates records without ARS,
    // but always sets localteam_id. Checking by slug + localteam_id is reliable.
    if (slugs.length) {
      const result = await $fetch<{ data: Array<{ slug: string | null; localteam_id: string | null }> }>(
        `${clientDirectusUrl}/items/municipalities`,
        {
          params: {
            'filter[slug][_in]': slugs.join(','),
            'filter[localteam_id][_nnull]': true,
            'fields[]': ['slug', 'localteam_id'],
            limit: slugs.length,
          },
          headers: authHeaders,
        }
      )
      foundSlug = result.data?.find(m => m.localteam_id)?.slug ?? null
    }

    if (!foundSlug) {
      // Fallback: ARS-based lookup (works for municipalities updated by step 3 of registration)
      const result = await $fetch<{ data: Array<{ slug: string | null }> }>(
        `${clientDirectusUrl}/items/municipalities`,
        {
          params: {
            'filter[ars][_eq]': ars,
            'filter[localteam_id][_nnull]': true,
            'fields[]': 'slug',
            limit: 1,
          },
          headers: authHeaders,
        }
      )
      foundSlug = result.data?.[0]?.slug ?? null
    }

    if (!foundSlug) return { slug: null, percentageRated: null }

    // Resolve percentage_rated: use search-provided value if available, otherwise query scores
    if (knownPercentageRated != null) {
      return { slug: foundSlug, percentageRated: knownPercentageRated }
    }
    try {
      const scores = await $fetch<{ data: Array<{ percentage_rated: number | null }> }>(
        `${clientDirectusUrl}/items/municipality_scores`,
        {
          params: {
            'filter[municipality][slug][_eq]': foundSlug,
            'fields[]': 'percentage_rated',
            limit: 1,
            sort: '-percentage_rated',
          },
          headers: authHeaders,
        }
      )
      return { slug: foundSlug, percentageRated: scores.data?.[0]?.percentage_rated ?? null }
    } catch {
      return { slug: foundSlug, percentageRated: null }
    }
  } catch {
    return { slug: null, percentageRated: null }
  }
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
    // Enrich selectedArea with state/population from the full API response.
    // The search GraphQL query doesn't include these fields, so we fill them here.
    if (selectedArea.value && data) {
      if (!selectedArea.value.state && data.state) {
        selectedArea.value = { ...selectedArea.value, state: data.state }
      }
      if (!selectedArea.value.population && data.data_products?.population_data?.population) {
        selectedArea.value = { ...selectedArea.value, population: data.data_products.population_data.population }
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
  // Always verify against Directus — the URL param may be stale or missing
  const teamInfo = await checkExistingLocalteam(ars)
  if (teamInfo.slug) {
    existingSlug.value = teamInfo.slug
    existingPercentageRated.value = teamInfo.percentageRated
  }
  hasExistingTeam.value = !!existingSlug.value

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
          state: data.state ?? null,
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
