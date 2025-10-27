<template>
  <div class="w-full h-64 bg-gray-100 rounded-lg overflow-hidden relative z-10">
    <LMap
      ref="map"
      :zoom="zoom"
      :center="center"
      :options="mapOptions"
      class="h-full w-full"
      @ready="onMapReady"
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
        @ready="onGeoJsonReady"
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
import { ref, computed, watch, onMounted, nextTick } from 'vue'

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
const mapReady = ref(false)

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

const fitBoundsToGeoArea = () => {
  if (!props.geoArea || !map.value?.leafletObject || !mapReady.value) {
    return
  }

  try {
    const leafletMap = map.value.leafletObject
    const geoJsonLayer = L.geoJSON(props.geoArea)
    const bounds = geoJsonLayer.getBounds()
    
    if (bounds.isValid()) {
      // Use more generous padding and maxZoom to ensure full visibility
      leafletMap.fitBounds(bounds, { 
        padding: [30, 30],
        maxZoom: 16 // Prevent zooming too close for small areas
      })
    }
  } catch (error) {
    console.warn('Could not fit bounds to geoArea:', error)
  }
}

const onMapReady = () => {
  mapReady.value = true
  // Small delay to ensure map is fully initialized
  setTimeout(() => {
    fitBoundsToGeoArea()
  }, 100)
}

const onGeoJsonReady = () => {
  // Fit bounds when GeoJSON is ready
  nextTick(() => {
    fitBoundsToGeoArea()
  })
}

// Watch for changes in geoArea and refit bounds
watch(() => props.geoArea, () => {
  if (mapReady.value) {
    setTimeout(() => {
      fitBoundsToGeoArea()
    }, 100)
  }
}, { deep: true })

// Also watch for changes in geoCenter if no geoArea
watch(() => props.geoCenter, (newGeoCenter) => {
  if (!props.geoArea && newGeoCenter && mapReady.value) {
    const leafletMap = map.value?.leafletObject
    if (leafletMap) {
      const centerLatLng = [newGeoCenter.coordinates[1], newGeoCenter.coordinates[0]]
      leafletMap.setView(centerLatLng, 12)
    }
  }
}, { deep: true })

onMounted(() => {
  // Set initial zoom based on available data
  if (props.geoArea) {
    zoom.value = 10 // Will be adjusted by fitBounds
  } else if (props.geoCenter) {
    zoom.value = 12
  } else {
    zoom.value = 6
  }
})
</script>