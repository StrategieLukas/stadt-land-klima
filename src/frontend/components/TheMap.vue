<template>
  <div class="top-4 left-4 bg-white rounded shadow p-2 z-[1000]">
    <label class="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" v-model="showMunicipalitiesWithUnfinishedRating" class="toggle toggle-sm" />
      {{ $t('map.showUnfinishedRatings') }}
    </label>
  </div>

  <ClientOnly>
    <div class="w-full h-screen z-0">
      <LMap
        v-if="clientReady"
        :zoom="6"
        :center="[51.1657, 10.4515]"
        style="height: 100%; width: 100%"
        @ready="onMapReady"
        ref="mapRef"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        />

        <!-- Germany border -->
        <LGeoJson :geojson="germanyPolygon" :options="germanyStyle" />

        <!-- State borders -->
        <LGeoJson :geojson="statePolygons" :options="stateStyle" />

        <LRectangle
        :bounds="[[-90, -180], [90, 180]]"
        :path-options="{ fillColor: '#000', fillOpacity: 0.25, weight: 0, interactive: false }"
        />
        <!-- Municipality markers -->
        <LMarker
          v-for="m in filteredMunicipalities"
          :key="m.slug"
          :lat-lng="[m.lat, m.lon]"
          :icon="getCustomIcon(m)"
        >
          <LPopup>
            <div class="text-sm space-y-1">
              <div class="font-semibold">{{ m.name }}</div>
              <template v-if="m.status === 'published'">
                <div>Score: {{ Number(m.score_total).toFixed(2) }}</div>
                <NuxtLink :to="`/municipalities/${m.slug}`" class="text-blue-600 underline hover:text-blue-800">
                  {{ $t("map.icon.popup.goToRanking") }}
                </NuxtLink>
              </template>
              <template v-else>
                <div>{{ $t("map.icon.popup.ratingNotFinished") }}</div>
                <div>
                  {{ $t("map.icon.popup.percentageRated", { ":percentage_rated": m.percentage_rated }) }}
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
import { LMap, LTileLayer, LMarker, LPopup, LGeoJson } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import germanyGeoJson from '~/assets/germany-polygon.json?raw'
import germanyStatesGeoJson from '~/assets/germany-state-borders.json?raw'

const props = defineProps({
  municipalities: { type: Array, required: true }
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
  fillColor: '#000',
  fillOpacity: 0.25,
  weight: 0,
  interactive: false
}



const filteredMunicipalities = computed(() => {
  return props.municipalities
    .map(m => {
      const coords = m.geolocation?.coordinates
      return {
        ...m,
        lat: typeof coords?.[1] === 'number' ? coords[1] : null,
        lon: typeof coords?.[0] === 'number' ? coords[0] : null
      }
    })
    .filter(m => typeof m.lat === 'number' && typeof m.lon === 'number')
    .filter(m => showMunicipalitiesWithUnfinishedRating.value ? (m.percentage_rated > 0 || m.status === "published") : m.status === "published")
})

onMounted(async () => {
  leaflet.value = await import('leaflet')
  DivIcon = leaflet.value.DivIcon
  PinSvg.value = (await import('~/assets/images/Pin.svg?raw')).default
  clientReady.value = true
})

watch([showMunicipalitiesWithUnfinishedRating, filteredMunicipalities], () => {
  if (mapInstance) {
    if (legendControl) mapInstance.removeControl(legendControl)
    addLegend(mapInstance)
  }
})

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
      ['text-ranking-8-10', 'Score 80-100%'],
      ['text-ranking-6-8', 'Score 60-79%'],
      ['text-ranking-4-6', 'Score 40-59%'],
      ['text-ranking-2-4', 'Score 20-39%'],
      ['text-ranking-0-2', 'Score 0-19%'],
      ['text-ranking-na', 'Not finished', !showMunicipalitiesWithUnfinishedRating.value]
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

function getCustomIcon(m) {
  if (!DivIcon || !PinSvg.value) return null
  let cssClass = "ranking-na"
  const { score_total, status } = m
  if (status === "published") {
    if (score_total < 20) cssClass = "ranking-0-2"
    else if (score_total < 40) cssClass = "ranking-2-4"
    else if (score_total < 60) cssClass = "ranking-4-6"
    else if (score_total < 80) cssClass = "ranking-6-8"
    else cssClass = "ranking-8-10"
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
