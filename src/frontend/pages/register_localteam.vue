<template>
  <div class="px-2 xs:px-4 py-8 max-w-3xl mx-auto">
    <NuxtLink to="/municipalities" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipalities.back_to_overview") }}
    </NuxtLink>

    <div class="mt-6">
      <h1 class="font-heading text-h1 font-bold text-green mb-2">{{ $t("localteam.create") }}</h1>
      <p class="text-gray-600 mb-6">
        {{ $t("localteam.register.intro") }}
      </p>

      <!-- Step indicator -->
      <div class="flex items-center gap-2 xs:gap-3 mb-6 select-none">
        <!-- Step 1 -->
        <div class="flex items-center gap-1.5 xs:gap-2">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
            :class="selectedArea ? 'bg-green text-white' : 'bg-green text-white'"
          >
            <svg v-if="selectedArea" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>1</span>
          </div>
          <span class="hidden xs:inline text-sm font-medium" :class="selectedArea ? 'text-gray-400' : 'text-gray-800'">
            {{ $t("localteam.register.step.select_municipality") }}
          </span>
        </div>
        <div class="flex-1 border-t-2" :class="selectedArea ? 'border-green' : 'border-gray-200'" />
        <!-- Step 2 -->
        <div class="flex items-center gap-1.5 xs:gap-2">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
            :class="registrationSuccess ? 'bg-green text-white' : selectedArea ? 'bg-green text-white' : 'bg-gray-200 text-gray-400'"
          >
            <svg v-if="registrationSuccess" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>2</span>
          </div>
          <span class="hidden xs:inline text-sm font-medium" :class="registrationSuccess ? 'text-gray-400' : selectedArea ? 'text-gray-800' : 'text-gray-400'">
            {{ $t("localteam.register.step.contact_details") }}
          </span>
        </div>
        <div class="flex-1 border-t-2" :class="registrationSuccess ? 'border-green' : 'border-gray-200'" />
        <!-- Step 3 -->
        <div class="flex items-center gap-1.5 xs:gap-2">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
            :class="registrationSuccess ? 'bg-green text-white' : 'bg-gray-200 text-gray-400'"
          >
            <svg v-if="registrationSuccess" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>3</span>
          </div>
          <span class="hidden xs:inline text-sm font-medium" :class="registrationSuccess ? 'text-green font-semibold' : 'text-gray-400'">
            {{ $t("localteam.register.step.get_started") }}
          </span>
        </div>
      </div>

      <!-- Step 1: No municipality selected yet → show search -->
      <div v-if="!selectedArea">
        <div class="rounded-sm shadow-list bg-white p-4 sm:p-8">
          <h2 class="font-heading text-h2 font-bold text-green mb-1">{{ $t("localteam.register.select.title") }}</h2>
          <p class="text-sm text-gray-500 mb-5">
            {{ $t("localteam.register.select.description") }}
          </p>
          <AdministrativeAreaSearchBar
            ref="searchBarRef"
            reasonable-munips-to-rate="include"
            :route-builder="handleAreaSelect"
          />
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
              {{ $t("localteam.register.selected_municipality") }}:
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
              <span class="text-sm text-gray-400 italic">{{ $t("map.not_available") }}</span>
            </div>
          </ClientOnly>

          <!-- Bottom bar: verify -->
          <div class="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-1.5 text-sm text-gray-500">
            <svg class="w-4 h-4 text-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            {{ $t("localteam.register.verify_municipality") }}
          </div>
        </div>

        <!-- Already has a local team → contact prompt -->
        <!-- Case 1: Localteam exists AND rating is complete (≥98%) -->
        <div v-if="hasExistingTeam && existingPercentageRated != null && existingPercentageRated >= 98" class="rounded-sm shadow-list p-4 sm:p-8 bg-white">
          <div class="flex items-start gap-3 sm:gap-4 mb-5">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 class="font-heading text-h2 font-bold text-gray-800 mb-1">{{ $t("rating.completed") }}</h2>
              <p class="text-sm text-gray-600">
                <span v-html="$t('localteam.register.completed.body', { ':name': selectedArea.name })"></span>
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <CanonicalButton
              v-if="existingSlug"
              :href="`/municipalities/${existingSlug}`"
              :label="$t('rating.view')"
              icon-slug="icon_login_arrow"
              color="green"
              class="flex-1"
            />
            <CanonicalButton
              :href="`/contact?title=${encodeURIComponent($t('localteam.support.contact_title', { ':name': selectedArea.name }))}&type=cooperation&content=${encodeURIComponent($t('localteam.support.contact_content', { ':name': selectedArea.name }))}`"
              :label="$t('generic.contact')"
              icon-slug="icon_login_arrow"
              color="blue"
              class="flex-1"
            />
          </div>
          <button
            v-if="!hasQueryParams"
            type="button"
            class="mt-4 text-sm text-light-blue hover:underline block"
            @click="resetSelection"
          >
            {{ $t("localteam.register.select_other_municipality") }}
          </button>
        </div>

        <!-- Case 2: Localteam exists but rating is still in progress -->
        <div v-else-if="hasExistingTeam" class="rounded-sm shadow-list p-4 sm:p-8 bg-white">
          <div class="flex items-start gap-3 sm:gap-4 mb-5">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 class="font-heading text-h2 font-bold text-gray-800 mb-1">{{ $t("localteam.active_rating_in_progress") }}</h2>
              <p class="text-sm text-gray-600">
                <span v-html="$t('localteam.register.in_progress.body', { ':name': selectedArea.name })"></span>
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <CanonicalButton
              :href="`/contact?title=${encodeURIComponent($t('localteam.contact_title', { ':name': selectedArea.name }))}&type=cooperation&content=${encodeURIComponent($t('localteam.contact_content', { ':name': selectedArea.name }))}`"
              :label="$t('generic.contact')"
              icon-slug="icon_login_arrow"
              color="blue"
              class="flex-1"
            />
          </div>
          <button
            v-if="!hasQueryParams"
            type="button"
            class="mt-4 text-sm text-light-blue hover:underline block"
            @click="resetSelection"
          >
            {{ $t("localteam.register.select_other_municipality") }}
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
import { ref, computed, onMounted, watch } from 'vue'

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

const searchBarRef = ref<{ focus: () => void } | null>(null)

function handleAreaSelect(area: any): null {
  selectArea(area)
  return null
}

async function selectArea(area: any) {
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
  nextTick(() => searchBarRef.value?.focus())
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

// --- Initialise from ARS query param ---
async function initFromQueryParams(ars: string, name?: string, slug?: string) {
  // Reset state before loading new area
  selectedArea.value = { name: name ?? ars, ars }
  existingSlug.value = slug ?? null
  existingPercentageRated.value = null
  hasExistingTeam.value = false
  areaGeoData.value = null

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
}

onMounted(() => {
  const ars = route.query.ars as string | undefined
  if (ars) initFromQueryParams(ars, route.query.name as string | undefined, route.query.slug as string | undefined)
})

watch(
  () => route.query.ars,
  (ars) => {
    if (ars) {
      initFromQueryParams(ars as string, route.query.name as string | undefined, route.query.slug as string | undefined)
    } else {
      resetSelection()
    }
  },
)

// Meta
useHead({ title: $t('localteam.create') })
</script>
