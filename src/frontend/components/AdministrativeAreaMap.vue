<template>
  <div class="w-full h-64 bg-gray-100 rounded-lg overflow-hidden z-0">
    <LMap
      ref="map"
      :zoom="zoom"
      :center="center"
      :options="mapOptions"
      class="h-full w-full z-1000"
    >
      <LTileLayer
        :url="tileUrl"
        :attribution="attribution"
      />
      
      <!-- Display the area boundary if available -->
      <LGeoJson
        v-if="geoArea"
        :geojson="geoArea"
        :options="geoJsonOptions"
      />
      
      <!-- Display center point -->
      <LCircleMarker
        v-if="geoCenter"
        :lat-lng="geoCenter"
        :radius="8"
        :options="markerOptions"
      />
    </LMap>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  geoCenter: {
    type: Object,
    default: null
  },
  geoArea: {
    type: Object,
    default: null
  },
  administrativeAreaName: {
    type: String,
    default: 'Administrative Area'
  }
})

const map = ref(null)
const zoom = ref(10)

// Default center (Germany)
const defaultCenter = [51.1657, 10.4515]

const center = computed(() => {
  if (props.geoCenter?.coordinates) {
    // GeoJSON coordinates are [longitude, latitude], but Leaflet expects [latitude, longitude]
    return [props.geoCenter.coordinates[1], props.geoCenter.coordinates[0]]
  }
  return defaultCenter
})

const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const mapOptions = {
  zoomControl: true,
  scrollWheelZoom: false,
  doubleClickZoom: true,
  touchZoom: true,
}

const geoJsonOptions = {
  style: {
    color: '#3B82F6',
    weight: 2,
    opacity: 0.8,
    fillColor: '#3B82F6',
    fillOpacity: 0.2
  }
}

const markerOptions = {
  color: '#EF4444',
  fillColor: '#EF4444',
  fillOpacity: 0.8,
  weight: 2
}

// Fit map bounds when geoArea changes
watch(() => props.geoArea, (newGeoArea) => {
  if (newGeoArea && map.value?.leafletObject) {
    try {
      const leafletMap = map.value.leafletObject
      const geoJsonLayer = L.geoJSON(newGeoArea)
      const bounds = geoJsonLayer.getBounds()
      
      if (bounds.isValid()) {
        leafletMap.fitBounds(bounds, { padding: [20, 20] })
      }
    } catch (error) {
      console.warn('Could not fit bounds to geoArea:', error)
    }
  }
}, { immediate: true })

onMounted(() => {
  // Set initial zoom based on whether we have geoArea or just center point
  if (props.geoArea) {
    zoom.value = 8
  } else if (props.geoCenter) {
    zoom.value = 12
  } else {
    zoom.value = 6
  }
})
</script>