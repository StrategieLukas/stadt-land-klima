<template>
  <div 
    class="flex items-center justify-between p-4 bg-base-100 shadow-md mt-2 mb-2 cursor-pointer"
    @click="toggle"
  >
    <!-- Title + Unit -->
    <div class="w-40">
      <div class="font-medium text-base-content">
        {{ title }}
      </div>
      <p v-if="unit" class="text-sm">{{ unitDisplay }}</p>
    </div>

    <!-- Progress bar or other content slot -->
    <div class="flex-1 flex justify-center">
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
    
    <div v-if="dataSource">
      <p class="font-bold">{{ $t('stats.labels.data_source') }}</p>
      <div v-if="dataSource">
        <p v-if="dataSource.attribution">{{ dataSource.attribution }}</p>
        <p v-if="dataSource.attributionUrl">
          <a :href="dataSource.attributionUrl" target="_blank" rel="noopener noreferrer" class="underline text-primary hover:text-primary/70">
            {{ dataSource.attributionUrl }}
          </a>
        </p>
      </div>
    </div>
    
    <div v-if="dataLicense">
      <p class="font-bold">{{ $t('stats.labels.data_license') }}</p>
      <div>
        <p v-if="dataLicense.name">{{ dataLicense.name }}</p>
        <p v-if="dataLicense.url">
          <a :href="dataLicense.url" target="_blank" rel="noopener noreferrer" class="underline text-primary hover:text-primary/70">
            {{ dataLicense.url }}
          </a>
        </p>
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
  dataSource: {
    type: Object,
    default: null
  },
  // Legacy support for string dataSource
  legacyDataSource: {
    type: String,
    default: null
  },
  dataLicense: {
    type: Object,
    default: null
  },
  showMeasureLink: {
    type: Boolean,
    default: true
  },
  defaultExpanded: {
    type: Boolean,
    default: false
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