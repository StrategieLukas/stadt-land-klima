<template>
  <div 
    class="flex flex-col gap-6 lg:flex-row items-center justify-between p-4 bg-base-100 shadow-md mt-2 mb-2 cursor-pointer"
    @click="toggle"
  >
    <!-- Title + Unit -->
    <div class="text-center lg:text-left w-40">
      <div class="font-medium text-base-content">
        {{ title }}
      </div>
      <p v-if="unit" class="text-sm">{{ unitDisplay }}</p>
    </div>

    <!-- Progress bar or other content slot -->
    <div class="flex-1 flex w-full justify-center">
      <slot name="content" :expanded="expanded" :toggle="toggle" />
    </div>

    <!-- Code + Info -->
    <div class="w-40 text-center">
      <p v-if="code">{{ code }}</p>
      <button class="btn btn-ghost btn-sm pointer-events-none">
        Info
        <span v-if="expanded">▲</span>
        <span v-else>▼</span>
      </button>
    </div>
  </div>

  <!-- Expandable section -->
  <div v-if="expanded" class="p-4 border-t space-y-3 text-sm text-black bg-base-100 shadow-md">
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
          
          <!-- License Information -->
          <div v-if="dataSource.license" class="mb-3">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">License</span>
            </div>
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
            <p v-if="dataSource.license.text" class="text-sm text-gray-600 mt-2">
              {{ dataSource.license.text }}
            </p>
          </div>
          
          <!-- Attribution -->
          <div v-if="dataSource.attribution" class="mb-3">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Attribution</span>
            </div>
            <p class="text-sm text-gray-700">{{ dataSource.attribution }}</p>
          </div>
          
          <!-- Attribution URL -->
          <div v-if="dataSource.attributionUrl" class="mb-2">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Source</span>
            </div>
            <a :href="dataSource.attributionUrl" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="inline-flex items-center text-sm text-primary hover:text-primary/70 underline break-all">
              {{ dataSource.attributionUrl }}
              <svg class="ml-1 w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Histogram Section -->
    <div v-if="histogramConfig">
      <p class="font-bold">{{ $t('stats.labels.distribution') }}</p>
      <div class="mt-2 bg-gray-50 rounded-lg p-4">
        <DataHistogram
          :data-type="histogramConfig.dataType"
          :attribute-name="histogramConfig.attributeName"
          :current-value="histogramConfig.currentValue"
          :unit="unit"
          :population-normalized="histogramConfig.populationNormalized"
        />
        <p>Legende: Rot: Klasse, in der diese Kommune vertreten ist. Orange: Unteres und obere 5%-Percentile zusammengefasst.</p>
      </div>
    </div>

    <!-- Custom expandable content slot -->
    <slot name="expandable-content" :expanded="expanded" />
    
    <div v-if="showMeasureLink">
      <NuxtLink
        to="/measures"
        class="underline text-primary hover:text-primary/70"
      >
        {{ $t("stats.measure.link") }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import DataHistogram from '~/components/DataHistogram.vue'

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
  }
})

const { $t } = useNuxtApp()

const expanded = ref(props.defaultExpanded)

const unitDisplay = computed(() => {
  if (!props.unit) return ''
  return props.unit.startsWith('in ') ? props.unit : `in ${props.unit}`
})

function toggle() {
  expanded.value = !expanded.value
}

// Expose the expanded state and toggle function for parent components
defineExpose({
  expanded,
  toggle
})
</script>