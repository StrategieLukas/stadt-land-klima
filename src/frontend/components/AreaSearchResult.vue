<template>
  <div class="flex items-start gap-3 w-full">
    <!-- Left: label + name -->
    <div class="flex-1 min-w-0">
      <div class="text-xs font-medium uppercase text-gray-400 truncate">
        {{ result.stateLabel ?? result.typeLabel }}
      </div>
      <div class="font-semibold text-gray-900 leading-tight">{{ result.name }}</div>
    </div>

    <!-- Right: chips + population -->
    <div class="flex flex-col items-end gap-1 flex-shrink-0">
      <!-- Complete: integer score chip -->
      <span
        v-if="result.ctaType === 'complete'"
        class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap text-white"
        :class="`bg-${result.scoreTotalColorClass}`"
      >{{ result.scoreDisplay }}</span>

      <!-- In-progress: two chips -->
      <template v-else-if="result.ctaType === 'in-progress'">
        <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full whitespace-nowrap">
          Bewertung läuft
        </span>
        <button
          type="button"
          class="text-xs bg-olive-green/10 text-olive-green border border-olive-green/30 px-2 py-0.5 rounded-full whitespace-nowrap hover:bg-olive-green/20 transition-colors"
          @click.stop="$emit('chip-action', { action: 'mitmachen', ars: result.ars, result })"
        >
          Jetzt mitmachen!
        </button>
      </template>

      <!-- None: register CTA -->
      <button
        v-else-if="result.ctaType === 'none'"
        type="button"
        class="text-xs text-gray-500 border border-gray-300 px-2 py-0.5 rounded-full whitespace-nowrap hover:bg-gray-50 transition-colors"
        @click.stop="$emit('chip-action', { action: 'gruenden', ars: result.ars, result })"
      >
        Jetzt Lokalteam gründen
      </button>

      <!-- Population (if requested) -->
      <span
        v-if="showPopulation && result.population"
        class="text-xs text-gray-400 whitespace-nowrap"
      >{{ result.population.toLocaleString('de-DE') }} Einw.</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  result:         { type: Object,  required: true },
  showPopulation: { type: Boolean, default: false },
})
defineEmits(['chip-action'])
</script>
