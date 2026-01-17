<template>
  <div class="text-sm">
    <div v-if="!stats" class="text-gray-400 italic">
      Laden...
    </div>
    <div v-else class="space-y-1">
      <!-- Measure count -->
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span class="text-gray-600">{{ stats.measureCount }} Maßnahmen</span>
      </div>

      <!-- Completion -->
      <div class="flex items-center gap-2">
        <div class="flex-1 max-w-[100px] h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            class="h-full transition-all duration-300"
            :class="completionColorClass"
            :style="{ width: `${completionPercent}%` }"
          ></div>
        </div>
        <span class="text-gray-600 min-w-[60px]">
          {{ completionPercent }}%
        </span>
      </div>

      <!-- Details based on type -->
      <div class="text-xs text-gray-500">
        <template v-if="catalog.uses_structured_ratings">
          {{ stats.structuredRated }}/{{ stats.structuredTotal }} Kriterien
        </template>
        <template v-else>
          {{ stats.ratingsWithValue }}/{{ stats.legacyTotal }} Bewertungen
        </template>
      </div>

      <!-- Municipalities -->
      <div class="text-xs text-gray-500">
        {{ stats.uniqueLocalteamsRated }} von {{ stats.totalMunicipalities }} Kommunen
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  catalog: {
    type: Object,
    required: true
  },
  stats: {
    type: Object,
    default: null
  }
});

const completionPercent = computed(() => {
  if (!props.stats) return 0;
  
  if (props.catalog.uses_structured_ratings) {
    return props.stats.structuredCompletionPercent || 0;
  }
  return props.stats.legacyCompletionPercent || 0;
});

const completionColorClass = computed(() => {
  const pct = completionPercent.value;
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 60) return 'bg-lime-500';
  if (pct >= 40) return 'bg-yellow-500';
  if (pct >= 20) return 'bg-orange-500';
  return 'bg-red-500';
});
</script>
