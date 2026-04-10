<template>
  <div v-if="loaded && nearbyAreas.length === 0" />

  <div v-else class="border-t border-b bg-blue-50 px-3 sm:px-4 lg:px-6 py-6 max-w-full overflow-hidden">
    <div class="mb-4">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">
        {{ $t('administrative_areas.nearby_alternatives') }}
      </h3>
      <p class="text-sm text-blue-700">
        {{ $t('administrative_areas.nearby_alternatives_description') }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-blue-600">{{ $t('generic.loading') }}...</span>
    </div>

    <!-- Carousel -->
    <div v-else-if="nearbyAreas.length > 0" class="relative">
      <div class="carousel-container relative" ref="carouselContainer">
        <!-- Left shadow -->
        <div
          class="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-blue-50 to-transparent z-10 pointer-events-none transition-opacity duration-300"
          :class="{ 'opacity-0': !showLeftShadow }"
        ></div>
        <!-- Right shadow -->
        <div
          class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-blue-50 to-transparent z-10 pointer-events-none transition-opacity duration-300"
          :class="{ 'opacity-0': !showRightShadow }"
        ></div>

        <div
          class="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide"
          ref="scrollContainer"
          @scroll="updateShadows"
        >
          <div
            v-for="area in nearbyAreas"
            :key="area.ars"
            class="flex-none w-64 sm:w-72 lg:w-80 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow max-w-full"
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
            <div class="p-3 sm:p-4">
              <div class="mb-3">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {{ area.prefix }}
                </p>
                <h4 class="text-sm font-bold text-gray-900 leading-tight break-words">
                  {{ area.name }}
                </h4>
              </div>
              <NuxtLink
                :to="area.hasRating
                  ? `/municipalities/${area.slug}?v=${catalogVersionName}`
                  : `/municipalities/${area.ars}`"
                class="inline-flex items-center text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <span class="truncate">{{ area.hasRating ? $t('stats.view_ranking') : $t('stats.view_stats') }}</span>
                <svg class="w-4 h-4 ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { $directus, $readItems } = useNuxtApp()
const config = useRuntimeConfig()

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
const carouselContainer = ref(null)
const showLeftShadow = ref(false)
const showRightShadow = ref(true)

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

const fetchMunicipalityScore = async (ars) => {
  try {
    const municipalities = await $directus.request($readItems('municipalities', {
      fields: ['id', 'slug', 'name', 'ars', 'status'],
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
    if (!scores?.length) return null
    return { ...scores[0], municipality }
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
          const score = await fetchMunicipalityScore(area.ars)
          return {
            ars: area.ars,
            name: area.name,
            prefix: area.prefix,
            hasRating: !!(score?.municipality?.slug && score.percentage_rated > 0),
            slug: score?.municipality?.slug ?? null,
            geoCenter: area.geo_center ?? null,
            geoArea: area.geo_area ?? null,
          }
        })
      )
      nearbyAreas.value = areas
      await nextTick()
      updateShadows()
    }
  } catch (err) {
    console.error('NearbyMunicipalitiesCarousel: failed to fetch nearby municipalities', err)
  } finally {
    loading.value = false
    loaded.value = true
  }
})
</script>
