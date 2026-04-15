<template>
  <div v-if="loaded && nearbyAreas.length === 0" />

  <div v-else class="border-t border-b bg-gray-300 px-3 sm:px-4 lg:px-6 py-6 max-w-full overflow-hidden">
    <div class="mb-4">
      <h3 class="text-lg font-semibold text-gray-800 mb-2">
        {{ $t('administrative_areas.nearby_alternatives') }}
      </h3>
      <p class="text-sm text-gray-600">
        {{ $t('administrative_areas.nearby_alternatives_description') }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-8 gap-2">
      <SlkFlowerSpinner :size="32" />
      <span class="text-blue-600">{{ $t('generic.loading') }}...</span>
    </div>

    <!-- Carousel -->
    <div v-else-if="nearbyAreas.length > 0">
        <div
          class="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide"
          ref="scrollContainer"
          @scroll="updateShadows"
          :style="scrollMaskStyle"
        >
          <div
            v-for="area in nearbyAreas"
            :key="area.ars"
            class="flex-none w-64 sm:w-72 lg:w-80 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow max-w-full flex flex-col"
          >
            <!-- Mini map -->
            <div class="h-32 bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center relative">
              <LMap
                :ref="(el) => { if (el) nearbyMapRefs[area.ars] = el }"
                :zoom="10"
                :center="[area.geoCenter?.coordinates[1] || 51.1657, area.geoCenter?.coordinates[0] || 10.4515]"
                class="h-full w-full z-0"
                :options="{ zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false }"
                @ready="() => onNearbyMapReady(area.ars, area.geoArea)"
              >
                <LTileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <LGeoJson
                  v-if="area.geoArea"
                  :geojson="area.geoArea"
                  :options="{ style: { color: '#3B82F6', weight: 2, fillColor: '#3B82F6', fillOpacity: 0.3 } }"
                  @ready="() => onNearbyGeoJsonReady(area.ars, area.geoArea)"
                />
              </LMap>
            </div>

            <!-- Card body -->
            <div class="p-3 sm:p-4 flex flex-col flex-1 justify-between">
              <!-- Name row with score badge -->
              <div class="flex items-start justify-between gap-2 mb-3">
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {{ area.prefix }}
                  </p>
                  <h4 class="text-sm font-bold text-gray-900 leading-tight break-words">
                    {{ area.name }}
                  </h4>
                </div>
                <div class="flex-shrink-0">
                  <!-- Complete or published: show numeric score -->
                  <span
                    v-if="area.isPublished && area.scoreTotal != null"
                    class="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white"
                    :class="`bg-${scoreBgColor(area.scoreTotal)}`"
                  >
                    {{ Math.round(area.scoreTotal) }}%
                  </span>
                  <!-- Localteam exists but not yet published -->
                  <span v-else-if="area.ctaType === 'in-progress'" class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    Bewertung läuft
                  </span>
                  <!-- No localteam -->
                  <span v-else class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                    Nicht bewertet
                  </span>
                </div>
              </div>
              <!-- Links -->
              <div class="flex flex-col gap-1.5">
                <!-- Case: complete rating → show it -->
                <NuxtLink
                  v-if="area.ctaType === 'complete'"
                  :to="`/municipalities/${area.slug}?v=${catalogVersionName}`"
                  class="inline-flex items-center text-xs sm:text-sm font-medium text-[#AFCA0B] hover:text-lime-700"
                >
                  <svg class="w-3.5 h-3.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Bewertung anzeigen</span>
                </NuxtLink>
                <!-- Case: localteam active, rating in progress → support them -->
                <NuxtLink
                  v-else-if="area.ctaType === 'in-progress'"
                  :to="`/contact?title=${encodeURIComponent('Lokalteam unterstützen in ' + area.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + area.name + ' bei der Bewertung unterstützen.\n\nMeine Kontaktdaten:\n')}`"
                  class="inline-flex items-center text-xs sm:text-sm font-medium text-green hover:opacity-80"
                >
                  <svg class="w-3.5 h-3.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Lokalteam unterstützen</span>
                </NuxtLink>
                <!-- Case: no localteam → found one -->
                <NuxtLink
                  v-else
                  :to="`/register_localteam?ars=${area.ars}&name=${encodeURIComponent(area.name)}`"
                  class="inline-flex items-center text-xs sm:text-sm font-medium text-green hover:opacity-80"
                >
                  <svg class="w-3.5 h-3.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Lokalteam gründen</span>
                </NuxtLink>
                <!-- Statistiken (always shown) -->
                <NuxtLink
                  :to="`/stats/${area.ars}`"
                  class="inline-flex items-center text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  <svg class="w-3.5 h-3.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Statistiken anzeigen</span>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { getScorePercentageColor } from '~/shared/utils.js'

const { $directus, $readItems } = useNuxtApp()
const config = useRuntimeConfig()

const scoreBgColor = (scoreTotal) => getScorePercentageColor(scoreTotal)

const props = defineProps({
  ars: { type: String, required: true },
  catalogVersionId: { type: [String, Number], required: true },
  catalogVersionName: { type: String, required: true },
})

const nearbyAreas = ref([])
const loading = ref(false)
const loaded = ref(false)
const nearbyMapRefs = ref({})

const scrollContainer = ref(null)
const showLeftShadow = ref(false)
const showRightShadow = ref(true)

const scrollMaskStyle = computed(() => {
  const left = showLeftShadow.value
    ? 'transparent, black 32px'
    : 'black'
  const right = showRightShadow.value
    ? 'black calc(100% - 32px), transparent'
    : 'black'
  const gradient = `linear-gradient(to right, ${left}, ${right})`
  return {
    maskImage: gradient,
    WebkitMaskImage: gradient,
  }
})

const updateShadows = () => {
  if (!scrollContainer.value) return
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value
  showLeftShadow.value = scrollLeft > 0
  showRightShadow.value = scrollLeft < scrollWidth - clientWidth - 1
}

const fitBoundsToGeoArea = (ars, geoArea) => {
  const mapRef = nearbyMapRefs.value[ars]
  if (!geoArea || !mapRef?.leafletObject) return
  try {
    const leafletMap = mapRef.leafletObject
    const geoJsonLayer = L.geoJSON(geoArea)
    const bounds = geoJsonLayer.getBounds()
    if (bounds.isValid()) {
      leafletMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 })
    }
  } catch (err) {
    console.warn('Could not fit bounds for nearby map:', err)
  }
}

