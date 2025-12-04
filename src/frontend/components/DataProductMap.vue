<template>
  <div class="w-full bg-gray-100 rounded-lg overflow-hidden relative z-10">
    <div v-if="loading" class="h-64 flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span class="ml-2 text-gray-600">{{ $t('generic.loading') }}...</span>
    </div>
    
    <div v-else-if="error" class="h-64 flex items-center justify-center text-red-600 bg-red-50">
      <div class="text-center">
        <svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p class="mt-2 text-sm">{{ error }}</p>
      </div>
    </div>
    
    <div v-else-if="!mapData" class="h-64 flex items-center justify-center text-gray-500">
      <div class="text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 5.447-2.724A1 1 0 0121 3.276v10.764a1 1 0 01-.553.894L15 17l-6-3z" />
        </svg>
        <p class="mt-2 text-sm">{{ $t('stats.map.no_data_available') || 'No map data available' }}</p>
      </div>
    </div>
    
    <div v-else :class="props.height" class="w-full bg-gray-50 rounded-lg overflow-hidden">
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
      
      <!-- Display area boundary if available -->
      <LGeoJson
        v-if="areaBounds"
        :geojson="areaBounds"
        :options="areaBoundsOptions"
      />
      
      <!-- Display markers from map data -->
      <template v-for="layer in mapData.layers" :key="layer.name">
        <template v-if="layer.type === 'markers'" v-for="item in layer.data" :key="item.coordinates.join(',')">
          <LMarker
            :lat-lng="[item.coordinates[0], item.coordinates[1]]"
          >
            <LIcon
              :icon-size="[25, 41]"
              :icon-anchor="[12, 41]"
              :popup-anchor="[1, -34]"
              :shadow-size="[41, 41]"
              icon-url="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
              shadow-url="https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
              :class-name="getMarkerClass(item.properties)"
            />
            <LPopup v-if="item.properties?.popup_content">
              <div v-html="item.properties.popup_content"></div>
            </LPopup>
          </LMarker>
        </template>
      </template>
      </LMap>
    </div>
    
    <!-- Legend -->
    <div v-if="mapData && showLegend" class="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-md max-w-xs z-[1000]">
      <h4 class="font-semibold text-sm mb-2">{{ $t('stats.map.legend') || 'Legend' }}</h4>
      <div v-for="layer in mapData.layers" :key="layer.name" class="flex items-center text-xs mb-1">
        <div class="w-4 h-4 rounded-full mr-2" :style="{ backgroundColor: layer.style?.marker_color || '#2196F3' }"></div>
        <span>{{ layer.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRuntimeConfig } from 'nuxt/app'

const props = defineProps({
  ars: {
    type: String,
    required: true
  },
  dataProductType: {
    type: String,
    required: true
  },
  areaBounds: {
    type: Object,
    default: null
  },
  height: {
    type: String,
    default: 'h-64'
  },
  showLegend: {
    type: Boolean,
    default: true
  }
})

const config = useRuntimeConfig()
const { $t } = useNuxtApp()

const map = ref(null)
const mapData = ref(null)
const loading = ref(false)
const error = ref(null)
const mapReady = ref(false)
const zoom = ref(10)

// Default center (Germany)
const defaultCenter = [51.1657, 10.4515]

const center = computed(() => {
  if (mapData.value?.center) {
    return mapData.value.center
  }
  return defaultCenter
})

const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const mapOptions = {
  zoomControl: true,
  scrollWheelZoom: true,
  doubleClickZoom: true,
  touchZoom: true,
}

const areaBoundsOptions = {
  style: {
    color: '#6B7280',
    weight: 2,
    opacity: 0.6,
    fillColor: 'transparent',
    fillOpacity: 0
  }
}

const getMarkerClass = (properties) => {
  // Different CSS classes based on power or other properties
  if (properties?.power_kw) {
    const power = properties.power_kw
    if (power >= 150) {
      return 'marker-high-power' // High power - red
    } else if (power >= 50) {
      return 'marker-medium-power' // Medium power - orange  
    } else {
      return 'marker-low-power' // Low power - green
    }
  }
  
  // Default blue marker
  return 'marker-default'
}

const fetchMapData = async () => {
  if (!props.ars || !props.dataProductType) {
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    const baseUrl = config.public.stadtlandzahlUrl?.replace('/graphql/', '').replace('/graphql', '') || 'http://localhost:8000'
    const apiUrl = `${baseUrl}/api/areas/${props.ars}/maps/${props.dataProductType}/`
    
    console.log('DataProductMap: Fetching from', apiUrl)
    
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('DataProductMap: Data received:', data)
    
    mapData.value = data
    
    // Fit map to bounds if available
    if (data.bounds && mapReady.value) {
      fitToBounds(data.bounds)
    }
    
  } catch (err) {
    console.error('DataProductMap: Error fetching map data:', err)
    error.value = $t('stats.map.error_loading') || 'Error loading map data'
  } finally {
    loading.value = false
  }
}

const fitToBounds = (bounds) => {
  if (!map.value?.leafletObject || !bounds) return
  
  try {
    const leafletMap = map.value.leafletObject
    // bounds format: [[minLat, minLng], [maxLat, maxLng]]
    leafletMap.fitBounds(bounds, {
      padding: [20, 20],
      maxZoom: 15
    })
  } catch (error) {
    console.warn('Could not fit map to bounds:', error)
  }
}

const onMapReady = () => {
  mapReady.value = true
  
  // Fit to bounds if map data is already loaded
  if (mapData.value?.bounds) {
    setTimeout(() => {
      fitToBounds(mapData.value.bounds)
    }, 100)
  }
  
  // Force map to recalculate its size
  setTimeout(() => {
    const leafletMap = map.value?.leafletObject
    if (leafletMap) {
      leafletMap.invalidateSize()
    }
  }, 300)
}

// Watch for prop changes and refetch data
watch([() => props.ars, () => props.dataProductType], () => {
  fetchMapData()
}, { immediate: false })

onMounted(() => {
  fetchMapData()
})

// Expose map data for parent components if needed
defineExpose({
  mapData,
  loading,
  error,
  refetch: fetchMapData
})
</script>

<style scoped>
/* Custom marker styles if needed */
.leaflet-popup-content {
  margin: 8px 12px;
  line-height: 1.4;
}

.leaflet-popup-content h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

/* Marker color customization */
:deep(.marker-high-power .leaflet-marker-icon) {
  filter: hue-rotate(0deg) saturate(150%); /* Red for high power */
}

:deep(.marker-medium-power .leaflet-marker-icon) {
  filter: hue-rotate(30deg) saturate(120%); /* Orange for medium power */
}

:deep(.marker-low-power .leaflet-marker-icon) {
  filter: hue-rotate(120deg) saturate(130%); /* Green for low power */
}

:deep(.marker-default .leaflet-marker-icon) {
  filter: hue-rotate(220deg) saturate(100%); /* Blue for default */
}
</style>