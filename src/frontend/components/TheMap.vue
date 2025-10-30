<template>
  <div class="top-4 left-4 bg-white rounded shadow p-2 z-[1000]">
    <label class="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" v-model="showMunicipalitiesWithUnfinishedRating" class="toggle toggle-sm" />
      {{ $t('map.showUnfinishedRatings') }}
    </label>
  </div>

  <ClientOnly>
    <div class="w-full h-[75svh] z-0">
      <LMap
        v-if="clientReady"
        :zoom="6"
        :center="[51.1657, 10.4515]"
        style="height: 100%; width: 100%"
        @ready="onMapReady"
        ref="mapRef"
        class="z-10000"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        />

        <!-- Germany border -->
        <LGeoJson :geojson="germanyPolygon" :options="germanyStyle" />

        <!-- State borders -->
        <LGeoJson :geojson="statePolygons" :options="stateStyle" />

        <!-- Global grey mask -->
        <LRectangle
          :bounds="[[-90, -180], [90, 180]]"
          :path-options="maskStyle"
        />

        <!-- Germany cover to reveal map underneath -->
        <LGeoJson :geojson="germanyPolygon" :options="germanyCoverStyle" />

        <!-- Municipality markers -->
        <LMarker
          v-for="s in filteredMunicipalityScores"
          :key="s.municipality.slug"
          :lat-lng="[s.municipality.lat, s.municipality.lon]"
          :icon="getCustomIcon(s)"
        >
          <LPopup>
            <div class="text-sm space-y-1">
              <div class="font-semibold">{{ s.municipality.name }}</div>
              <template v-if="s.municipality.status === 'published' && s.percentage_rated > 98">
                <div>Score: {{ Number(s.score_total).toFixed(2) }}</div>
                <NuxtLink :to="`/municipalities/${s.municipality.slug}`" class="text-blue-600 underline hover:text-blue-800">
                  {{ $t("map.icon.popup.goToRanking") }}
                </NuxtLink>
              </template>
              <template v-else>
                <div>{{ $t("map.icon.popup.ratingNotFinished") }}</div>
                <div>
                  {{ $t("map.icon.popup.percentageRated", { ":percentage_rated": s.percentage_rated }) }}
                </div>
              </template>
            </div>
          </LPopup>
        </LMarker>
      </LMap>
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { LMap, LTileLayer, LMarker, LPopup, LGeoJson, LRectangle } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import germanyGeoJson from '~/assets/germany-polygon.json?raw'
import germanyStatesGeoJson from '~/assets/germany-state-borders.json?raw'

const { $t } = useNuxtApp()

const props = defineProps({
  municipalityScores: { type: Array, default: () => [] },
  catalogVersion: { required: true}
})

const showMunicipalitiesWithUnfinishedRating = ref(false)
const clientReady = ref(false)
const leaflet = ref(null)
let DivIcon = null
let mapInstance = null
let legendControl = null
const PinSvg = ref("")

const germanyPolygon = JSON.parse(germanyGeoJson)
const statePolygons = JSON.parse(germanyStatesGeoJson)

const germanyStyle = {
  color: '#1E3A8A',
  weight: 2,
  fillOpacity: 0      // no fill
}

const stateStyle = {
  color: '#1E40AF',
  weight: 1,
  fillOpacity: 0      // no fill
}

const maskStyle = {
  fillColor: '#808080',
  fillOpacity: 0.1,
  weight: 0,
  interactive: false
}

const germanyCoverStyle = {
  fillColor: '#FFFFFF',
  fillOpacity: 0.3,
  weight: 0,
  interactive: false
}

const filteredMunicipalityScores = computed(() => {
  if (!props.municipalityScores || !Array.isArray(props.municipalityScores)) {
    return []
  }

  return props.municipalityScores
    .map(s => {
      const coords = s.municipality.geolocation?.coordinates
      // Inject lat/lon fields into municipality
      const mun = {
        ...s.municipality,
        lat: typeof coords?.[1] === 'number' ? coords[1] : null,
        lon: typeof coords?.[0] === 'number' ? coords[0] : null
      }
      // Return new scores object with the municipality's scores added
      return {
        ...s,
        municipality: mun
      }
    })
    .filter(s => typeof s.municipality.lat === 'number' && typeof s.municipality.lon === 'number')
    .filter(s => shouldShow(s))
})


onMounted(async () => {
  leaflet.value = await import('leaflet')
  DivIcon = leaflet.value.DivIcon
  PinSvg.value = (await import('~/assets/images/Pin.svg?raw')).default
  clientReady.value = true
})

watch([showMunicipalitiesWithUnfinishedRating, filteredMunicipalityScores], () => {
  if (mapInstance) {
    if (legendControl) mapInstance.removeControl(legendControl)
    addLegend(mapInstance)
  }
})

function shouldShow(municipalityScore) {
  return showMunicipalitiesWithUnfinishedRating.value ? municipalityScore.percentage_rated > 0 : (municipalityScore.municipality.status === "published" && municipalityScore.percentage_rated > 98);
}

function onMapReady(map) {
  mapInstance = map
  addLegend(map)
}

function addLegend(map) {
  if (!leaflet.value) return
  const L = leaflet.value
  legendControl = L.control({ position: 'topright' })
  legendControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'bg-white rounded-lg shadow-lg p-3 m-2 space-y-1 text-sm')
    const lines = [
      ['text-rating-4', 'Score 80-100%'],
      ['text-rating-3', 'Score 60-79%'],
      ['text-rating-2', 'Score 40-59%'],
      ['text-rating-1', 'Score 20-39%'],
      ['text-rating-0', 'Score 0-19%'],
      ['text-rating-na', $t('map.icon.popup.ratingNotFinished.short'), !showMunicipalitiesWithUnfinishedRating.value]
    ]
    div.innerHTML = lines.map(([cls, text, hidden]) => {
      const style = hidden ? 'height:0; overflow:hidden; margin:0; padding:0;' : ''
      return `<div class="flex items-center gap-2 ${cls}" style="${style}">
        <div class="w-4 h-4">${PinSvg.value}</div>
        <span>${text}</span>
      </div>`
    }).join('')
    return div
  }
  legendControl.addTo(map)
}

function getCustomIcon(municipalityScore) {
  if (!DivIcon || !PinSvg.value) return null
  const score_total = municipalityScore.score_total;
  let cssClass = "rating-na"
  if (municipalityScore.municipality.status === "published" && municipalityScore.percentage_rated > 98) {
    if (score_total < 20) cssClass = "rating-0"
    else if (score_total < 40) cssClass = "rating-1"
    else if (score_total < 60) cssClass = "rating-2"
    else if (score_total < 80) cssClass = "rating-3"
    else cssClass = "rating-4"
  }
  return new DivIcon({
    className: "",
    html: `<div class="text-${cssClass} w-8 h-8">${PinSvg.value}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  })
}
</script>
