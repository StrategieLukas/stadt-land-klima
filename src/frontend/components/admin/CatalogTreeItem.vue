<template>
  <div class="mb-1">
    <!-- Catalog Header -->
    <button
      @click="handleCatalogClick"
      class="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors"
      :class="isSelected 
        ? 'bg-green-50 text-green-700' 
        : 'text-gray-700 hover:bg-gray-100'"
    >
      <div class="flex items-center gap-2 min-w-0">
        <svg 
          class="w-4 h-4 shrink-0 transition-transform"
          :class="{ 'rotate-90': isExpanded }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span class="truncate font-medium">{{ catalog.name }}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0 ml-2">
        <span 
          v-if="catalog.isCurrentFrontend"
          class="w-2 h-2 bg-green-500 rounded-full"
          title="Frontend aktiv"
        ></span>
        <span 
          v-if="catalog.isCurrentBackend"
          class="w-2 h-2 bg-blue-500 rounded-full"
          title="Backend aktiv"
        ></span>
      </div>
    </button>

    <!-- Expanded Content (Sectors) -->
    <div v-if="isExpanded && isSelected" class="ml-4 mt-1 space-y-0.5">
      <button
        v-for="(sectorMeasures, sector) in measuresBySector"
        :key="sector"
        @click.stop="handleSectorClick(sector)"
        class="w-full text-left"
      >
        <div
          class="flex items-center justify-between px-3 py-1.5 text-sm rounded-lg transition-colors"
          :class="selectedSector === sector 
            ? 'bg-green-100 text-green-800' 
            : 'text-gray-600 hover:bg-gray-50'"
        >
          <div class="flex items-center gap-2 min-w-0">
            <svg 
              class="w-3 h-3 shrink-0 transition-transform"
              :class="{ 'rotate-90': expandedSectors.includes(sector) }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <span class="truncate">{{ $t(`sectors.${sector}`) }}</span>
          </div>
          <span class="text-xs text-gray-400 shrink-0">{{ sectorMeasures.length }}</span>
        </div>

        <!-- Measures within sector -->
        <div 
          v-if="expandedSectors.includes(sector) && selectedSector === sector" 
          class="ml-4 mt-0.5 space-y-0.5"
        >
          <button
            v-for="measure in sectorMeasures"
            :key="measure.id"
            @click.stop="handleMeasureClick(measure)"
            class="w-full flex items-center gap-2 px-3 py-1 text-xs rounded transition-colors"
            :class="selectedMeasureId === measure.id 
              ? 'bg-green-200 text-green-900' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'"
          >
            <span class="font-mono shrink-0">{{ measure.measure_id }}</span>
            <span class="truncate">{{ measure.name }}</span>
            <span 
              v-if="measure.status === 'draft'"
              class="shrink-0 w-1.5 h-1.5 bg-yellow-400 rounded-full"
              title="Entwurf"
            ></span>
          </button>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const { $t } = useNuxtApp();

const props = defineProps({
  catalog: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  selectedSector: {
    type: String,
    default: null
  },
  selectedMeasureId: {
    type: String,
    default: null
  },
  measuresBySector: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['select-catalog', 'select-sector', 'select-measure']);

const expandedSectors = ref([]);

const isExpanded = computed(() => props.isSelected);

// Expand sector when selected
watch(() => props.selectedSector, (sector) => {
  if (sector && !expandedSectors.value.includes(sector)) {
    expandedSectors.value.push(sector);
  }
});

function handleCatalogClick() {
  emit('select-catalog', props.catalog.id);
}

function handleSectorClick(sector) {
  // Toggle expansion
  const idx = expandedSectors.value.indexOf(sector);
  if (idx === -1) {
    expandedSectors.value.push(sector);
  } else {
    expandedSectors.value.splice(idx, 1);
  }
  
  emit('select-sector', sector);
}

function handleMeasureClick(measure) {
  emit('select-measure', measure);
}
</script>
