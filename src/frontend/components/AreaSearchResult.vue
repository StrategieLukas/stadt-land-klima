<template>
  <div class="flex w-full items-start gap-3">
    <!-- Left: label + name -->
    <div class="min-w-0 flex-1">
      <div class="text-gray-400 truncate text-xs font-medium uppercase">
        {{ result.stateLabel ?? result.typeLabel }}
      </div>
      <div class="text-gray-900 font-semibold leading-tight">{{ result.name }}</div>
    </div>

    <!-- Right: chips + population -->
    <div class="flex flex-shrink-0 flex-col items-end gap-1">
      <!-- Complete: integer score chip -->
      <span
        v-if="result.ctaType === 'complete'"
        class="slk-rating-chip whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-white"
        :class="`bg-${result.scoreTotalColorClass}`"
        >{{ result.scoreDisplay }}</span
      >

      <!-- In-progress: two chips -->
      <template v-else-if="result.ctaType === 'in-progress'">
        <span class="whitespace-nowrap rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
          {{ $t("rating.in_progress") }}
        </span>
        <button
          type="button"
          class="whitespace-nowrap rounded-full border border-solid-olive-green-30 bg-solid-olive-green-10 px-2 py-0.5 text-xs text-olive-green transition-colors hover:bg-solid-olive-green-20"
          @click.stop="$emit('chip-action', { action: 'mitmachen', ars: result.ars, result })"
        >
          {{ $t("generic.join_now") }}
        </button>
      </template>

      <!-- Outdated: old catalog score chip + update CTA -->
      <template v-else-if="result.ctaType === 'outdated'">
        <span
          class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
          style="background-color: #fef3c7; color: #92400e;"
        >{{ result.scoreDisplay }} (alte Bewertung)</span>
        <button
          type="button"
          class="text-xs bg-olive-green/10 text-olive-green border border-olive-green/30 px-2 py-0.5 rounded-full whitespace-nowrap hover:bg-olive-green/20 transition-colors"
          @click.stop="$emit('chip-action', { action: 'update', ars: result.ars, result })"
        >
          Bewertung aktualisieren
        </button>
      </template>

      <!-- None: register CTA -->
      <button
        v-else-if="result.ctaType === 'none'"
        type="button"
        class="text-gray-500 border-gray-300 hover:bg-gray-50 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs transition-colors"
        @click.stop="$emit('chip-action', { action: 'gruenden', ars: result.ars, result })"
      >
        {{ $t("localteam.create_now") }}
      </button>

      <!-- Population (if requested) -->
      <span v-if="showPopulation && result.population" class="text-gray-400 whitespace-nowrap text-xs"
        >{{ result.population.toLocaleString("de-DE") }} {{ $t("stats.inhabitants_abbrev") }}</span
      >
    </div>
  </div>
</template>

<script setup>
defineProps({
  result: { type: Object, required: true },
  showPopulation: { type: Boolean, default: false },
});
defineEmits(["chip-action"]);
</script>
