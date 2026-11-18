<template>
  <div class="flex w-full items-start gap-3">
    <!-- Left: label + name -->
    <component
      :is="href ? NuxtLink : 'div'"
      :to="href"
      class="min-w-0 flex-1"
      :class="{ 'after:absolute after:inset-0': href }"
      @click="$emit('navigate', $event)"
    >
      <div class="truncate text-xs font-medium text-gray-400 uppercase">
        {{ result.stateLabel ?? result.typeLabel }}
      </div>
      <div class="leading-tight font-semibold text-gray-900">{{ result.name }}</div>
      <span
        v-if="result.areaKind"
        class="area-result-kind mt-1 inline-block max-w-full rounded-full border px-2 py-0.5 text-xs leading-snug"
        :class="`area-result-kind--${result.areaKind}`"
        :title="
          $t(result.areaKind === 'administrative-area' ? 'administrative_areas.not_reasonable_for_rating' : areaKindKey)
        "
      >
        {{ $t(areaKindKey) }}
      </span>
    </component>

    <!-- Right: chips + population -->
    <div class="flex shrink-0 flex-col items-end gap-1">
      <!-- Complete: integer score chip -->
      <span
        v-if="result.ctaType === 'complete'"
        class="slk-rating-chip rounded-full px-2 py-0.5 text-xs whitespace-nowrap"
        :class="`bg-${result.scoreTotalColorClass}`"
        >{{ result.scoreDisplay }}</span
      >

      <!-- In-progress: two chips -->
      <template v-else-if="result.ctaType === 'in-progress'">
        <span class="slk-badge slk-badge--warning rounded-full px-2 py-0.5 text-xs whitespace-nowrap">
          {{ $t("rating.in_progress") }}
        </span>
        <button
          type="button"
          class="slk-badge slk-badge--success slk-badge-action relative z-10 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap transition-colors"
          @click.stop="$emit('chip-action', { action: 'mitmachen', ars: result.ars, result })"
        >
          {{ $t("localteam.contact_action") }}
        </button>
      </template>

      <!-- Outdated: old catalog score chip + update CTA -->
      <template v-else-if="result.ctaType === 'outdated'">
        <span class="slk-badge slk-badge--warning rounded-full px-2 py-0.5 text-xs whitespace-nowrap"
          >{{ result.scoreDisplay }} ({{ $t("search.rating.old") }})</span
        >
        <button
          type="button"
          class="slk-badge slk-badge--success slk-badge-action relative z-10 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap transition-colors"
          @click.stop="$emit('chip-action', { action: 'update', ars: result.ars, result })"
        >
          {{ $t("search.rating.update") }}
        </button>
      </template>

      <!-- Localteam exists, but the current catalog has not been started -->
      <template v-else-if="result.ctaType === 'not-started'">
        <span class="slk-badge rounded-full px-2 py-0.5 text-xs whitespace-nowrap">
          {{ $t("rating.not_started") }}
        </span>
        <button
          type="button"
          class="slk-badge slk-badge--success slk-badge-action relative z-10 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap transition-colors"
          @click.stop="$emit('chip-action', { action: 'mitmachen', ars: result.ars, result })"
        >
          {{ $t("localteam.contact_action") }}
        </button>
      </template>

      <!-- None: register CTA -->
      <button
        v-else-if="result.ctaType === 'none'"
        type="button"
        class="slk-badge slk-badge-action relative z-10 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap transition-colors"
        @click.stop="$emit('chip-action', { action: 'gruenden', ars: result.ars, result })"
      >
        {{ $t("search.rating.start") }}
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
import { computed, type PropType } from "vue";
import { NuxtLink } from "#components";

const props = defineProps({
  href: { type: String, default: undefined },
  result: { type: Object as PropType<AreaResult>, required: true },
  showPopulation: { type: Boolean as PropType<boolean | undefined>, default: false },
});
const areaKindKey = computed(() => {
  if (props.result.areaKind === "region") return "search.area_type.region";
  if (props.result.areaKind === "municipality") return "search.area_type.municipality";
  return "search.area_type.not_rateable";
});

defineEmits<{
  navigate: [event: MouseEvent];
  "chip-action": [payload: AreaChipAction];
}>();
</script>

<style scoped>
.area-result-kind {
  background-color: var(--slk-surface-subdued);
  border-color: var(--slk-border);
  color: var(--slk-text);
}
.area-result-kind--region {
  background-color: color-mix(in srgb, var(--slk-blue) 8%, var(--slk-surface));
  border-color: color-mix(in srgb, var(--slk-blue) 25%, var(--slk-border));
}
.area-result-kind--municipality {
  background-color: color-mix(in srgb, var(--slk-olive-green) 8%, var(--slk-surface));
  border-color: color-mix(in srgb, var(--slk-olive-green) 25%, var(--slk-border));
}
</style>
