<template>
  <div class="flex w-full items-start gap-3">
    <!-- Left: label + name -->
    <div class="min-w-0 flex-1">
      <div class="truncate text-xs font-medium text-gray-400 uppercase">
        {{ result.stateLabel ?? result.typeLabel }}
      </div>
      <div class="leading-tight font-semibold text-gray-900">{{ result.name }}</div>
    </div>

    <!-- Right: chips + population -->
    <div class="flex shrink-0 flex-col items-end gap-1">
      <!-- Complete: integer score chip -->
      <span
        v-if="result.ctaType === 'complete'"
        class="slk-rating-chip rounded-full px-2 py-0.5 text-xs whitespace-nowrap text-white"
        :class="`bg-${result.scoreTotalColorClass}`"
        >{{ result.scoreDisplay }}</span
      >

      <!-- In-progress: two chips -->
      <template v-else-if="result.ctaType === 'in-progress'">
        <span class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs whitespace-nowrap text-yellow-800">
          {{ $t("rating.in_progress") }}
        </span>
        <button
          type="button"
          class="rounded-full border border-solid-olive-green-30 bg-solid-olive-green-10 px-2 py-0.5 text-xs whitespace-nowrap text-olive-green transition-colors hover:bg-solid-olive-green-20"
          @click.stop="$emit('chip-action', { action: 'mitmachen', ars: result.ars, result })"
        >
          {{ $t("generic.join_now") }}
        </button>
      </template>

      <!-- Outdated: old catalog score chip + update CTA -->
      <template v-else-if="result.ctaType === 'outdated'">
        <span
          class="rounded-full px-2 py-0.5 text-xs whitespace-nowrap"
          style="background-color: #fef3c7; color: #92400e"
          >{{ result.scoreDisplay }} ({{ $t("search.rating.old") }})</span
        >
        <button
          type="button"
          class="rounded-full border border-olive-green/30 bg-olive-green/10 px-2 py-0.5 text-xs whitespace-nowrap text-olive-green transition-colors hover:bg-olive-green/20"
          @click.stop="$emit('chip-action', { action: 'update', ars: result.ars, result })"
        >
          {{ $t("search.rating.update") }}
        </button>
      </template>

      <!-- Localteam exists, but the current catalog has not been started -->
      <template v-else-if="result.ctaType === 'not-started'">
        <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs whitespace-nowrap text-gray-700">
          {{ $t("rating.not_started") }}
        </span>
        <button
          type="button"
          class="rounded-full border border-solid-olive-green-30 bg-solid-olive-green-10 px-2 py-0.5 text-xs whitespace-nowrap text-olive-green transition-colors hover:bg-solid-olive-green-20"
          @click.stop="$emit('chip-action', { action: 'mitmachen', ars: result.ars, result })"
        >
          {{ $t("generic.join_now") }}
        </button>
      </template>

      <!-- None: register CTA -->
      <button
        v-else-if="result.ctaType === 'none'"
        type="button"
        class="rounded-full border border-gray-300 px-2 py-0.5 text-xs whitespace-nowrap text-gray-500 transition-colors hover:bg-gray-50"
        @click.stop="$emit('chip-action', { action: 'gruenden', ars: result.ars, result })"
      >
        {{ $t("localteam.create_now") }}
      </button>

      <!-- Population (if requested) -->
      <span v-if="showPopulation && result.population" class="text-xs whitespace-nowrap text-gray-400"
        >{{ result.population.toLocaleString("de-DE") }} {{ $t("stats.inhabitants_abbrev") }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AreaChipAction, AreaResult } from "~/types/components/navigation";
import type { PropType } from "vue";

defineProps({
  result: { type: Object as PropType<AreaResult>, required: true },
  showPopulation: { type: Boolean as PropType<boolean | undefined>, default: false },
});
defineEmits<{ "chip-action": [payload: AreaChipAction] }>();
</script>
