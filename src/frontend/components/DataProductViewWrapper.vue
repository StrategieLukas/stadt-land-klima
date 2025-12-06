<template>
  <div 
    class="flex border min-h-[100px] flex-col gap-6 lg:flex-row items-center p-4 bg-base-100 shadow-md mt-2 cursor-pointer"
    @click="toggle"
  >
    <!-- Title + Unit -->
    <div class="text-center lg:text-left w-60">
      <div class="font-medium text-base-content">
        {{ title }}
      </div>
      <p v-if="unit" class="text-sm">{{ unitDisplay }}</p>
    </div>

    <!-- Progress bar or other content slot -->
    <div class="w-full justify-center grow md:px-20 sm:px-10">
      <slot name="content" :expanded="expanded" :toggle="toggle" />
    </div>

    <!-- Code + Info -->
    <div class="w-60 text-center">
      <p v-if="code">{{ code }}</p>
      <button class="btn btn-ghost btn-sm pointer-events-none">
        Info
        <span v-if="expanded">▲</span>
        <span v-else>▼</span>
      </button>
    </div>
  </div>

  <!-- Expandable section -->
  <div v-if="expanded" class="p-4 space-y-3 text-sm text-black bg-base-100 shadow-md">
    <div v-if="description">
      <p class="font-bold">{{ $t('stats.labels.description') }}</p>
      <p>{{ description }}</p>
    </div>
    
    <div v-if="calculation">
      <p class="font-bold">{{ $t('stats.labels.calculation') }}</p>
      <p>{{ calculation }}</p>
    </div>
    
    <div v-if="dataSources.length">
      <p class="font-bold">{{ dataSources.length === 1 ? $t('stats.labels.data_source.singular') : $t('stats.labels.data_source.plural') }}</p>
      <div class="grid gap-3 mt-2">
        <div v-for="dataSource in dataSources" :key="dataSource.id" class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <!-- Date Badge -->
          <div v-if="dataSource.effectiveDt" class="flex justify-between items-start mb-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {{ new Date(dataSource.effectiveDt).toLocaleDateString() }}
            </span>
          </div>
          
          <!-- License and Attribution Information -->
          <div v-if="dataSource.license || dataSource.attribution || dataSource.attributionUrl">
            <table class="table table-xs">
              <tbody>
                <!-- License -->
                <tr v-if="dataSource.license">
                  <td class="font-semibold text-gray-600 uppercase tracking-wide w-32">License</td>
                  <td>
                    <div class="flex flex-wrap items-center gap-2">
                      <a v-if="dataSource.license.url" 
                         :href="dataSource.license.url" 
                         target="_blank" 
                         rel="noopener noreferrer" 
                         class="inline-flex items-center py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors">
                        {{ dataSource.license.name }}
                        <svg class="ml-1 w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                      </a>
                      <span v-else class="inline-flex items-center py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {{ dataSource.license.name }}
                      </span>
                    </div>
                    <p v-if="dataSource.license.text" class="text-sm text-gray-600 mt-1">
                      {{ dataSource.license.text }}
                    </p>
                  </td>
                </tr>
                
                <!-- Attribution -->
                <tr v-if="dataSource.attribution">
                  <td class="font-semibold text-gray-600 uppercase tracking-wide w-32">Attribution</td>
                  <td class="text-sm text-gray-700">{{ dataSource.attribution }}</td>
                </tr>
                
                <!-- Attribution URL -->
                <tr v-if="dataSource.attributionUrl">
                  <td class="font-semibold text-gray-600 uppercase tracking-wide w-32">Source</td>
                  <td>
                    <a :href="dataSource.attributionUrl" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="inline-flex items-center text-sm text-primary hover:text-primary/70 underline break-all">
                      {{ dataSource.attributionUrl }}
                      <svg class="ml-1 w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                      </svg>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Histogram Section -->
    <div v-if="histogramConfig">
      <p class="font-bold">{{ $t('stats.labels.distribution') }}</p>
      <div class="mt-2 bg-gray-50 rounded-lg p-4">
        <!-- Use simple histogram if precomputed data is available -->
        <DataHistogram
          v-if="hasPrecomputedHistogram"
          :histogram-url="histogramConfig.histogramUrl"
          :current-value="histogramConfig.currentValue"
          :municipality-name="histogramConfig.municipalityName"
          :unit="histogramConfig.unit || unit"
          :data-product-name="histogramConfig.title || name"
          :populationNormalized="histogramConfig.populationNormalized"
          :population="histogramConfig.population"
          :is-percentage="histogramConfig.isPercentage"
          :orange-threshold="histogramConfig.orangeThreshold"
          :yellow-threshold="histogramConfig.yellowThreshold"
          :light-green-threshold="histogramConfig.lightGreenThreshold"
          :dark-green-threshold="histogramConfig.darkGreenThreshold"
          @bin-click="handleBinClick"
        />
        <!-- Fallback to legacy histogram component -->
        <DataHistogramLegacy
          v-else
          :data-type="histogramConfig.dataType"
          :attribute-name="histogramConfig.attributeName"
          :current-value="histogramConfig.currentValue"
          :unit="unit"
          :population-normalized="histogramConfig.populationNormalized"
          :orange-threshold="histogramConfig.orangeThreshold"
          :yellow-threshold="histogramConfig.yellowThreshold"
          :light-green-threshold="histogramConfig.lightGreenThreshold"
          :dark-green-threshold="histogramConfig.darkGreenThreshold"
        />
        
        <!-- Selected Bin Data Display -->
        <div v-if="selectedBinData" class="mt-4 border-t pt-4">
          <div class="flex justify-between items-center mb-2">
            <h4 class="font-semibold text-base">
              {{ $t('stats.histogram.municipalities_in_range') }} 
              ({{ selectedBinData.bin_range.start.toFixed(0) }} - {{ selectedBinData.bin_range.end.toFixed(0) }} {{ histogramConfig.unit || unit }})
            </h4>
            <button 
              @click.stop="selectedBinData = null" 
              class="text-gray-500 hover:text-gray-700"
              :title="$t('generic.close')"
            >
              ✕
            </button>
          </div>
          <p class="text-sm text-gray-600 mb-2">
            {{ selectedBinData.count }} {{ $t('stats.histogram.municipalities') }}
          </p>
          <div class="max-h-60 overflow-y-auto border">
            <table class="table table-zebra table-xs table-pin-rows">
              <thead>
                <tr>
                  <th class="text-right pr-1">{{ $t('administrative_areas.prefix') }}</th>
                  <th class="text-left pl-1">{{ $t('administrative_areas.name') }}</th>
                  <th class="text-right">
                    <button 
                      @click.stop="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
                      class="hover:text-blue-600 flex items-center gap-1 ml-auto"
                    >
                      {{ $t('stats.value') }}
                      <span class="text-xs">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="area in sortedAreas" 
                  :key="area.id"
                  class="hover"
                >
                  <td class="pr-1 text-right text-gray-600">{{ area.prefix }}</td>
                  <td class="pl-1">
                    <NuxtLink 
                      :to="`/stats/${area.ars}`" 
                      class="text-blue-600 hover:text-blue-800 hover:underline"
                      @click.stop
                    >
                      {{ area.name }}
                    </NuxtLink>
                  </td>
                  <td class="text-right">{{ area.displayValue.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Section -->
    <div v-if="mapEnabled && ars && dataProductType">
      <p class="font-bold">{{ $t('stats.labels.map') || 'Map' }}</p>
      <div class="mt-2 bg-gray-50 rounded-lg p-4">
        <DataProductMap
          :ars="ars"
          :data-product-type="dataProductType"
          :area-bounds="areaBounds"
          height="h-96"
        />
      </div>
    </div>

    <!-- Custom expandable content slot -->
    <slot name="expandable-content" :expanded="expanded" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import DataHistogram from '~/components/DataHistogram.vue'
import DataHistogramLegacy from '~/components/DataHistogramLegacy.vue'
import DataProductMap from '~/components/DataProductMap.vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    default: null
  },
  code: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null
  },
  calculation: {
    type: String,
    default: null
  },
  dataSources: {
    type: Array,
    default: () => []
  },
  showMeasureLink: {
    type: Boolean,
    default: true
  },
  defaultExpanded: {
    type: Boolean,
    default: false
  },
  histogramConfig: {
    type: Object,
    default: null
  },
  mapEnabled: {
    type: Boolean,
    default: false
  },
  ars: {
    type: String,
    default: null
  },
  dataProductType: {
    type: String,
    default: null
  },
  areaBounds: {
    type: Object,
    default: null
  }
})