const onNearbyMapReady = (ars, geoArea) => {
  setTimeout(() => {
    const mapRef = nearbyMapRefs.value[ars]
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize()
      fitBoundsToGeoArea(ars, geoArea)
    }
  }, 100)
  setTimeout(() => {
    const mapRef = nearbyMapRefs.value[ars]
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize()
      fitBoundsToGeoArea(ars, geoArea)
    }
  }, 500)
}

const onNearbyGeoJsonReady = (ars, geoArea) => {
  nextTick(() => {
    const mapRef = nearbyMapRefs.value[ars]
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize()
      fitBoundsToGeoArea(ars, geoArea)
    }
  })
  setTimeout(() => {
    const mapRef = nearbyMapRefs.value[ars]
    if (mapRef?.leafletObject) {
      mapRef.leafletObject.invalidateSize()
      fitBoundsToGeoArea(ars, geoArea)
    }
  }, 300)
}

const fetchMunicipalityData = async (ars) => {
  try {
    const municipalities = await $directus.request($readItems('municipalities', {
      fields: ['id', 'slug', 'name', 'ars', 'status', 'localteam_id'],
      filter: { ars: { _eq: ars } },
      limit: 1,
    }))
    if (!municipalities?.length) return null
    const municipality = municipalities[0]

    const scores = await $directus.request($readItems('municipality_scores', {
      fields: ['*'],
      filter: {
        municipality: { _eq: municipality.id },
        catalog_version: { _eq: props.catalogVersionId },
      },
      limit: 1,
    }))
    return { municipality, score: scores?.[0] ?? null }
  } catch {
    return null
  }
}

onMounted(async () => {
  if (!props.ars) return
  loading.value = true
  try {
    const baseUrl = config.public.stadtlandzahlUrl?.replace('/graphql/', '').replace('/graphql', '') || 'http://localhost:8000'
    const res = await fetch(`${baseUrl}/api/areas/${props.ars}/bordering-municipalities/`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    if (data?.bordering_municipalities?.length) {
      const areas = await Promise.all(
        data.bordering_municipalities.map(async (area) => {
          const result = await fetchMunicipalityData(area.ars)
          const municipality = result?.municipality ?? null
          const score = result?.score ?? null
          const isPublished = municipality?.status === 'published' && !!municipality?.slug
          const hasLocalteam = !!(municipality?.localteam_id)
          const percentageRated = score?.percentage_rated ?? null
          // 'complete'    → published + percentage_rated >= 98 → show rating
          // 'in-progress' → has a localteam but not yet complete → support the team
          // 'none'        → no localteam at all → found a team
          const ctaType = isPublished && percentageRated != null && percentageRated >= 98
            ? 'complete'
            : hasLocalteam
              ? 'in-progress'
              : 'none'
          return {
            ars: area.ars,
            name: area.name,
            prefix: area.prefix,
            ctaType,
            isPublished,
            slug: isPublished ? municipality.slug : null,
            scoreTotal: score?.score_total ?? null,
            percentageRated,
            geoCenter: area.geo_center ?? null,
            geoArea: area.geo_area ?? null,
          }
        })
      )
      nearbyAreas.value = areas
    }
  } catch (err) {
    console.error('NearbyMunicipalitiesCarousel: failed to fetch nearby municipalities', err)
  } finally {
    loading.value = false
    loaded.value = true
    await nextTick()
    requestAnimationFrame(() => requestAnimationFrame(updateShadows))
  }
})
</script>