const { $t } = useNuxtApp()

const expanded = ref(props.defaultExpanded)
const hasPrecomputedHistogram = ref(false)
const selectedBinData = ref(null)
const sortOrder = ref('asc') // 'asc' or 'desc'

const sortedAreas = computed(() => {
  if (!selectedBinData.value?.areas) return []
  
  // Transform values if population normalized
  const areas = selectedBinData.value.areas.map(area => {
    let displayValue = area.value
    
    // Apply population normalization if needed
    if (props.histogramConfig?.populationNormalized && props.histogramConfig?.population) {
      displayValue = (area.value / props.histogramConfig?.population) * 1000
    }
    
    return {
      ...area,
      displayValue
    }
  })
  
  // Sort by the display value
  if (sortOrder.value === 'asc') {
    return areas.sort((a, b) => a.displayValue - b.displayValue)
  } else {
    return areas.sort((a, b) => b.displayValue - a.displayValue)
  }
})

// Check if precomputed histogram data is available
async function checkHistogramAvailability() {
  if (!props.histogramConfig?.histogramUrl) {
    hasPrecomputedHistogram.value = false
    return
  }
  
  try {
    const url = props.histogramConfig.histogramUrl.includes('?') 
      ? `${props.histogramConfig.histogramUrl}&format=json` 
      : `${props.histogramConfig.histogramUrl}?format=json`
    
    const response = await fetch(url)
    if (!response.ok) {
      hasPrecomputedHistogram.value = false
      return
    }
    
    const data = await response.json()
    const result = data?.results?.[0]
    
    // Check if we have valid histogram data
    hasPrecomputedHistogram.value = !!(result?.bin_edges && result?.bin_counts && data?.results?.length > 0)
  } catch (error) {
    console.error('Error checking histogram availability:', error)
    hasPrecomputedHistogram.value = false
  }
}

// Check on mount and when histogramConfig changes
onMounted(() => {
  if (props.histogramConfig) {
    checkHistogramAvailability()
  }
})

watch(() => props.histogramConfig, () => {
  if (props.histogramConfig) {
    checkHistogramAvailability()
  }
}, { deep: true })

const unitDisplay = computed(() => {
  if (!props.unit) return ''
  return props.unit.startsWith('in ') ? props.unit : `in ${props.unit}`
})

function toggle() {
  expanded.value = !expanded.value
}

function handleBinClick(binData) {
  selectedBinData.value = binData
  sortOrder.value = 'asc' // Reset sort order on new selection
  console.log('Bin clicked:', binData)
  // You can add more functionality here, such as:
  // - Display a modal with the list of areas
  // - Emit an event to parent components
  // - Navigate to a detailed view
}

// Expose the expanded state and toggle function for parent components
defineExpose({
  expanded,
  toggle,
  selectedBinData
})
</script>